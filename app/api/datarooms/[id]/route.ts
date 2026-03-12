import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

// GET /api/datarooms/[id]
export async function GET(_req: NextRequest, { params }: Params) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
        .from("datarooms")
        .select(`
      *,
      attached_files:dataroom_attached_files (
        file:global_files(*)
      ),
      dataroom_share_links(*)
    `)
        .eq("id", id)
        .eq("owner_id", user.id)
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })

    return NextResponse.json(data)
}

// PATCH /api/datarooms/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null

    const { data, error } = await supabase
        .from("datarooms")
        .update(updates)
        .eq("id", id)
        .eq("owner_id", user.id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If access or expiration rules are provided, update the default share link
    if (body.access_finance !== undefined || body.access_projects !== undefined || body.access_data !== undefined || body.expires_at !== undefined) {
        const linkUpdates: Record<string, any> = {}
        if (body.access_finance !== undefined) linkUpdates.access_finance = !!body.access_finance
        if (body.access_projects !== undefined) linkUpdates.access_projects = !!body.access_projects
        if (body.access_data !== undefined) linkUpdates.access_data = !!body.access_data

        // Handle expiration (allow null to clear)
        if (body.expires_at !== undefined) {
            linkUpdates.expires_at = body.expires_at ? new Date(body.expires_at).toISOString() : null
        }

        if (Object.keys(linkUpdates).length > 0) {
            await supabase.from("dataroom_share_links").update(linkUpdates).eq("dataroom_id", id)
        }
    }

    return NextResponse.json(data)
}

// DELETE /api/datarooms/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
    const { id } = await params
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Delete dataroom (cascades attachments + links natively on DB side)
    const { error } = await supabase
        .from("datarooms")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
