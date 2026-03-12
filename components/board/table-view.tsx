"use client"

import type React from "react"
import { useState, useMemo } from "react"
import type { Group, Task, WorkspaceMember } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Plus, ChevronDown, ChevronRight, Trash2, CalendarClock } from "lucide-react"
import { format } from "date-fns"

interface TableViewProps {
  groups: (Group & { tasks: Task[] })[]
  setGroups: React.Dispatch<React.SetStateAction<(Group & { tasks: Task[] })[]>>
  boardId: string
  workspaceMembers: WorkspaceMember[]
}

export function TableView({ groups, setGroups, boardId, workspaceMembers }: TableViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(groups.map((g) => g.id)))
  const [showOtherTasks, setShowOtherTasks] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({})

  const todayStr = format(new Date(), "yyyy-MM-dd")

  const { todayGroups, otherGroups, todayCount, otherCount } = useMemo(() => {
    let todayCount = 0
    let otherCount = 0

    const todayGroups = groups
      .map((g) => {
        const todayTasks = g.tasks.filter((t) => t.due_date === todayStr)
        todayCount += todayTasks.length
        return { ...g, tasks: todayTasks }
      })
      .filter((g) => g.tasks.length > 0)

    const otherGroups = groups
      .map((g) => {
        const otherTasks = g.tasks.filter((t) => t.due_date !== todayStr)
        otherCount += otherTasks.length
        return { ...g, tasks: otherTasks }
      })
      .filter((g) => g.tasks.length > 0)

    return { todayGroups, otherGroups, todayCount, otherCount }
  }, [groups, todayStr])

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }

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
  }

  const handleUpdateTask = async (taskId: string, field: string, value: string | null) => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("tasks")
      .update({ [field]: value })
      .eq("id", taskId)
      .select("*, assignee:profiles(*)")
      .single()

    if (error) {
      console.error("Error updating task:", error)
      return
    }

    setGroups(
      groups.map((g) => ({
        ...g,
        tasks: g.tasks.map((t) => (t.id === taskId ? data : t)),
      })),
    )
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

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "not_started":
        return "bg-muted"
      case "in_progress":
        return "bg-amber-500"
      case "done":
        return "bg-emerald-500"
      case "stuck":
        return "bg-red-500"
      default:
        return "bg-muted"
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

  const renderGroupTable = (groupsToRender: (Group & { tasks: Task[] })[], allowAddTask = true) => (
    <>
      {groupsToRender.map((group) => (
        <div key={group.id} className="mb-6">
          <button
            type="button"
            className="mb-2 flex items-center gap-2 rounded px-2 py-1 hover:bg-accent"
            onClick={() => toggleGroup(group.id)}
          >
            {expandedGroups.has(group.id) ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="h-3 w-3 rounded" style={{ backgroundColor: group.color }} />
            <span className="font-semibold text-foreground">{group.name}</span>
            <span className="text-sm text-muted-foreground">({group.tasks.length})</span>
          </button>

          {expandedGroups.has(group.id) && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[300px]">Task</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[120px]">Priority</TableHead>
                    <TableHead className="w-[150px]">Assignee</TableHead>
                    <TableHead className="w-[130px]">Due Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Input
                          className="border-0 bg-transparent px-0 focus-visible:ring-0"
                          value={task.title}
                          onChange={(e) => handleUpdateTask(task.id, "title", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={task.status} onValueChange={(v) => handleUpdateTask(task.id, "status", v)}>
                          <SelectTrigger className="border-0 bg-transparent">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${getStatusColor(task.status)}`} />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">Not Started</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                            <SelectItem value="stuck">Stuck</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={task.priority} onValueChange={(v) => handleUpdateTask(task.id, "priority", v)}>
                          <SelectTrigger className="border-0 bg-transparent">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${getPriorityColor(task.priority)}`} />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.assignee_id || "unassigned"}
                          onValueChange={(v) => handleUpdateTask(task.id, "assignee_id", v === "unassigned" ? null : v)}
                        >
                          <SelectTrigger className="border-0 bg-transparent">
                            <div className="flex items-center gap-2">
                              {task.assignee ? (
                                <>
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                      {task.assignee.full_name
                                        ?.split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .toUpperCase() || "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{task.assignee.full_name}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">Unassigned</span>
                              )}
                            </div>
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
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className="border-0 bg-transparent px-0 focus-visible:ring-0"
                          value={task.due_date || ""}
                          onChange={(e) => handleUpdateTask(task.id, "due_date", e.target.value || null)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteTask(task.id, group.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {allowAddTask && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Add new task..."
                            className="border-0 bg-transparent px-0 focus-visible:ring-0"
                            value={newTaskTitle[group.id] || ""}
                            onChange={(e) => setNewTaskTitle({ ...newTaskTitle, [group.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddTask(group.id)
                            }}
                          />
                          {newTaskTitle[group.id]?.trim() && (
                            <Button size="sm" onClick={() => handleAddTask(group.id)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ))}
    </>
  )

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Due Today</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">
            {todayCount} {todayCount === 1 ? "task" : "tasks"}
          </span>
        </div>

        {todayGroups.length > 0 ? (
          renderGroupTable(todayGroups, false)
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
            <p className="text-muted-foreground">No tasks due today</p>
          </div>
        )}
      </div>

      {otherCount > 0 && (
        <Collapsible open={showOtherTasks} onOpenChange={setShowOtherTasks}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="mb-4 w-full justify-between bg-transparent">
              <span className="flex items-center gap-2">
                {showOtherTasks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Other Tasks
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground">
                {otherCount} {otherCount === 1 ? "task" : "tasks"}
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>{renderGroupTable(otherGroups, true)}</CollapsibleContent>
        </Collapsible>
      )}

      {/* Show all groups for adding tasks if no tasks exist */}
      {todayCount === 0 && otherCount === 0 && (
        <>
          {groups.map((group) => (
            <div key={group.id} className="mb-6">
              <button
                type="button"
                className="mb-2 flex items-center gap-2 rounded px-2 py-1 hover:bg-accent"
                onClick={() => toggleGroup(group.id)}
              >
                {expandedGroups.has(group.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="h-3 w-3 rounded" style={{ backgroundColor: group.color }} />
                <span className="font-semibold text-foreground">{group.name}</span>
                <span className="text-sm text-muted-foreground">(0)</span>
              </button>

              {expandedGroups.has(group.id) && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[300px]">Task</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[120px]">Priority</TableHead>
                        <TableHead className="w-[150px]">Assignee</TableHead>
                        <TableHead className="w-[130px]">Due Date</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Add new task..."
                              className="border-0 bg-transparent px-0 focus-visible:ring-0"
                              value={newTaskTitle[group.id] || ""}
                              onChange={(e) => setNewTaskTitle({ ...newTaskTitle, [group.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddTask(group.id)
                              }}
                            />
                            {newTaskTitle[group.id]?.trim() && (
                              <Button size="sm" onClick={() => handleAddTask(group.id)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
