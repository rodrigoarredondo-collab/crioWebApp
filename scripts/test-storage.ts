// Quick diagnostic: test Supabase Storage upload
import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
dotenv.config()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log("=== Supabase Storage Diagnostic ===")
console.log("URL:", url)
console.log("Key used (first 15 chars):", serviceKey?.substring(0, 15))
console.log("Key length:", serviceKey?.length)
console.log()

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

async function test() {
    // 1. List buckets
    console.log("1. Listing buckets...")
    const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets()
    if (bucketsErr) {
        console.error("   ERROR listing buckets:", bucketsErr.message)
    } else {
        console.log("   Buckets found:", buckets?.map(b => b.name).join(", ") || "NONE")
    }

    // 2. Try uploading a tiny test file
    console.log("\n2. Uploading test file to 'dataroom-files' bucket...")
    const testContent = new Blob(["Hello, this is a test file"], { type: "text/plain" })
    const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("dataroom-files")
        .upload("_test/diagnostic.txt", testContent, { contentType: "text/plain", upsert: true })

    if (uploadErr) {
        console.error("   UPLOAD ERROR:", uploadErr.message)
        console.error("   Full error:", JSON.stringify(uploadErr, null, 2))
    } else {
        console.log("   SUCCESS! Path:", uploadData?.path)
    }

    // 3. List files in bucket
    console.log("\n3. Listing files in 'dataroom-files' bucket...")
    const { data: files, error: listErr } = await supabase.storage
        .from("dataroom-files")
        .list("_test")

    if (listErr) {
        console.error("   LIST ERROR:", listErr.message)
    } else {
        console.log("   Files:", files?.map(f => f.name).join(", ") || "NONE")
    }

    // 4. Clean up
    if (!uploadErr) {
        await supabase.storage.from("dataroom-files").remove(["_test/diagnostic.txt"])
        console.log("\n4. Cleaned up test file.")
    }
}

test().catch(console.error)
