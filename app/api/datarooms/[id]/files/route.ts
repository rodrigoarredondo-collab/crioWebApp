import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

// POST /api/datarooms/[id]/files — attach an existing global file to this room
export async function POST(req: NextRequest, { params }: Params) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Verify ownership
    const { data: room } = await supabase
        .from("datarooms")
        .select("id")
        .eq("id", id)
        .eq("owner_id", user.id)
        .single()
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { file_ids } = await req.json()
    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return NextResponse.json({ error: "No file_ids provided" }, { status: 400 })
    }

    const payload = file_ids.map((fid: string) => ({
        dataroom_id: id,
        file_id: fid
    }))

    const { error: dbError } = await supabase
        .from("dataroom_attached_files")
        .insert(payload)

    if (dbError) {
        console.error("[File Attach] DB error:", dbError)
        return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
}

// DELETE /api/datarooms/[id]/files?fileId=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const fileId = req.nextUrl.searchParams.get("fileId")
    if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 })

    // Delete DB attachment record (does not delete file from global_files or storage)
    const { error } = await supabase
        .from("dataroom_attached_files")
        .delete()
        .eq("file_id", fileId)
        .eq("dataroom_id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
