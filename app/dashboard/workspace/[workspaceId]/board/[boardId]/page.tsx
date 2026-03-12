import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { BoardView } from "@/components/board/board-view"

export default async function BoardPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>
}) {
  const { workspaceId, boardId } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // Fetch board with groups and tasks
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select(
      `
      *,
      groups(*, tasks(*, assignee:profiles(*), task_clusters(*)))
    `,
    )
    .eq("id", boardId)
    .single()

  if (boardError || !board) {
    console.error("BoardPage Fetch Error:", boardError)
    redirect(`/dashboard/workspace/${workspaceId}`)
  }

  // Fetch workspace for navigation
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*, workspace_members(*, profiles(*))")
    .eq("id", workspaceId)
    .single()

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Sort groups and tasks by position
  const sortedBoard = {
    ...board,
    groups: board.groups
      .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
      .map((group: { tasks: { position: number }[] }) => ({
        ...group,
        tasks: group.tasks.sort((a: { position: number }, b: { position: number }) => a.position - b.position),
      })),
  }

  return (
    <DashboardShell user={user} profile={profile}>
      <BoardView board={sortedBoard} workspace={workspace} userId={user.id} />
    </DashboardShell>
  )
}
