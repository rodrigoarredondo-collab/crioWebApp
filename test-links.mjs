import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { data, error } = await supabase.from('dataroom_share_links').select('*').limit(1)
    console.log("Links Error:", error)
    console.log("Links Data:", JSON.stringify(data, null, 2))
}
test()
