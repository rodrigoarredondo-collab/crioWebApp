import {
    makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    getAggregateVotesInPollMessage,
    getContentType,
    decryptPollVote,
} from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import pino from "pino"
import * as dotenv from "dotenv"
import { createRequire } from "node:module"
import { createClient } from "@supabase/supabase-js"
import { format } from "date-fns"

const require = createRequire(import.meta.url)
const qrcode = require("qrcode-terminal")

dotenv.config()

// TEST CONFIGURATION
const TEST_PHONE_NUMBER = "5218442460686" // REPLACE WITH YOUR PHONE NUMBER (International format without +)
const TEST_MESSAGE = "This is a test message for Cria"

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    //console.error("Missing Supabase environment variables. Check your .env file.")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const logger = pino({ level: "error" }) // Silent pino logs for cleaner terminal

// Simple in-memory store for messages (needed for poll decryption and history)
class SimpleStore {
    private messages: { [id: string]: any } = {}
    private pollTaskMap: { [pollId: string]: { [optionName: string]: { taskId: string, boardId: string } } } = {}

    saveMessage(msg: any) {
        if (msg.key.id) {
            this.messages[msg.key.id] = msg
        }
    }

    getMessage(id: string) {
        return this.messages[id]
    }

    savePollTasks(pollId: string, taskMapping: { [optionName: string]: { taskId: string, boardId: string } }) {
        this.pollTaskMap[pollId] = taskMapping
    }

    getTaskData(pollId: string, optionName: string) {
        return this.pollTaskMap[pollId]?.[optionName]
    }

    clear() {
        //console.log("[MEMORY] Clearing memory store...")
        this.messages = {}
        this.pollTaskMap = {}
    }
}

const store = new SimpleStore()

async function sendDailyTaskPolls(sock: any) {
    //console.log("[SCHEDULER] Checking for daily tasks...")

    // Get all profiles with phone numbers
    const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, phone_number, full_name")
        .not("phone_number", "is", null)

    if (profileError) {
        //console.error("[SCHEDULER] Error fetching profiles:", profileError)
        return
    }

    const today = format(new Date(), "yyyy-MM-dd")

    for (const profile of profiles) {
        // Get pending tasks for today for this profile
        const { data: tasks, error: taskError } = await supabase
            .from("tasks")
            .select("id, title, due_date, board_id")
            .eq("assignee_id", profile.id)
            .eq("due_date", today)
            .neq("status", "done")

        if (taskError) {
            //console.error(`[SCHEDULER] Error fetching tasks for profile ${profile.id}:`, taskError)
            continue
        }

        if (tasks && tasks.length > 0) {
            const jid = `${profile.phone_number}@s.whatsapp.net`
            //console.log(`[SCHEDULER] Sending poll to ${profile.phone_number} with ${tasks.length} tasks`)
            
            const taskMapping: { [optionName: string]: { taskId: string, boardId: string } } = {}
            const pollOptions = tasks.map(t => {
                taskMapping[t.title] = { taskId: t.id, boardId: (t as any).board_id }
                return t.title
            })

            const pollMsg = await sock.sendMessage(jid, {
                poll: {
                    name: "Are your tasks done? (Select completed tasks)",
                    values: pollOptions.length >= 2 ? pollOptions : [pollOptions[0], "No tasks"],
                    selectableCount: tasks.length
                }
            })
            
            if (pollMsg) {
                store.saveMessage(pollMsg)
                store.savePollTasks(pollMsg.key.id!, taskMapping)
            }
        } else {
            //console.log(`[SCHEDULER] No pending tasks for profile ${profile.id} today.`)
        }
        await new Promise(res => setTimeout(res, 2000))
    }
}

async function scheduleDailyTaskCheck(sock: any) {
    const runCheck = async () => {
        try {
            await sendDailyTaskPolls(sock)
        } catch (err) {
            //console.error("[SCHEDULER] Failed to run daily check:", err)
        }

        // Schedule for next day at 8:00 PM
        const now = new Date()
        const next = new Date()
        next.setHours(20, 0, 0, 0)
        next.setDate(next.getDate() + 1)
        const delay = next.getTime() - now.getTime()
        
        //console.log(`[SCHEDULER] Next check scheduled in ${Math.round(delay / 3600000)} hours`)
        setTimeout(runCheck, delay)
    }

    const now = new Date()
    const target = new Date()
    target.setHours(20, 0, 0, 0)

    // If it's already past 8:00 PM, schedule for tomorrow
    if (now >= target) {
        target.setDate(target.getDate() + 1)
    }

    let initialDelay = target.getTime() - now.getTime()

    //console.log(`[SCHEDULER] Daily check scheduled in ${Math.round(initialDelay / 60000)} minutes (at 8:00 PM)`)
    setTimeout(runCheck, initialDelay)
}

