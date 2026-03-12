import { NextRequest } from "next/server";
import { nimAgent } from "@/lib/agents/nim-agent";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { runParallelAnalysis } from "@/lib/agents/feedback-analyzer";

export async function POST(req: NextRequest) {
    try {
        const { messages, uploadedDocuments, activeDocumentId } = await req.json();

        if (!process.env.NVIDIA_API_KEY) {
            return new Response("NVIDIA_API_KEY environment variable is missing", { status: 500 });
        }

        const docs = uploadedDocuments || [];
        const lastUserMessage = (messages.filter((m: any) => m.role === "user").pop()?.content || "").toLowerCase();

        // ── Fast path: Detect parallel feedback analysis requests ─────────
        // Check if the user's message suggests analyzing/highlighting based on reviewer feedback
        const feedbackKeywords = ["analyz", "analyse", "feedback", "weakness", "review", "parse", "critiq", "comment", "highlight", "correction", "based on", "compare"];
        const hasFeedbackKeyword = feedbackKeywords.some(kw => lastUserMessage.includes(kw));
        // Also check if one of the document names suggests feedback/review
        const hasFeedbackDoc = docs.some((d: any) => /feedback|review|critique|comment/i.test(d.name || ""));
        const isFeedbackRequest = hasFeedbackKeyword || hasFeedbackDoc;
        const pdfDoc = docs.find((d: any) => d.name?.toLowerCase().endsWith(".pdf"));
        const wordDoc = docs.find((d: any) => /\.(docx?)$/i.test(d.name));

        if (isFeedbackRequest && pdfDoc && wordDoc) {
            console.log("[API] Fast path: detected feedback analysis request. Bypassing LLM agent.");
            const encoder = new TextEncoder();

            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        controller.enqueue(encoder.encode(`0:${JSON.stringify("Analyzing reviewer feedback in parallel... This may take a minute.\n\n")}\n`));

                        const highlights = await runParallelAnalysis(pdfDoc.content, wordDoc.content);

                        // Color Palette for Weaknesses (Using Hex Codes for inline styles to bypass Tailwind purging)
                        const PREDEFINED_COLORS = [
                            '#fecaca', // red-200
                            '#bfdbfe', // blue-200
                            '#bbf7d0', // green-200
                            '#e9d5ff', // purple-200
                            '#fbcfe8', // pink-200
                            '#fed7aa', // orange-200
                            '#99f6e4', // teal-200
                            '#a5f3fc', // cyan-200
                            '#c7d2fe'  // indigo-200
                        ];

                        const uiCommands: any[] = [];
                        const weaknessToSnippetIds: Record<string, string[]> = {};
                        const weaknessesData: Record<string, any> = {};

                        // To handle overlaps, we group by exact textSnippet
                        const groupedSnippets = new Map<string, {
                            textSnippet: string;
                            weaknesses: {
                                id: string;
                                area: string;
                                critique: string;
                                weaknessText: string;
                                reasoning: string;
                                comment: string;
                                color: string
                            }[];
                        }>();

                        let colorIndex = 0;

                        // 1. Process returned highlights and group by textSnippet
                        for (const hl of highlights) {
                            if (!hl.weakness?.id) continue;

                            const weaknessId = hl.weakness.id;

                            // Initialize weakness tracking mapping and assign a color
                            if (!weaknessesData[weaknessId]) {
                                weaknessesData[weaknessId] = {
                                    ...hl.weakness,
                                    color: PREDEFINED_COLORS[colorIndex % PREDEFINED_COLORS.length]
                                };
                                weaknessToSnippetIds[weaknessId] = [];
                                colorIndex++;
                            }

                            const wData = weaknessesData[weaknessId];

                            for (const snippet of hl.snippets) {
                                if (!snippet.textSnippet) continue;

                                const textKey = snippet.textSnippet.trim().toLowerCase();

                                if (!groupedSnippets.has(textKey)) {
                                    groupedSnippets.set(textKey, {
                                        textSnippet: snippet.textSnippet, // Preserve original casing
                                        weaknesses: []
                                    });
                                }

                                const group = groupedSnippets.get(textKey)!;
                                // Avoid re-adding the exact same weakness to the same snippet if the LLM hallucinated duplicates
                                if (!group.weaknesses.find(w => w.id === weaknessId)) {
                                    group.weaknesses.push({
                                        id: weaknessId,
                                        area: hl.weakness.area,
                                        critique: hl.weakness.critique,
                                        weaknessText: hl.weakness.weakness,
                                        reasoning: hl.reasoning || "No reasoning provided.",
                                        comment: snippet.comment,
                                        color: wData.color
                                    });
                                }
                            }
                        }

                        // 2. Generate UI Commands for grouped Word document snippets
                        let snippetCounter = 0;
                        for (const [_, group] of groupedSnippets.entries()) {
                            const snippetId = `snippet-${++snippetCounter}`;

                            // Track snippetId against all weaknesses it belongs to
                            for (const w of group.weaknesses) {
                                weaknessToSnippetIds[w.id].push(snippetId);
                            }

                            // If multiple weaknesses target this text snippet, fallback to yellow. Otherwise use the single weakness color.
                            const highlightColor = group.weaknesses.length > 1 ? '#fde047' : group.weaknesses[0].color; // yellow-300

                            // Combine comments nicely for the popover by stringifying the rich JSON object
                            const combinedComment = JSON.stringify(group.weaknesses.map(w => ({
                                id: w.id,
                                wIndex: Object.keys(weaknessesData).indexOf(w.id) + 1,
                                area: w.area,
                                critique: w.critique,
                                weaknessText: w.weaknessText,
                                reasoning: w.reasoning,
                                comment: w.comment,
                                color: w.color
                            })));
                            const weaknessIds = group.weaknesses.map(w => w.id);

                            uiCommands.push({
                                type: "ui_command",
                                tool: "highlight_and_comment",
                                args: {
                                    documentId: wordDoc.id,
                                    textSnippet: group.textSnippet,
                                    comment: combinedComment,
                                    snippetId: snippetId,
                                    weaknessIds: weaknessIds, // Using plural now
                                    colorClass: highlightColor
                                }
                            });
                        }

                        // 3. Generate highlight commands for the PDF document
                        const weaknessesMetadataArray = [];
                        for (const weaknessId of Object.keys(weaknessToSnippetIds)) {
                            const wData = weaknessesData[weaknessId];
                            weaknessesMetadataArray.push({
                                id: weaknessId,
                                area: wData.area,
                                critique: wData.critique,
                                weaknessText: wData.weakness,
                                color: wData.color
                            });

                            uiCommands.push({
                                type: "ui_command",
                                tool: "highlight_weakness",
                                args: {
                                    documentId: pdfDoc.id,
                                    weaknessId: weaknessId,
                                    textSnippet: wData.weakness,
                                    linkedSnippetIds: weaknessToSnippetIds[weaknessId],
                                    comment: `**${wData.area} — ${wData.critique}**\n\nThis weakness has ${weaknessToSnippetIds[weaknessId].length} linked snippet(s) in the draft.`,
                                    colorClass: wData.color
                                }
                            });
                        }

                        // 4. Send metadata to frontend for the filtering header
                        uiCommands.push({
                            type: "ui_command",
                            tool: "set_weaknesses_metadata",
                            args: {
                                weaknesses: weaknessesMetadataArray
                            }
                        });

                        // Also open the Word document if not already active
                        if (activeDocumentId !== wordDoc.id) {
                            uiCommands.unshift({
                                type: "ui_command",
                                tool: "open_document",
                                args: { documentId: wordDoc.id }
                            });
                        }

                        // Send summary text
                        controller.enqueue(encoder.encode(`0:${JSON.stringify(`Done! I found **${highlights.length} weaknesses** in the reviewer feedback and mapped them to your Word document.\n\nPlease review the highlights in the document viewer. Each highlight includes a comment explaining which reviewer raised the concern and what area it relates to.\n`)}\n`));

                        // Stream all UI commands
                        if (uiCommands.length > 0) {
                            console.log(`[API] Streaming ${uiCommands.length} UI command(s) to frontend`);
                            controller.enqueue(encoder.encode(`8:${JSON.stringify(uiCommands)}\n`));
                        }
                    } catch (err) {
                        console.error("[API] Parallel analysis error:", err);
                        controller.enqueue(encoder.encode(`0:${JSON.stringify("Sorry, an error occurred during the parallel analysis. Please try again.")}\n`));
                    } finally {
                        controller.close();
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    "Content-Type": "text/plain; charset=utf-8",
                    "x-vercel-ai-data-stream": "v1",
                },
            });
        }

        // ── Normal path: Run through the LLM agent ───────────────────────
        const langchainMessages = messages.map((m: any) =>
            m.role === "user"
                ? new HumanMessage(m.content)
                : m.role === "system"
                    ? new SystemMessage(m.content)
                    : new AIMessage(m.content)
        );

        let contextMessage =
            "You are a helpful AI assistant connected to a specialized document interface. " +
            "You have tools to interact with the user's Document Viewer.\n\n" +
            "IMPORTANT RULES:\n" +
            "- When the user asks you to highlight, comment, edit, close, or open a document, you MUST call the appropriate tool.\n" +
            "- For highlight_and_comment: the textSnippet must be an EXACT verbatim substring from the document. The textSnippet must be unique enough to avoid highlighting the wrong section.\n" +
            "- For edit_text: the searchText must be an EXACT verbatim substring from the document.\n" +
            "- You can only call ONE tool per response. If you need to perform multiple actions, do them one at a time across multiple turns.\n" +
            "- After calling a tool, provide a brief confirmation message.\n" +
            "- Kindly answer as a general assistant to any message non-related to documents.\n";

        if (docs.length > 0) {
            contextMessage += "\nThe user has uploaded the following documents:\n";
            docs.forEach((doc: any) => {
                contextMessage += `- [ID: ${doc.id}] ${doc.name}\n`;
            });

            if (activeDocumentId) {
                const activeDoc = docs.find((d: any) => d.id === activeDocumentId);
                if (activeDoc) {
                    contextMessage += `\nCurrently open document: [ID: ${activeDoc.id}] ${activeDoc.name}\n\n<document_content>\n${activeDoc.content}\n</document_content>\n`;
                }
            } else {
                contextMessage += "\nNo document is currently open. Use the open_document tool to open one.\n";
            }
        }

        const eventStream = await nimAgent.streamEvents(
            {
                messages: [new SystemMessage(contextMessage), ...langchainMessages],
            },
            { version: "v2", recursionLimit: 100 }
        );

        const encoder = new TextEncoder();
        const uiCommands: any[] = [];

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const event of eventStream) {
                        if (event.event === "on_chat_model_stream") {
                            const content = event.data.chunk?.content;
                            if (content && typeof content === "string") {
                                controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
                            }
                        } else if (event.event === "on_tool_start") {
                            const toolName = event.name;
                            let args = event.data?.input;

                            // NVIDIA NIM wraps tool args in {input: "{...}"} — unwrap it
                            if (args && typeof args === "object" && "input" in args) {
                                try {
                                    args = typeof args.input === "string" ? JSON.parse(args.input) : args.input;
                                } catch {
                                    args = args.input;
                                }
                            }

                            if (["highlight_and_comment", "edit_text", "open_document", "close_document"].includes(toolName)) {
                                console.log("[API] Tool called:", toolName, JSON.stringify(args));
                                uiCommands.push({
                                    type: "ui_command",
                                    tool: toolName,
                                    args: args,
                                });
                            }
                        }
                    }

                    // After the full stream completes, send all collected UI commands as annotations
                    if (uiCommands.length > 0) {
                        console.log(`[API] Streaming ${uiCommands.length} UI command(s) to frontend`);
                        controller.enqueue(encoder.encode(`8:${JSON.stringify(uiCommands)}\n`));
                    }
                } catch (err) {
                    console.error("Stream error:", err);
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "x-vercel-ai-data-stream": "v1",
            },
        });
    } catch (error: any) {
        console.error("Chat API error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
