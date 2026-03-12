import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = file.type;
        const fileName = file.name.toLowerCase();

        let extractedText = "";
        let extractedHtml = "";

        if (
            mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            fileName.endsWith(".docx")
        ) {
            const resultText = await mammoth.extractRawText({ buffer });
            const resultHtml = await mammoth.convertToHtml({ buffer });
            extractedText = resultText.value;
            extractedHtml = resultHtml.value;
        } else if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
            const pdfData = await pdfParse(buffer);
            extractedText = pdfData.text;
            extractedHtml = `<div style="white-space: pre-wrap;">${extractedText}</div>`;
        } else if (mimeType.startsWith("text/") || fileName.endsWith(".txt") || fileName.endsWith(".md")) {
            extractedText = buffer.toString("utf-8");
            extractedHtml = `<div style="white-space: pre-wrap;">${extractedText}</div>`;
        } else {
            return NextResponse.json(
                { error: "Unsupported file type. Please upload a DOCX, PDF, or text file." },
                { status: 400 }
            );
        }

        return NextResponse.json({ text: extractedText, html: extractedHtml });
    } catch (error: any) {
        console.error("Document parsing error:", error);
        return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
    }
}
