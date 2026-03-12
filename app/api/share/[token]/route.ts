import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { getPrivateGoogleSheetData } from "@/lib/google-sheets"

// GET /api/share/[token] — public endpoint, no auth required
// Uses admin client to bypass RLS since there's no authenticated user
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const supabase = createAdminClient()

    // Fetch the share link + parent dataroom + files
    const { data: link, error } = await supabase
        .from("dataroom_share_links")
        .select(`
        *,
        dataroom: datarooms (
            id, name, description, owner_id,
            attached_files: dataroom_attached_files(
                file: global_files(id, file_name, file_size, mime_type, storage_path, created_at)
            )
      )
    `)
        .eq("token", token)
        .eq("is_active", true)
        .single()

    if (error || !link) {
        return NextResponse.json({ error: "Link not found or expired" }, { status: 404 })
    }

    if (link.expires_at) {
        const expiresAtUTC = new Date(link.expires_at).getTime()
        const nowUTC = new Date().getTime()
        if (expiresAtUTC < nowUTC) {
            return NextResponse.json({ error: "Link has expired" }, { status: 404 })
        }
    }

    const dataroom = link.dataroom as any
    const ownerId = dataroom?.owner_id

    // Map junction table back to flat list of files
    const attached = dataroom?.attached_files || []
    const rawFiles = attached.map((a: any) => a.file).filter(Boolean)

    // Generate signed download URLs for files (valid 1 hour)
    const filesWithUrls = await Promise.all(
        rawFiles.map(async (f: any) => {
            const { data: signedUrl } = await supabase.storage
                .from("dataroom-files")
                .createSignedUrl(f.storage_path, 3600)
            return {
                id: f.id,
                file_name: f.file_name,
                file_size: f.file_size,
                mime_type: f.mime_type,
                download_url: signedUrl?.signedUrl || null,
                created_at: f.created_at,
            }
        })
    )

    let financeData = null
    let projectsData = null
    let dataData = null

    // Fetch Finance Data
    if (link.access_finance && ownerId) {
        const [{ data: priceConfig }, { data: productPrice }] = await Promise.all([
            supabase.from("price_configuration").select("*").eq("user_id", ownerId).single(),
            supabase.from("prices").select("*")
        ])

        const priceMap = productPrice?.reduce((acc: any, item: any) => {
            acc[item.reagent] = { price: item.price, quantity: item.quantity }
            return acc
        }, {}) || {}

        if (priceConfig || Object.keys(priceMap).length > 0) {
            financeData = {
                config: priceConfig?.configuration,
                priceMap
            }
        }
    }

    // Fetch Projects Data
    if (link.access_projects && ownerId) {
        const { data: workspaces } = await supabase
            .from("workspaces")
            .select(`*, workspace_members!inner(user_id)`)
            .eq("workspace_members.user_id", ownerId)
            .order("created_at", { ascending: false })

        projectsData = workspaces || []
    }

    // Provide Google Sheets Data URL
    if (link.access_data) {
        dataData = {
            url: `/api/share/${token}/data-sheet`
        }
    }

    return NextResponse.json({
        dataroom_name: dataroom?.name,
        dataroom_description: dataroom?.description,
        files: filesWithUrls,
        access: {
            finance: link.access_finance,
            projects: link.access_projects,
            data: link.access_data,
        },
        payloads: {
            finance: financeData,
            projects: projectsData,
            data: dataData
        }
    })
}

// Trigger HMR
