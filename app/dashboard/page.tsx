import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { WorkspaceList } from "@/components/dashboard/workspace-list"
import { DailyTasks } from "@/components/dashboard/daily-tasks"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // Fetch user's workspaces
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select(
      `
      *,
      workspace_members!inner(user_id)
    `,
    )
    .eq("workspace_members.user_id", user.id)
    .order("created_at", { ascending: false })

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  return (
    <DashboardShell user={user} profile={profile}>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">Manage your projects and activities</p>
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <WorkspaceList workspaces={workspaces || []} userId={user.id} />
          </div>
          <aside className="w-full lg:w-96 shrink-0">
            <DailyTasks userId={user.id} />
          </aside>
        </div>
      </div>
    </DashboardShell>
  )
}
