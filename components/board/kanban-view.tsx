"use client"

import type React from "react"
import { useState, useMemo } from "react"
import type { Group, Task, WorkspaceMember, TaskCluster } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Plus,
  MoreHorizontal,
  GripVertical,
  Calendar,
  User,
  FlaskConical,
  ChevronDown,
  ChevronRight,
  Bell,
  BellOff,
} from "lucide-react"
import { parseISO } from "date-fns"
import { TaskDialog } from "./task-dialog"

interface KanbanViewProps {
  groups: (Group & { tasks: Task[] })[]
  setGroups: React.Dispatch<React.SetStateAction<(Group & { tasks: Task[] })[]>>
  boardId: string
  workspaceMembers: WorkspaceMember[]
  workspaceId: string
  userId: string
  clusters?: TaskCluster[]
  onClusterCreated?: (cluster: TaskCluster) => void
}

export function KanbanView({ groups, setGroups, boardId, workspaceMembers, workspaceId, userId, clusters = [], onClusterCreated }: KanbanViewProps) {
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({})
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [draggedTask, setDraggedTask] = useState<{ task: Task; fromGroupId: string } | null>(null)
  const [expandedOthers, setExpandedOthers] = useState<Record<string, boolean>>({})

  const isTaskDueToday = (task: Task) => {
    if (!task.due_date) return false
    const today = new Date()
    const dueDate = parseISO(task.due_date)

    return (
      dueDate.getFullYear() === today.getFullYear() &&
      dueDate.getMonth() === today.getMonth() &&
      dueDate.getDate() === today.getDate()
    )
  }

  const groupsWithSplitTasks = useMemo(() => {
    return groups.map((group) => ({
      ...group,
      todayTasks: group.tasks.filter(isTaskDueToday),
      otherTasks: group.tasks.filter((t) => !isTaskDueToday(t)),
    }))
  }, [groups])

  const handleAddTask = async (groupId: string) => {
    const title = newTaskTitle[groupId]?.trim()
    if (!title) return

    const supabase = createClient()
    const group = groups.find((g) => g.id === groupId)
    const position = group?.tasks.length || 0

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        group_id: groupId,
        board_id: boardId,
        title,
        position,
      })
      .select("*, assignee:profiles(*)")
      .single()

    if (error) {
      console.error("Error creating task:", error)
      return
    }

    setGroups(groups.map((g) => (g.id === groupId ? { ...g, tasks: [...g.tasks, task] } : g)))
    setNewTaskTitle({ ...newTaskTitle, [groupId]: "" })
    setAddingToGroup(null)
  }

  const handleDragStart = (e: React.DragEvent, task: Task, fromGroupId: string) => {
    setDraggedTask({ task, fromGroupId })
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = async (e: React.DragEvent, toGroupId: string) => {
    e.preventDefault()
    if (!draggedTask || draggedTask.fromGroupId === toGroupId) {
      setDraggedTask(null)
      return
    }

    const supabase = createClient()
    const toGroup = groups.find((g) => g.id === toGroupId)
    const newPosition = toGroup?.tasks.length || 0

    const groupNameLower = toGroup?.name.toLowerCase() || ""
    let newStatus: Task["status"] = draggedTask.task.status

    if (groupNameLower.includes("done") || groupNameLower.includes("completed")) {
      newStatus = "done"
    } else if (groupNameLower.includes("progress") || groupNameLower.includes("working")) {
      newStatus = "in_progress"
    } else if (
      groupNameLower.includes("to do") ||
      groupNameLower.includes("scheduled") ||
      groupNameLower.includes("backlog")
    ) {
      newStatus = "not_started"
    } else if (groupNameLower.includes("stuck") || groupNameLower.includes("blocked")) {
      newStatus = "stuck"
    }

    const { error } = await supabase
      .from("tasks")
      .update({ group_id: toGroupId, position: newPosition, status: newStatus })
      .eq("id", draggedTask.task.id)

    if (error) {
      console.error("Error moving task:", error)
      setDraggedTask(null)
      return
    }

    setGroups(
      groups.map((g) => {
        if (g.id === draggedTask.fromGroupId) {
          return { ...g, tasks: g.tasks.filter((t) => t.id !== draggedTask.task.id) }
        }
        if (g.id === toGroupId) {
          return { ...g, tasks: [...g.tasks, { ...draggedTask.task, group_id: toGroupId, status: newStatus }] }
        }
        return g
      }),
    )

    setDraggedTask(null)
  }

  const handleDeleteTask = async (taskId: string, groupId: string) => {
    const supabase = createClient()
    const { error } = await supabase.from("tasks").delete().eq("id", taskId)

    if (error) {
      console.error("Error deleting task:", error)
      return
    }

    setGroups(groups.map((g) => (g.id === groupId ? { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) } : g)))
  }

  const handleUpdateTask = (updatedTask: Task, newGroupId?: string) => {
    if (newGroupId && selectedGroupId && newGroupId !== selectedGroupId) {
      setGroups(
        groups.map((g) => {
          if (g.id === selectedGroupId) {
            return { ...g, tasks: g.tasks.filter((t) => t.id !== updatedTask.id) }
          }
          if (g.id === newGroupId) {
            return { ...g, tasks: [...g.tasks, updatedTask] }
          }
          return g
        }),
      )
    } else {
      setGroups(
        groups.map((g) => ({
          ...g,
          tasks: g.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
        })),
      )
    }
  }

  const handleToggleNotification = async (e: React.MouseEvent, task: Task, groupId: string) => {
    e.stopPropagation()
    const supabase = createClient()
    const newNotificationEnabled = !task.notification_enabled

    const { error: taskError } = await supabase
      .from("tasks")
      .update({ notification_enabled: newNotificationEnabled })
      .eq("id", task.id)

    if (taskError) {
      console.error("Error updating notification:", taskError)
      return
    }

    if (newNotificationEnabled && task.due_date) {
      const { error: notifError } = await supabase.from("task_notifications").insert({
        task_id: task.id,
        board_id: boardId,
        workspace_id: workspaceId,
        notify_date: task.due_date,
      })
      if (notifError) {
        console.error("Error creating notification:", notifError)
      }
    } else if (!newNotificationEnabled) {
      await supabase.from("task_notifications").delete().eq("task_id", task.id)
    }

    setGroups(
      groups.map((g) =>
        g.id === groupId
          ? {
            ...g,
            tasks: g.tasks.map((t) =>
              t.id === task.id ? { ...t, notification_enabled: newNotificationEnabled } : t,
            ),
          }
          : g,
      ),
    )
  }

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "not_started":
        return "bg-muted text-muted-foreground"
      case "in_progress":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      case "done":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
      case "stuck":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "critical":
        return "bg-red-500"
      case "high":
        return "bg-orange-500"
      case "medium":
        return "bg-yellow-500"
      case "low":
        return "bg-green-500"
      default:
        return "bg-muted"
    }
  }

  const getExperimentTaskLabel = (taskType: Task["task_type"]) => {
    switch (taskType) {
      case "printing":
        return "Printing"
      case "thawing":
        return "Thawing"
      case "data_collection_1":
        return "DC 1"
      case "data_collection_2":
        return "DC 2"
      case "data_collection_3":
        return "DC 3"
      default:
        return null
    }
  }

  const TaskCard = ({ task, groupId }: { task: Task; groupId: string }) => (
    <Card
      key={task.id}
      className="cursor-pointer p-3 transition-shadow hover:shadow-md"
      draggable
      onDragStart={(e) => handleDragStart(e, task, groupId)}
      onClick={() => {
        setSelectedTask(task)
        setSelectedGroupId(groupId)
      }}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-grab text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-card-foreground text-sm">{task.title}</p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 w-6 p-0 ${task.notification_enabled ? "text-primary" : "text-muted-foreground"}`}
                onClick={(e) => handleToggleNotification(e, task, groupId)}
                title={task.notification_enabled ? "Disable notification" : "Enable notification"}
              >
                {task.notification_enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteTask(task.id, groupId)
                    }}
                    className="text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${getPriorityColor(task.priority)}`} />
            <span className={`rounded px-1.5 py-0.5 text-xs ${getStatusColor(task.status)}`}>
              {task.status.replace("_", " ")}
            </span>

            {task.task_type && (
              <span className="flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-xs text-purple-700 dark:text-purple-300">
                <FlaskConical className="h-3 w-3" />
                {getExperimentTaskLabel(task.task_type)}
              </span>
            )}

            {task.task_clusters && (
              <span
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs border"
                style={{
                  borderColor: task.task_clusters.color,
                  color: task.task_clusters.color,
                  backgroundColor: `${task.task_clusters.color}10` // 10% opacity
                }}
              >
                {task.task_clusters.name}
              </span>
            )}

            {task.due_date && (
              <span
                className={`flex items-center gap-1 text-xs ${isTaskDueToday(task) ? "text-primary font-semibold" : "text-muted-foreground"}`}
              >
                <Calendar className="h-3 w-3" />

                {parseISO(task.due_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}

            {task.assignee ? (
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {task.assignee.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/50">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )

  return (
    <>
      <div className="flex h-full gap-4 overflow-x-auto p-6">
        {groupsWithSplitTasks.map((group) => (
          <div
            key={group.id}
            className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, group.id)}
          >
            {/* Group Header */}
            <div className="flex items-center gap-2 p-3">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
              <h3 className="font-semibold text-foreground">{group.name}</h3>
              <span className="ml-auto text-sm text-muted-foreground">{group.tasks.length}</span>
            </div>

            {/* Tasks */}
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {group.todayTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-medium text-primary">Due Today</span>
                    <span className="text-xs text-muted-foreground">({group.todayTasks.length})</span>
                  </div>
                  {group.todayTasks.map((task) => (
                    <TaskCard key={task.id} task={task} groupId={group.id} />
                  ))}
                </div>
              )}

              {group.otherTasks.length > 0 && (
                <Collapsible
                  open={expandedOthers[group.id] ?? false}
                  onOpenChange={(open) => setExpandedOthers({ ...expandedOthers, [group.id]: open })}
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/80 transition-colors">
                      {expandedOthers[group.id] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span>Other Tasks</span>
                      <span className="text-xs">({group.otherTasks.length})</span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {group.otherTasks.map((task) => (
                      <TaskCard key={task.id} task={task} groupId={group.id} />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {group.todayTasks.length === 0 && group.otherTasks.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No tasks yet</p>
              )}
            </div>

            {/* Add Task */}
            <div className="p-2">
              {addingToGroup === group.id ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Task title"
                    value={newTaskTitle[group.id] || ""}
                    onChange={(e) => setNewTaskTitle({ ...newTaskTitle, [group.id]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTask(group.id)
                      if (e.key === "Escape") setAddingToGroup(null)
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAddTask(group.id)}>
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingToGroup(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-muted-foreground"
                  onClick={() => setAddingToGroup(group.id)}
                >
                  <Plus className="h-4 w-4" />
                  Add task
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <TaskDialog
        task={selectedTask}
        groupId={selectedGroupId}
        groups={groups}
        workspaceMembers={workspaceMembers}
        currentUserId={userId}
        onClose={() => {
          setSelectedTask(null)
          setSelectedGroupId(null)
        }}
        onUpdate={handleUpdateTask}
        clusters={clusters}
        onClusterCreated={onClusterCreated}
      />
    </>
  )
}
