"use client"

import { useState, useEffect } from "react"
import type { Task, Group, WorkspaceMember, TaskCluster } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { TaskComments } from "@/components/board/task-comments"
import { ClusterSelector } from "@/components/board/cluster-selector"

interface TaskDialogProps {
  task: Task | null
  groupId: string | null
  groups: (Group & { tasks: Task[] })[]
  workspaceMembers: WorkspaceMember[]
  currentUserId?: string
  onClose: () => void
  onUpdate: (task: Task, newGroupId?: string) => void
  clusters: TaskCluster[]
  onClusterCreated?: (cluster: TaskCluster) => void
}

export function TaskDialog({ task, groupId, groups, workspaceMembers, currentUserId, onClose, onUpdate, clusters, onClusterCreated }: TaskDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<Task["status"]>("not_started")
  const [priority, setPriority] = useState<Task["priority"]>("medium")
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState("")
  const [startDate, setStartDate] = useState("")
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || "")
      setStatus(task.status)
      setPriority(task.priority)
      setAssigneeId(task.assignee_id)
      setDueDate(task.due_date || "")
      setStartDate(task.start_date || "")
      setSelectedGroupId(groupId)
      setSelectedClusterId(task.task_cluster_id || null)
    }
  }, [task, groupId])

  const handleStatusChange = (newStatus: Task["status"]) => {
    setStatus(newStatus)

    // Find appropriate group based on status
    const statusToGroupMapping: Record<string, string[]> = {
      not_started: ["To Do", "Scheduled", "Backlog"],
      in_progress: ["In Progress", "Working", "Active"],
      done: ["Done", "Completed", "Finished"],
      stuck: ["Stuck", "Blocked", "On Hold"],
    }

    const targetGroupNames = statusToGroupMapping[newStatus] || []
    const targetGroup = groups.find((g) =>
      targetGroupNames.some((name) => g.name.toLowerCase().includes(name.toLowerCase())),
    )

    if (targetGroup) {
      setSelectedGroupId(targetGroup.id)
    }
  }

  const handleSave = async () => {
    if (!task || !title.trim()) return

    setIsLoading(true)
    const supabase = createClient()

    const newGroupId = selectedGroupId || task.group_id

    const updates = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      assignee_id: assigneeId,
      due_date: dueDate || null,
      start_date: startDate || null,
      group_id: newGroupId,
      task_cluster_id: selectedClusterId,
    }

    const { data: updatedTask, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", task.id)
      .select("*, assignee:profiles(*), task_clusters(*)")
      .single()

    if (error) {
      console.error("Error updating task:", error)
      setIsLoading(false)
      return
    }

    onUpdate(updatedTask, newGroupId !== groupId ? newGroupId : undefined)
    setIsLoading(false)
    onClose()
  }

  if (!task) return null

  return (
    <Dialog open={!!task} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => handleStatusChange(v as Task["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="stuck">Stuck</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Group</Label>
            <Select value={selectedGroupId || ""} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Cluster</Label>
            <ClusterSelector
              boardId={task.board_id}
              clusters={clusters}
              selectedClusterId={selectedClusterId}
              onSelect={setSelectedClusterId}
              onClusterCreated={onClusterCreated}
            />
          </div>

          <div className="grid gap-2">
            <Label>Assignee</Label>
            <Select
              value={assigneeId || "unassigned"}
              onValueChange={(v) => setAssigneeId(v === "unassigned" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {workspaceMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profiles?.full_name || member.profiles?.email || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Comments Section */}
          {currentUserId && task && (
            <>
              <Separator className="my-4" />
              <TaskComments taskId={task.id} currentUserId={currentUserId} />
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !title.trim()}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
