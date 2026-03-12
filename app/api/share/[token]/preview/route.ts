import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import * as xlsx from "xlsx"

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const fileId = req.nextUrl.searchParams.get("fileId")

    if (!fileId) return NextResponse.json({ error: "Missing fileId" }, { status: 400 })

    const supabase = createAdminClient()

    // 1. Verify token is active & valid
    const { data: link, error: linkErr } = await supabase
        .from("dataroom_share_links")
        .select("*")
        .eq("token", token)
        .single()

    if (linkErr || !link || !link.is_active) {
        console.error("Preview API Link Error for token:", token, linkErr)
        return NextResponse.json({ error: "Link not found or inactive" }, { status: 404 })
    }

    if (link.expires_at) {
        const expiresAtUTC = new Date(link.expires_at).getTime()
        const nowUTC = new Date().getTime()
        if (expiresAtUTC < nowUTC) {
            return NextResponse.json({ error: "Link has expired" }, { status: 404 })
        }
    }

    // 2. Fetch file metadata to ensure it belongs to this dataroom via junction
    const { data: attached, error: attachErr } = await supabase
        .from("dataroom_attached_files")
        .select("file:global_files(file_name, storage_path, mime_type)")
        .eq("file_id", fileId)
        .eq("dataroom_id", link.dataroom_id)
        .single()

    if (attachErr || !attached || !attached.file) {
        return NextResponse.json({ error: "File not found or not attached to this room" }, { status: 404 })
    }

    const file = attached.file as any

    // 3. For native-viewable files (PDF, images) and native Excel files (.xlsx), just return a signed URL
    const isXlsx = file.file_name.endsWith(".xlsx");

    if (file.mime_type?.startsWith("image/") || file.mime_type === "application/pdf" || isXlsx) {
        const { data: signedUrl } = await supabase.storage
            .from("dataroom-files")
            .createSignedUrl(file.storage_path, 3600)

        let url = signedUrl?.signedUrl
        // Append toolbar=0 to PDFs to hide download button in native viewer
        if (url && file.mime_type === "application/pdf") {
            url += "#toolbar=0"
        }

        const type = isXlsx ? "fortune-sheet" : "url";
        return NextResponse.json({ type, url, mimeType: file.mime_type })
    }

    // 4. For Documents (DOCX/XLSX/CSV), download arraybuffer via admin client 
    const { data: blob, error: dlErr } = await supabase.storage
        .from("dataroom-files")
        .download(file.storage_path)

    if (dlErr || !blob) {
        return NextResponse.json({ error: "Failed to read file from storage" }, { status: 500 })
    }

    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    try {
        // - Word Documents (.docx)
        if (file.file_name.endsWith(".docx")) {
            const result = await mammoth.convertToHtml({ buffer })
            return NextResponse.json({ type: "html", html: result.value })
        }

        // - Legacy Excel / CSV
        if (file.file_name.endsWith(".xls") || file.file_name.endsWith(".csv")) {
            const workbook = xlsx.read(buffer, { type: "buffer" })
            const firstSheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[firstSheetName]
            // Convert worksheet to HTML table string
            const htmlString = xlsx.utils.sheet_to_html(worksheet)
            return NextResponse.json({ type: "html", html: htmlString })
        }

        // - Unsupported conversions
        return NextResponse.json({
            error: "Preview not available for this file type.",
            type: "unsupported"
        }, { status: 400 })

    } catch (parseError) {
        console.error("Preview Parse Error:", parseError)
        return NextResponse.json({ error: "Failed to generate preview." }, { status: 500 })
    }
}
