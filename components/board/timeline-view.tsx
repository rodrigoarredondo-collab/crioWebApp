"use client"

import type React from "react"
import { useState, useMemo } from "react"
import type { Group, Task, TaskCluster, WorkspaceMember } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { addDays, differenceInDays, format, startOfWeek, eachDayOfInterval, isSameDay, parseISO, min, max, addWeeks } from "date-fns"
import { ChevronDown, ChevronRight, Calendar, Layers } from "lucide-react"
import { TaskDialog } from "./task-dialog"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface TimelineViewProps {
  groups: (Group & { tasks: Task[] })[]
  setGroups: React.Dispatch<React.SetStateAction<(Group & { tasks: Task[] })[]>>
  boardId: string
  workspaceMembers: WorkspaceMember[]
  currentUserId: string
  clusters?: TaskCluster[]
  onClusterCreated?: (cluster: TaskCluster) => void
}

export function TimelineView({ groups, setGroups, workspaceMembers, currentUserId, clusters = [], onClusterCreated }: TimelineViewProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // Calculate timeline range dynamically
  const { startDate, endDate, days } = useMemo(() => {
    const today = new Date()
    let earliest = startOfWeek(today, { weekStartsOn: 1 })
    let latest = addWeeks(earliest, 4) // Default min range

    groups.forEach(g => g.tasks.forEach(t => {
      if (t.start_date) {
        const d = parseISO(t.start_date)
        if (d < earliest) earliest = d
      }
      if (t.due_date) {
        const d = parseISO(t.due_date)
        if (d > latest) latest = d
      }
    }))

    // Add buffer
    latest = addWeeks(latest, 1) // 1 week after final task

    const intervalDays = eachDayOfInterval({ start: earliest, end: latest })
    return { startDate: earliest, endDate: latest, days: intervalDays }
  }, [groups])

  // Flatten tasks for Gantt view
  // We maintain the sort order: Group (Status) -> Position
  const timelineTasks = useMemo(() => {
    return groups.flatMap(g =>
      g.tasks.map(t => ({
        ...t,
        statusName: g.name,
        statusColor: g.color,
        originalGroupId: g.id
      }))
    )
  }, [groups])

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "not_started": return "bg-muted"
      case "in_progress": return "bg-amber-100 dark:bg-amber-900/30"
      case "done": return "bg-emerald-100 dark:bg-emerald-900/30"
      case "stuck": return "bg-red-100 dark:bg-red-900/30"
      default: return "bg-muted"
    }
  }

  const getTaskPosition = (task: Task) => {
    const taskStart = task.start_date ? parseISO(task.start_date) : task.due_date ? parseISO(task.due_date) : null
    const taskEnd = task.due_date ? parseISO(task.due_date) : task.start_date ? parseISO(task.start_date) : null

    if (!taskStart || !taskEnd) return null

    const startDiff = differenceInDays(taskStart, startDate)
    const duration = differenceInDays(taskEnd, taskStart) + 1

    if (startDiff + duration < 0) return null // Totally before

    // Allow off-screen to right, but just clamp left
    const left = Math.max(0, startDiff)
    const displayWidth = Math.max(1, duration) // Minimum 1 day width

    return {
      left: left * COLUMN_WIDTH, // 40px per day column
      width: displayWidth * COLUMN_WIDTH,
    }
  }

  const handleTaskUpdate = (updatedTask: Task, newGroupId?: string) => {
    setGroups((prevGroups) =>
      prevGroups.map((group) => {
        const isTargetGroup = newGroupId ? group.id === newGroupId : group.id === updatedTask.group_id

        // If simply updating (no move)
        if (!newGroupId && group.id === updatedTask.group_id) {
          return { ...group, tasks: group.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) }
        }

        // If moving
        if (newGroupId) {
          if (group.id === newGroupId) {
            const exists = group.tasks.some(t => t.id === updatedTask.id)
            return exists ?
              { ...group, tasks: group.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) } :
              { ...group, tasks: [...group.tasks, updatedTask] }
          }
          if (group.id !== newGroupId && group.tasks.some(t => t.id === updatedTask.id)) {
            return { ...group, tasks: group.tasks.filter(t => t.id !== updatedTask.id) }
          }
        }

        return group
      })
    )
  }

  const COLUMN_WIDTH = 60;
  const HEADER_HEIGHT = 56; // 2 rows of header
  const SIDEBAR_WIDTH = 220;
  const ROW_HEIGHT = 44; // Fixed row height for Gantt

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controls - Minimal Info Only */}
      <div className="flex items-center justify-between p-2 border-b bg-card z-20">
        <div className="text-xs text-muted-foreground font-medium pl-2">
          Timeline
        </div>
        <div className="text-xs text-muted-foreground mr-4">
          {days.length} days view
        </div>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-auto relative">

        {/* Sticky Header Layer */}
        <div
          className="sticky top-0 z-10 flex bg-background border-b"
          style={{ width: "max-content", minWidth: "100%" }}
        >
          {/* Top-Left Corner (Empty/Fixed) */}
          <div
            className="sticky left-0 z-20 bg-background border-r flex items-center px-4 font-semibold text-sm text-foreground"
            style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, height: HEADER_HEIGHT }}
          >
            Tasks
          </div>

          {/* Date Header */}
          <div className="flex">
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`flex-shrink-0 border-r flex flex-col items-center justify-center text-xs ${isSameDay(day, new Date()) ? "bg-accent/50 font-bold" : ""
                  }`}
                style={{ width: COLUMN_WIDTH, height: HEADER_HEIGHT }}
              >
                <span className="text-muted-foreground">{format(day, "EEE")}</span>
                <span>{format(day, "d")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Body */}
        <div className="relative" style={{ width: "max-content", minWidth: "100%" }}>
          {/* Background Grid */}
          <div className="absolute inset-0 flex" style={{ paddingLeft: SIDEBAR_WIDTH }}>
            {days.map((day) => (
              <div
                key={`grid-${day.toISOString()}`}
                className={`flex-shrink-0 border-r h-full ${[0, 6].includes(day.getDay()) ? "bg-muted/20" : ""
                  }`}
                style={{ width: COLUMN_WIDTH }}
              />
            ))}
          </div>

          {/* Rows (Gantt Style) */}
          {/* Rows (Gantt Style) */}
          {Object.entries(
            timelineTasks.reduce((acc, task) => {
              if (!acc[task.title]) acc[task.title] = []
              acc[task.title].push(task)
              return acc
            }, {} as Record<string, typeof timelineTasks>)
          ).map(([title, tasks], index) => {
            return (
              <div key={`${title}-${index}`} className="relative border-b flex group/row hover:bg-muted/10 transition-colors" style={{ height: ROW_HEIGHT }}>
                {/* Sticky Sidebar Cell: Task Name */}
                <div
                  className="sticky left-0 z-[5] flex items-center justify-between px-4 bg-background border-r flex-shrink-0 group-hover/row:bg-muted/100"
                  style={{ width: SIDEBAR_WIDTH, height: "100%" }}
                  title={title}
                >
                  <span className="text-sm font-medium truncate w-full">{title}</span>
                </div>

                {/* Timeline Cell: Bar Container */}
                <div className="flex-1 relative h-full w-full">
                  {tasks.map(task => {
                    const pos = getTaskPosition(task)
                    if (!pos) return null

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "absolute top-2 bottom-2 rounded-sm shadow-sm cursor-pointer flex items-center px-2 overflow-hidden whitespace-nowrap text-xs transition-all hover:brightness-95 hover:z-20",
                          getStatusColor(task.status)
                        )}
                        style={{
                          left: pos.left,
                          width: pos.width,
                          // Border color matches cluster
                          border: `2px solid ${task.task_clusters?.color || 'transparent'}`,
                        }}
                        onClick={() => {
                          setSelectedTask(task)
                          // @ts-ignore
                          setSelectedGroupId(task.originalGroupId)
                        }}
                        title={`${task.title} (${task.statusName})`}
                      >
                        {/* Only show title if it fits and is the first/longest one? Or just hide text since row has title? 
                             Let's keep text for now but it might be redundant. user asked for same row.
                         */}
                        <span className="truncate w-full font-medium" style={{ color: "inherit" }}>
                          {task.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {timelineTasks.length === 0 && (
            <div className="p-8 text-center text-muted-foreground italic sticky left-0 w-full">
              No tasks found
            </div>
          )}
        </div>
      </div>

      <TaskDialog
        task={selectedTask}
        groupId={selectedGroupId}
        groups={groups}
        workspaceMembers={workspaceMembers}
        currentUserId={currentUserId}
        onClose={() => {
          setSelectedTask(null)
          setSelectedGroupId(null)
        }}
        onUpdate={handleTaskUpdate}
        clusters={clusters}
        onClusterCreated={onClusterCreated}
      />
    </div>
  )
}
