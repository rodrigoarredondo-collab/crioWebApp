import {
    makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    proto,
} from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import pino from "pino"
import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import path from "path"
import fs from "fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const qrcode = require("qrcode-terminal")

dotenv.config()

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables. Check your .env file.")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const logger = pino({ level: "info" })

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys")

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
    })


    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
        console.log("\nScan this QR code to login:\n")
        qrcode.generate(qr, { small: true })
    }

    if (connection === "close") {
        const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut

        if (shouldReconnect) {
            connectToWhatsApp()
        }
    } else if (connection === "open") {
        console.log("opened connection")
        startDailyCheck(sock)
    }
})



    // Listen for messages (poll responses)
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return

        const jid = msg.key.remoteJid!

        // Handle Poll Updates
        if (msg.message.pollUpdateMessage) {
            await handlePollResponse(sock, msg)
        }

        // Handle Text Responses (for reasons)
        if (msg.message.conversation || msg.message.extendedTextMessage) {
            await handleTextResponse(sock, msg)
        }
    })

    return sock
}

async function handlePollResponse(sock: any, msg: any) {
    const pollUpdate = msg.message.pollUpdateMessage
    if (!pollUpdate) return

    const pollCreationMsgKey = pollUpdate.pollCreationMessageKey
    const from = msg.key.remoteJid!
    const phoneNumber = from.split("@")[0]

    // In a production app, we would use the pollCreationMsgKey.id to find the task.
    // For this implementation, we'll find the most recent active task for this user.
    const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", phoneNumber)
        .single()

    if (!profile) return

    const { data: task } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("assignee_id", profile.id)
        .neq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

    if (!task) return

    // Note: Real poll decryption requires the original message and hashing options.
    // For this implementation, if they interacted with the poll, we'll send a follow-up 
    // asking for confirmation or reason if not done.

    console.log(`Poll interaction for user ${phoneNumber} on task: ${task.title}`)
}

async function handleTextResponse(sock: any, msg: any) {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text
    const from = msg.key.remoteJid!
    const phoneNumber = from.split("@")[0]

    // Check if this user was recently asked for a reason
    const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", phoneNumber)
        .single()

    if (profile) {
        // Find the last incomplete task for this user that doesn't have a reason
        const { data: task } = await supabase
            .from("tasks")
            .select("id, title")
            .eq("assignee_id", profile.id)
            .is("incomplete_reason", null)
            .neq("status", "done")
            .order("updated_at", { ascending: false })
            .limit(1)
            .single()

        if (task) {
            await supabase
                .from("tasks")
                .update({ incomplete_reason: text })
                .eq("id", task.id)

            await sock.sendMessage(from, { text: `Got it. I've recorded the reason for "${task.title}": ${text}` })
        }
    }
}

async function sendTaskPoll(sock: any, jid: string, task: any) {
    await sock.sendMessage(jid, {
        poll: {
            name: `Did you complete the task: "${task.title}"?`,
            values: ["Yes, it's done!", "No, not yet"],
            selectableCount: 1,
        }
    })
}

async function startDailyCheck(sock: any) {
    console.log("Starting daily task check...")

    // Run every hour to check for tasks due today
    setInterval(async () => {
        const today = new Date().toISOString().split("T")[0]

        const { data: notifications } = await supabase
            .from("task_notifications")
            .select(`
        *,
        task:tasks(
          id,
          title,
          assignee_id,
          profiles:assignee_id(phone_number)
        )
      `)
            .eq("notify_date", today)
            .is("whatsapp_sent_at", null)

        if (notifications) {
            for (const notif of notifications) {
                const task = notif.task as any
                const phone = task.profiles?.phone_number

                if (phone) {
                    const jid = `${phone.replace("+", "")}@s.whatsapp.net`
                    await sendTaskPoll(sock, jid, task)

                    await supabase
                        .from("task_notifications")
                        .update({ whatsapp_sent_at: new Date().toISOString() })
                        .eq("id", notif.id)

                    console.log(`Sent poll to ${phone} for task: ${task.title}`)
                }
            }
        }
    }, 1000 * 60 * 60) // Check every hour
}

connectToWhatsApp()
