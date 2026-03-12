"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function uploadGlobalFile(formData: FormData) {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        throw new Error("Unauthorized")
    }

    const file = formData.get("file") as File | null
    if (!file) {
        throw new Error("No file provided")
    }

    // Sanitize filename to prevent "Invalid key" Supabase Storage errors
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const storagePath = `${user.id}/global/${Date.now()}_${sanitizedName}`

    const { error: uploadError } = await adminSupabase.storage
        .from("dataroom-files")
        .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
        console.error("[File Upload Action] Storage error:", uploadError)
        throw new Error(uploadError.message)
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
        console.error("[File Upload Action] DB error:", dbError)
        await adminSupabase.storage.from("dataroom-files").remove([storagePath])
        throw new Error(dbError.message)
    }

    return fileRecord
}
