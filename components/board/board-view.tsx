"use client"

import { useState } from "react"
import Link from "next/link"
import type { Board, Group, Task, Workspace, WorkspaceMember, ViewMode } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, LayoutGrid, Table, GanttChart, FlaskConical } from "lucide-react"
import { KanbanView } from "./kanban-view"
import { TableView } from "./table-view"
import { TimelineView } from "./timeline-view"
import { StartExperimentDialog } from "./start-experiment-dialog"
import { RoadmapDialog } from "./roadmap-dialog"
import type { Experiment, TaskCluster } from "@/lib/types"
import { getTaskClusters } from "@/lib/api/clusters"
import { TaskFilters, type FilterState } from "./task-filters"
import { parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { useMemo, useEffect } from "react"

interface BoardViewProps {
  board: Board & { groups: (Group & { tasks: Task[] })[] }
  workspace: Workspace & { workspace_members: WorkspaceMember[] }
  userId: string
}

export function BoardView({ board, workspace, userId }: BoardViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("board")
  const [groups, setGroups] = useState(board.groups)
  const [clusters, setClusters] = useState<TaskCluster[]>([])
  const [filters, setFilters] = useState<FilterState>({
    dateRange: undefined,
    assigneeIds: [],
    clusterIds: [],
  })

  useEffect(() => {
    getTaskClusters(board.id).then(setClusters)
  }, [board.id])

  const filteredGroups = useMemo(() => {
    return groups.map((group) => ({
      ...group,
      tasks: group.tasks.filter((task) => {
        // Filter by assignee
        if (filters.assigneeIds.length > 0 && (!task.assignee_id || !filters.assigneeIds.includes(task.assignee_id))) {
          return false
        }

        // Filter by cluster
        if (filters.clusterIds.length > 0 && (!task.task_cluster_id || !filters.clusterIds.includes(task.task_cluster_id))) {
          return false
        }

        // Filter by date range
        if (filters.dateRange?.from) {
          if (!task.due_date) return false // tasks without due dates are hidden when date filter is active (optional choice)

          const dueDate = parseISO(task.due_date)
          const start = startOfDay(filters.dateRange.from)
          const end = filters.dateRange.to ? endOfDay(filters.dateRange.to) : endOfDay(filters.dateRange.from)

          if (!isWithinInterval(dueDate, { start, end })) {
            return false
          }
        }

        return true
      }),
    }))
  }, [groups, filters])

  const handleExperimentCreated = (tasks: Task[], experiment: Experiment) => {
    setGroups((prevGroups) =>
      prevGroups.map((group) => {
        const newTasksForGroup = tasks.filter((t) => t.group_id === group.id)
        if (newTasksForGroup.length > 0) {
          return { ...group, tasks: [...group.tasks, ...newTasksForGroup] }
        }
        return group
      }),
    )
  }

  const handleRoadmapActivitiesCreated = (tasks: Task[]) => {
    setGroups((prevGroups) =>
      prevGroups.map((group) => {
        const newTasksForGroup = tasks.filter((t) => t.group_id === group.id)
        if (newTasksForGroup.length > 0) {
          return { ...group, tasks: [...group.tasks, ...newTasksForGroup] }
        }
        return group
      }),
    )
  }

  const handleClusterCreated = (newCluster: TaskCluster) => {
    setClusters([...clusters, newCluster])
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/workspace/${workspace.id}`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: board.color }} />
                <h1 className="text-xl font-bold text-card-foreground">{board.name}</h1>
                {board.board_type === "experiment" && (
                  <span className="flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300">
                    <FlaskConical className="h-3 w-3" />
                    Experiment
                  </span>
                )}
              </div>
              {board.description && <p className="mt-1 text-sm text-muted-foreground">{board.description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Roadmap Dialog - available for all board types, placed LEFT of I Printed Today */}
            <RoadmapDialog
              boardId={board.id}
              groups={groups}
              workspaceMembers={workspace.workspace_members}
              onActivitiesCreated={handleRoadmapActivitiesCreated}
              clusters={clusters}
            />

            <TaskFilters
              filters={filters}
              setFilters={setFilters}
              workspaceMembers={workspace.workspace_members}
              clusters={clusters}
            />

            {board.board_type === "experiment" && (
              <StartExperimentDialog
                boardId={board.id}
                groups={groups}
                workspaceId={workspace.id}
                onExperimentCreated={handleExperimentCreated}
              />
            )}

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="board" className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="table" className="gap-2">
                  <Table className="h-4 w-4" />
                  Table
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2">
                  <GanttChart className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "board" && (
          <KanbanView
            groups={filteredGroups}
            setGroups={setGroups}
            boardId={board.id}
            workspaceMembers={workspace.workspace_members}
            workspaceId={workspace.id}
            userId={userId}
            clusters={clusters}
            onClusterCreated={handleClusterCreated}
          />
        )}
        {viewMode === "table" && (
          <TableView
            groups={filteredGroups}
            setGroups={setGroups}
            boardId={board.id}
            workspaceMembers={workspace.workspace_members}
          />
        )}
        {viewMode === "timeline" && (
          <TimelineView
            groups={filteredGroups}
            setGroups={setGroups}
            boardId={board.id}
            workspaceMembers={workspace.workspace_members}
            currentUserId={userId}
            clusters={clusters}
            onClusterCreated={handleClusterCreated}
          />
        )}
      </div>
    </div>
  )
}
