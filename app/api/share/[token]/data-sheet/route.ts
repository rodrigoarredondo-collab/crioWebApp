import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { getPrivateGoogleSheetXlsx } from "@/lib/google-sheets"

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const supabase = createAdminClient()

    // Verify token is active & valid
    const { data: link, error: linkErr } = await supabase
        .from("dataroom_share_links")
        .select("*")
        .eq("token", token)
        .single()

    if (linkErr || !link || !link.is_active || !link.access_data) {
        return NextResponse.json({ error: "Data access unauthorized" }, { status: 404 })
    }

    if (link.expires_at) {
        const expiresAtUTC = new Date(link.expires_at).getTime()
        const nowUTC = new Date().getTime()
        if (expiresAtUTC < nowUTC) {
            return NextResponse.json({ error: "Link has expired" }, { status: 404 })
        }
    }

    // Export the master sheet as an xlsx ArrayBuffer
    const sheetId = "1VmkS3dF_flpIerjjscJto8m-kE9z81LGAMtRmtVHl7c"
    const buffer = await getPrivateGoogleSheetXlsx(sheetId)

    if (!buffer) {
        return NextResponse.json({ error: "Failed to load underlying Drive data" }, { status: 500 })
    }

    return new NextResponse(buffer, {
        status: 200,
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="data-extract.xlsx"`,
        },
    })
}
