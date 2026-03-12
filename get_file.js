import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("No url/key"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data: files } = await supabase.from("global_files").select("*").like("file_name", "Matrix CPAs%");
    if (!files || files.length === 0) { console.error("File not found"); return; }

    console.log("Found:", files[0].file_name, files[0].storage_path);

    const { data: blob, error } = await supabase.storage.from("dataroom-files").download(files[0].storage_path);
    if (error) { console.error(error); return; }

    const buf = await blob.arrayBuffer();
    fs.writeFileSync("Matrix_CPAs.xlsx", Buffer.from(buf));
    console.log("Downloaded Matrix_CPAs.xlsx!");
}
run();
