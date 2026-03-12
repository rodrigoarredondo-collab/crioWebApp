import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

// POST /api/datarooms — create a new dataroom
export async function GET() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
        .from("datarooms")
        .select(`
      *,
      dataroom_attached_files(file_id),
      dataroom_share_links(id, is_active)
    `)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Attach counts
    const rooms = (data || []).map((r: any) => ({
        ...r,
        file_count: r.dataroom_attached_files?.length ?? 0,
        active_links: r.dataroom_share_links?.filter((l: any) => l.is_active).length ?? 0,
        dataroom_attached_files: undefined,
        dataroom_share_links: undefined,
    }))

    return NextResponse.json(rooms)
}

// POST /api/datarooms — create a new dataroom
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { name, description } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const { data: dataroom, error } = await supabase
        .from("datarooms")
        .insert({ owner_id: user.id, name: name.trim(), description: description?.trim() || null })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Auto-create a single permanent share link for this dataroom
    const token = crypto.randomBytes(32).toString("hex")
    await supabase.from("dataroom_share_links").insert({
        dataroom_id: dataroom.id,
        token: token,
        label: "Default Access Link",
        access_finance: false,
        access_projects: false,
        access_data: false,
        is_active: true,
        created_by: user.id,
    })

    return NextResponse.json(dataroom, { status: 201 })
}
