import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";

// ── UI Tools ──────────────────────────────────────────────────────────
// These tools are "mock" on the backend — they simply return a success
// message to the LLM.  The real execution happens on the frontend,
// which receives the tool name + args via the Vercel AI data stream.

const highlightAndComment = new DynamicStructuredTool({
    name: "highlight_and_comment",
    description:
        "Highlights a snippet of text in the currently open document and attaches a comment. " +
        "The textSnippet MUST be copied verbatim from the document.",
    schema: z.object({
        textSnippet: z.string().describe("Exact text to highlight (verbatim from the document)."),
        comment: z.string().describe("Comment to attach to the highlight."),
    }),
    func: async ({ textSnippet, comment }) => {
        return `Highlighted "${textSnippet.slice(0, 40)}…" with comment "${comment.slice(0, 40)}…"`;
    },
});

const editText = new DynamicStructuredTool({
    name: "edit_text",
    description:
        "Replaces a snippet of text in the currently open document with new text. " +
        "searchText MUST be copied verbatim from the document.",
    schema: z.object({
        searchText: z.string().describe("Exact text to find (verbatim from the document)."),
        replaceText: z.string().describe("New text to replace it with."),
    }),
    func: async ({ searchText, replaceText }) => {
        return `Replaced "${searchText.slice(0, 40)}…" with "${replaceText.slice(0, 40)}…"`;
    },
});

const openDocument = new DynamicStructuredTool({
    name: "open_document",
    description: "Opens a previously uploaded document in the Document Viewer by its ID.",
    schema: z.object({
        documentId: z.string().describe("The ID of the document to open."),
    }),
    func: async ({ documentId }) => {
        return `Opened document ${documentId}`;
    },
});

const closeDocument = new DynamicStructuredTool({
    name: "close_document",
    description: "Closes the currently open document in the Document Viewer.",
    schema: z.object({}),
    func: async () => {
        return "Closed document";
    },
});

const parallelAnalyzeWeaknesses = new DynamicStructuredTool({
    name: "parallel_analyze_weaknesses",
    description: "Triggers a deep parallel analysis of reviewer feedback from a PDF against a Word document. Call this when the user asks to parse weaknesses or analyze feedback in parallel.",
    schema: z.object({
        pdfDocumentId: z.string().describe("The ID of the uploaded PDF containing reviewer feedback."),
        wordDocumentId: z.string().describe("The ID of the uploaded Word document being reviewed."),
    }),
    func: async ({ pdfDocumentId, wordDocumentId }) => {
        return `Started parallel analysis of reviewer feedback from PDF ${pdfDocumentId} against Word Document ${wordDocumentId}...`;
    },
});

export const uiTools = [highlightAndComment, editText, openDocument, closeDocument, parallelAnalyzeWeaknesses];
const toolNode = new ToolNode(uiTools);

// ── Router ────────────────────────────────────────────────────────────
function shouldContinue(state: typeof MessagesAnnotation.State) {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    if (last.tool_calls && last.tool_calls.length > 0) {
        return "tools";
    }
    return "__end__";
}

// ── Graph ─────────────────────────────────────────────────────────────
const workflow = new StateGraph(MessagesAnnotation)
    .addNode("chat", async (state) => {
        // Use Llama 3.1 which supports tool / function calling on NVIDIA NIM
        const llm = new ChatOpenAI({
            modelName: "meta/llama-3.1-70b-instruct",
            temperature: 0.2,
            maxTokens: 2048,
            apiKey: process.env.NVIDIA_API_KEY || "dummy",
            configuration: {
                baseURL: "https://integrate.api.nvidia.com/v1",
            },
        }).bindTools(uiTools, { parallel_tool_calls: false });

        const response = await llm.invoke(state.messages);
        return { messages: [response] };
    })
    .addNode("tools", toolNode)
    .addEdge("__start__", "chat")
    .addConditionalEdges("chat", shouldContinue)
    .addEdge("tools", "chat");

export const nimAgent = workflow.compile();
