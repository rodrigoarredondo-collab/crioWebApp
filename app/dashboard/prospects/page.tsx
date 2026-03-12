import { createClient } from "@/lib/supabase/server"
import { ProspectsTable } from "@/components/dashboard/prospects-table"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { redirect } from "next/navigation"

export default async function ProspectsPage() {
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

    // Fetch companies and their latest feedback
    const { data: companies, error } = await supabase
        .from('companies')
        .select(`
      *,
      created_at,
      feedback (
        id,
        company_id,
        rating,
        comments,
        score,
        created_at,
        updated_at
      )
    `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching prospects:', error)
        return (
            <DashboardShell user={user} profile={profile}>
                <div className="p-6 text-destructive">
                    Error loading prospects. Please try again later.
                </div>
            </DashboardShell>
        )
    }

    return (
        <DashboardShell user={user} profile={profile}>
            <div className="flex flex-col h-full overflow-hidden p-6 gap-6">
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Prospect Companies</h1>
                        <p className="text-muted-foreground">
                            Manage and rate your prospective companies.
                        </p>
                    </div>
                </div>

                <div className="flex-1 min-h-0">
                    <ProspectsTable initialData={companies || []} />
                </div>
            </div>
        </DashboardShell>
    )
}
