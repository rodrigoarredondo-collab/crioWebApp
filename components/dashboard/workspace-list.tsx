"use client"

import { useState } from "react"
import Link from "next/link"
import type { Workspace } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
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
import { Plus, FolderOpen, Trash2 } from "lucide-react"

interface WorkspaceListProps {
  workspaces: Workspace[]
  userId: string
  isReadOnly?: boolean
}

export function WorkspaceList({ workspaces: initialWorkspaces, userId, isReadOnly }: WorkspaceListProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const router = useRouter()

  const handleCreateWorkspace = async () => {
    if (!name.trim()) return

    setIsLoading(true)
    const supabase = createClient()

    try {
      // Create workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          owner_id: userId,
        })
        .select()
        .single()

      if (workspaceError) throw workspaceError

      // Add owner as member
      const { error: memberError } = await supabase.from("workspace_members").insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: "owner",
      })

      if (memberError) throw memberError

      setWorkspaces([workspace, ...workspaces])
      setIsOpen(false)
      setName("")
      setDescription("")
      router.refresh()
    } catch (error) {
      console.error("Error creating project:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Your Projects</h2>
        {!isReadOnly && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
                <DialogDescription>Add a new project to organize your activities and team.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" placeholder="My Project" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="What's this project for?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateWorkspace} disabled={isLoading || !name.trim()}>
                  {isLoading ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {workspaces.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-card-foreground">No projects yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create your first project to get started.</p>
            {!isReadOnly && (
              <Button className="mt-4 gap-2" onClick={() => setIsOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => {
            if (isReadOnly) {
              return (
                <Card className="relative" key={workspace.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{workspace.name}</CardTitle>
                    {workspace.description && (
                      <CardDescription className="line-clamp-2">{workspace.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(workspace.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              )
            }
            return (
              <Link key={workspace.id} href={`/dashboard/workspace/${workspace.id}`}>
                <Card className="transition-colors hover:border-primary/50 hover:bg-accent/50 group relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-destructive/90 hover:text-destructive-foreground h-8 w-8 text-destructive"
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!confirm("Are you sure you want to delete this project? This will delete all activities and tasks inside it.")) return

                      const supabase = createClient()
                      await supabase.from("workspaces").delete().eq("id", workspace.id)
                      setWorkspaces(workspaces.filter((w) => w.id !== workspace.id))
                      router.refresh()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <CardHeader>
                    <CardTitle className="text-lg">{workspace.name}</CardTitle>
                    {workspace.description && (
                      <CardDescription className="line-clamp-2">{workspace.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(workspace.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div >
  )
}
