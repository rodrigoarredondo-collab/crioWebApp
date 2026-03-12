import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { redirect } from "next/navigation"
import { FigureMaker } from "@/components/dashboard/figure-maker"

export default async function FigureMakerPage() {
    const supabase = await createClient()

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect("/auth/login")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

    return (
        <DashboardShell user={user} profile={profile}>
            <FigureMaker />
        </DashboardShell>
    )
}
