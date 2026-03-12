import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

type Params = { params: Promise<{ id: string }> }

// POST /api/datarooms/[id]/share — create a share link
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

    const body = await req.json()
    const { label, access_finance, access_projects, access_data, expires_at } = body

    const token = crypto.randomBytes(32).toString("hex")

    const { data, error } = await supabase
        .from("dataroom_share_links")
        .insert({
            dataroom_id: id,
            token,
            label: label?.trim() || null,
            access_finance: !!access_finance,
            access_projects: !!access_projects,
            access_data: !!access_data,
            expires_at: expires_at || null,
            is_active: true,
            created_by: user.id,
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating share link:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/datarooms/[id]/share?linkId=xxx — revoke (soft-terminate) a share link
export async function DELETE(req: NextRequest, { params }: Params) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const linkId = req.nextUrl.searchParams.get("linkId")
    if (!linkId) return NextResponse.json({ error: "linkId required" }, { status: 400 })

    const { error } = await supabase
        .from("dataroom_share_links")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", linkId)
        .eq("dataroom_id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
