import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Admin client that bypasses RLS — use only in server-side API routes
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    // The service role key should be kept secret and never exposed to the client
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
    return createSupabaseClient(url, serviceKey, {
        auth: { persistSession: false },
    })
}
