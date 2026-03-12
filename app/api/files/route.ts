import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

// GET /api/files — fetch all global files for the current user
export async function GET() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
        .from("global_files")
        .select("*")
        .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
}

// POST /api/files — upload a file to global pool
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const storagePath = `${user.id}/global/${Date.now()}_${file.name}`

    const { error: uploadError } = await adminSupabase.storage
        .from("dataroom-files")
        .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
        console.error("[File Upload] Storage error:", uploadError)
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: fileRecord, error: dbError } = await supabase
        .from("global_files")
        .insert({
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || "application/octet-stream",
            storage_path: storagePath,
            uploaded_by: user.id,
        })
        .select()
        .single()

    if (dbError) {
        console.error("[File Upload] DB error:", dbError)
        await adminSupabase.storage.from("dataroom-files").remove([storagePath])
        return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json(fileRecord, { status: 201 })
}
