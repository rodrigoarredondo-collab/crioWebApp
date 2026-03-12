import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    console.log("Testing Workspaces:")
    const wsRes = await supabase.from('workspaces').select('*, boards(*), workspace_members(*, profiles(*))').limit(1)
    console.log("Workspaces Error:", JSON.stringify(wsRes.error, null, 2))

    console.log("Testing Datarooms:")
    const drRes = await supabase.from('datarooms').select('*').limit(1)
    console.log("Datarooms Error:", JSON.stringify(drRes.error, null, 2))
}
test()
