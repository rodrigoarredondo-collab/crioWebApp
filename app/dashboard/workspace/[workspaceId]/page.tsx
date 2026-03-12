import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { WorkspaceView } from "@/components/workspace/workspace-view"

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // Fetch workspace with boards
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select(
      `
      *,
      boards(*),
      workspace_members(*, profiles(*))
    `,
    )
    .eq("id", workspaceId)
    .single()

  if (workspaceError || !workspace) {
    console.error("WorkspacePage Fetch Error:", workspaceError)
    redirect("/dashboard")
  }

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  return (
    <DashboardShell user={user} profile={profile}>
      <WorkspaceView workspace={workspace} userId={user.id} />
    </DashboardShell>
  )
}
