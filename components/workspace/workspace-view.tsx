"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Workspace, Board, WorkspaceMember } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Plus, LayoutGrid, Users, FlaskConical, Trash2 } from "lucide-react"
import { InviteMemberDialog } from "./invite-member-dialog"

interface WorkspaceViewProps {
  workspace: Workspace & { boards: Board[]; workspace_members: WorkspaceMember[] }
  userId: string
}

const BOARD_COLORS = ["#0073ea", "#00c875", "#fdab3d", "#e2445c", "#a25ddc", "#579bfc", "#ff158a", "#00d2d2"]

export function WorkspaceView({ workspace, userId }: WorkspaceViewProps) {
  const [boards, setBoards] = useState<Board[]>(workspace.boards || [])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedColor, setSelectedColor] = useState(BOARD_COLORS[0])
  const [boardType, setBoardType] = useState<"general" | "experiment">("general")
  const router = useRouter()

  const handleCreateBoard = async () => {
    if (!name.trim()) return

    setIsLoading(true)
    const supabase = createClient()

    try {
      const { data: board, error: boardError } = await supabase
        .from("boards")
        .insert({
          workspace_id: workspace.id,
          name: name.trim(),
          description: description.trim() || null,
          color: selectedColor,
          board_type: "experiment",//boardType,
        })
        .select()
        .single()

      if (boardError) throw boardError

      const defaultGroups =
        boardType === "experiment"
          ? [
            { board_id: board.id, name: "Scheduled", color: "#579bfc", position: 0 },
            { board_id: board.id, name: "In Progress", color: "#fdab3d", position: 1 },
            { board_id: board.id, name: "Completed", color: "#00c875", position: 2 },
          ]
          : [
            { board_id: board.id, name: "To Do", color: "#579bfc", position: 0 },
            { board_id: board.id, name: "In Progress", color: "#fdab3d", position: 1 },
            { board_id: board.id, name: "Done", color: "#00c875", position: 2 },
          ]

      await supabase.from("groups").insert(defaultGroups)

      setBoards([...boards, board])
      setIsOpen(false)
      setName("")
      setDescription("")
      setSelectedColor(BOARD_COLORS[0])
      setBoardType("general")
      router.refresh()
    } catch (error) {
      console.error("Error creating activity:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{workspace.name}</h1>
            {workspace.description && <p className="mt-1 text-muted-foreground">{workspace.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <InviteMemberDialog
              workspaceId={workspace.id}
              onMemberAdded={() => router.refresh()}
              currentMembers={workspace.workspace_members}
            />
            <div className="flex items-center gap-1 rounded-full bg-muted px-3 py-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{workspace.workspace_members.length} members</span>
            </div>
          </div>
        </div>
      </div>

      {/* Boards Section */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Activities</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create activity</DialogTitle>
              <DialogDescription>Add a new activity to organize your tasks and projects.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* <div className="grid gap-2">
                <Label>Activity Type</Label>
                <Tabs value={boardType} onValueChange={(v) => setBoardType(v as "general" | "experiment")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="general" className="gap-2">
                      <LayoutGrid className="h-4 w-4" />
                      General
                    </TabsTrigger>
                    <TabsTrigger value="experiment" className="gap-2">
                      <FlaskConical className="h-4 w-4" />
                      Experiment
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {boardType === "experiment" && (
                  <p className="text-xs text-muted-foreground">
                    Experiment activities have a predefined workflow: Printing → Thawing → Data Collections
                  </p>
                )}
              </div> */}
              <div className="grid gap-2">
                <Label htmlFor="boardName">Name</Label>
                <Input id="boardName" placeholder="My Activity" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="boardDescription">Description (optional)</Label>
                <Textarea
                  id="boardDescription"
                  placeholder="What's this activity for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {BOARD_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-8 w-8 rounded-full transition-transform ${selectedColor === color ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"
                        }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateBoard} disabled={isLoading || !name.trim()}>
                {isLoading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {boards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <LayoutGrid className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-card-foreground">No activities yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create your first activity to start managing tasks.</p>
            <Button className="mt-4 gap-2" onClick={() => setIsOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Activity
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link key={board.id} href={`/dashboard/workspace/${workspace.id}/board/${board.id}`}>
              <Card className="transition-colors hover:border-primary/50 hover:bg-accent/50 overflow-hidden group relative">
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-destructive/90 hover:text-destructive-foreground h-8 w-8 text-destructive"
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!confirm("Are you sure you want to delete this activity?")) return

                    const supabase = createClient()
                    await supabase.from("boards").delete().eq("id", board.id)
                    setBoards(boards.filter((b) => b.id !== board.id))
                    router.refresh()
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="h-2" style={{ backgroundColor: board.color }} />
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{board.name}</CardTitle>
                    {board.board_type === "experiment" && (
                      <span className="flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300">
                        <FlaskConical className="h-3 w-3" />
                        Experiment
                      </span>
                    )}
                  </div>
                  {board.description && <CardDescription className="line-clamp-2">{board.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(board.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