async function connectToWhatsAppTest() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys")

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        getMessage: async (key) => {
            return store.getMessage(key.id!)?.message || undefined
        }
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            //console.log("\nScan this QR code to login (TEST MODE):\n")
            qrcode.generate(qr, { small: true })
        }

        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) {
                connectToWhatsAppTest()
            }
        } else if (connection === "open") {
            //console.log("\n[SUCCESS] Connection opened!")
            await sock.sendMessage("5218442460686@s.whatsapp.net", { text: "Hello from Cria" })
            await new Promise(res => setTimeout(res, 5000))

            // Schedule the daily check at 8:00 PM
            scheduleDailyTaskCheck(sock)
        }
    })

    sock.ev.on("messages.update", async (updates) => {
        // We mainly handle poll updates in messages.upsert for simplicity in this script
        // but Baileys sometimes sends them here too.
    })

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return

        const jid = msg.key.remoteJid!
        const isFromMe = msg.key.fromMe

        if (msg.message.pollUpdateMessage) {
            //console.log("[POLL RESPONSE] Received a poll update!")
            const pollUpdate = msg.message.pollUpdateMessage!
            const pollCreationId = pollUpdate.pollCreationMessageKey?.id
            const originalPoll = store.getMessage(pollCreationId!)

            if (originalPoll) {
                try {
                    const messageSecret = originalPoll.messageContextInfo?.messageSecret || originalPoll.message?.messageContextInfo?.messageSecret

                    if (!messageSecret) {
                        //console.log("Cannot decrypt poll: original poll is missing messageSecret.")
                        return
                    }

                    // Decrypt the vote first
                    const decryptedVote = await decryptPollVote(
                        pollUpdate.vote!,
                        {
                            pollCreatorJid: pollUpdate.pollCreationMessageKey?.remoteJid!,
                            pollMsgId: pollCreationId!,
                            pollEncKey: messageSecret,
                            voterJid: jid,
                        }
                    )

                    // Aggregate votes
                    const votes: any = getAggregateVotesInPollMessage({
                        message: originalPoll.message,
                        pollUpdates: [
                            {
                                pollUpdateMessageKey: msg.key,
                                vote: decryptedVote,
                                senderTimestampMs: pollUpdate.senderTimestampMs,
                            }
                        ]
                    })

                    //console.log("Decrypted Votes Summary:", JSON.stringify(votes, null, 2))

                    const selectedOptions: string[] = []
                    if (Array.isArray(votes)) {
                        votes.filter(v => v.voters && v.voters.length > 0).forEach(v => selectedOptions.push(v.name))
                    } else if (votes && typeof votes === 'object') {
                        const votesObj = votes as { [key: string]: { voters: string[] } }
                        for (const optionName in votesObj) {
                            if (votesObj[optionName].voters && votesObj[optionName].voters.length > 0) {
                                selectedOptions.push(optionName)
                            }
                        }
                    }

                    if (selectedOptions.length > 0) {
                        //console.log(`\n>>> USER SELECTED: ${selectedOptions.join(", ")} <<<\n`)

                        // Update Supabase for each selected task
                        for (const option of selectedOptions) {
                            const taskData = store.getTaskData(pollCreationId!, option)
                            if (taskData) {
                                // Find the "Done" group for this board
                                const { data: groupData } = await supabase
                                    .from("groups")
                                    .select("id")
                                    .eq("board_id", taskData.boardId)
                                    .eq("name", "Done")
                                    .single()

                                const updatePayload: any = {
                                    status: 'done',
                                    updated_at: format(new Date(), "yyyy-MM-dd")
                                }

                                if (groupData) {
                                    updatePayload.group_id = groupData.id
                                }

                                //console.log(`[DB UPDATE] Marking task ${taskData.taskId} ("${option}") as done and moving to Done group`)
                                const { error } = await supabase
                                    .from("tasks")
                                    .update(updatePayload)
                                    .eq("id", taskData.taskId)

                                if (error) {
                                    //console.error(`[DB ERROR] Failed to update task ${taskData.taskId}:`, error)
                                }
                            }
                        }

                        await sock.sendMessage(jid, { text: `Great! I've marked the following as completed: ${selectedOptions.join(", ")}` })
                    } else {
                        //console.log("User interacted with poll but no option is selected (or vote retracted).")
                    }
                } catch (err) {
                    //console.log("Decryption failed. Error:", err)
                }
            } else {
                //console.log("Cannot decrypt poll: original poll message not found in store.")
            }
        } else if (!isFromMe) {
            // Log incoming non-poll messages
            const mType = getContentType(msg.message)
            let text = ""

            if (mType === 'conversation') {
                text = msg.message.conversation!
            } else if (mType === 'extendedTextMessage') {
                text = msg.message.extendedTextMessage?.text!
            } else {
                text = `[${mType}]`
            }
            //console.log(`[MESSAGE] FROM ${jid}: ${text}`)
        }
    })

    // Schedule memory cleanup at 8:00 AM
    scheduleMemoryCleanup()

    return sock
}

async function scheduleMemoryCleanup() {
    const runCleanup = () => {
        store.clear()

        // Schedule for next day
        const now = new Date()
        const next = new Date()
        next.setDate(now.getDate() + 1)
        next.setHours(8, 0, 0, 0)
        const delay = next.getTime() - now.getTime()
        setTimeout(runCleanup, delay)
    }

    const now = new Date()
    const target = new Date()
    target.setHours(8, 0, 0, 0)

    if (now >= target) {
        target.setDate(target.getDate() + 1)
    }

    const delay = target.getTime() - now.getTime()
    setTimeout(runCleanup, delay)
}

//console.log("Starting WhatsApp Test script with Supabase integration...")
connectToWhatsAppTest()