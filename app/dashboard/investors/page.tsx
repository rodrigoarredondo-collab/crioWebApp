import { createClient } from "@/lib/supabase/server"
import { InvestorsTable } from "@/components/dashboard/investors-table"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { redirect } from "next/navigation"

export default async function InvestorsPage() {
    const supabase = await createClient()

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect("/auth/login")
    }

    // Fetch user profile for sidebar
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

    // Fetch ventures and their latest feedback
    const { data: ventures, error } = await supabase
        .from('ventures')
        .select(`
      *,
      created_at,
      feedback:venture_feedback (
        id,
        venture_id,
        rating,
        comments,
        status,
        contact,
        score,
        created_at,
        updated_at
      )
    `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching investors:', error)
        return (
            <DashboardShell user={user} profile={profile}>
                <div className="p-6 text-destructive">
                    Error loading investors. Please try again later.
                </div>
            </DashboardShell>
        )
    }

    return (
        <DashboardShell user={user} profile={profile}>
            <div className="flex flex-col h-full overflow-hidden p-6 gap-6">
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Investors</h1>
                        <p className="text-muted-foreground">
                            Manage and rate prospective investors.
                        </p>
                    </div>
                </div>

                <div className="flex-1 min-h-0">
                    <InvestorsTable initialData={ventures || []} />
                </div>
            </div>
        </DashboardShell>
    )
}
