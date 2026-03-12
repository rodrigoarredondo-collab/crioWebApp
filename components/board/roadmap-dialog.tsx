"use client"

import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapIcon, Plus, Trash2 } from "lucide-react"
import type { Group, Task, WorkspaceMember, TaskCluster } from "@/lib/types"
import { ClusterSelector } from "@/components/board/cluster-selector"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface RoadmapActivity {
    id: string
    name: string
    description: string
    startDate: string
    startTime: string
    dueDate: string
    dueTime: string
    assigneeIds: string[]
    importance: Task["priority"]
    clusterId: string | null
}

interface RoadmapDialogProps {
    boardId: string
    groups: (Group & { tasks: Task[] })[]
    workspaceMembers: WorkspaceMember[]
    onActivitiesCreated: (tasks: Task[]) => void
    clusters?: TaskCluster[]
}

const generateId = () => Math.random().toString(36).substr(2, 9)

const createEmptyActivity = (): RoadmapActivity => ({
    id: generateId(),
    name: "",
    description: "",
    startDate: "",
    startTime: "",
    dueDate: "",
    dueTime: "",
    assigneeIds: [],
    importance: "medium",
    clusterId: null,
})

const COLUMN_WIDTHS = {
    rowNum: 40,
    name: 200,
    description: 250,
    startDate: 180,
    dueDate: 180,
    assignees: 180,
    importance: 120,
    cluster: 150,
    actions: 50,
}

export function RoadmapDialog({
    boardId,
    groups,
    workspaceMembers,
    onActivitiesCreated,
    clusters = [],
}: RoadmapDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [activities, setActivities] = useState<RoadmapActivity[]>([
        createEmptyActivity(),
        createEmptyActivity(),
        createEmptyActivity(),
    ])
    const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null)

    const scheduledGroup = groups.find((g) => g.name === "Scheduled") || groups[0]

    const handleAddRow = () => {
        setActivities([...activities, createEmptyActivity()])
    }

    const handleRemoveRow = (id: string) => {
        if (activities.length > 1) {
            setActivities(activities.filter((a) => a.id !== id))
        }
    }

    const handleUpdateActivity = (id: string, field: keyof RoadmapActivity, value: any) => {
        setActivities(
            activities.map((a) => (a.id === id ? { ...a, [field]: value } : a))
        )
    }

    const toggleAssignee = (activityId: string, userId: string) => {
        const activity = activities.find((a) => a.id === activityId)
        if (!activity) return

        const newAssigneeIds = activity.assigneeIds.includes(userId)
            ? activity.assigneeIds.filter((id) => id !== userId)
            : [...activity.assigneeIds, userId]

        handleUpdateActivity(activityId, "assigneeIds", newAssigneeIds)
    }

    const getAssigneeDisplay = (assigneeIds: string[]) => {
        if (assigneeIds.length === 0) return null
        const names = assigneeIds.map((id) => {
            const member = workspaceMembers.find((m) => m.user_id === id)
            const name = member?.profiles?.full_name || member?.profiles?.email || "Unknown"
            return name.split(" ")[0]
        })
        if (names.length <= 2) return names.join(", ")
        return `${names.slice(0, 2).join(", ")} +${names.length - 2}`
    }

    const handleSaveAll = async () => {
        const validActivities = activities.filter((a) => a.name.trim() && a.dueDate)
        if (validActivities.length === 0 || !scheduledGroup) return

        setIsLoading(true)
        const supabase = createClient()

        try {
            const tasksToCreate = validActivities.map((activity, index) => {
                const startDateTime = activity.startDate
                    ? `${activity.startDate}${activity.startTime ? `T${activity.startTime}` : ""}`
                    : null
                const dueDateTime = `${activity.dueDate}${activity.dueTime ? `T${activity.dueTime}` : ""}`

                return {
                    board_id: boardId,
                    group_id: scheduledGroup.id,
                    title: activity.name.trim(),
                    description: activity.description.trim() || null,
                    status: "not_started" as const,
                    priority: activity.importance,
                    start_date: startDateTime,
                    due_date: dueDateTime,
                    position: index,
                    assignee_id: activity.assigneeIds[0] || null,
                    task_cluster_id: activity.clusterId,
                }
            })

            const { data: tasks, error: tasksError } = await supabase
                .from("tasks")
                .insert(tasksToCreate)
                .select("*, assignee:profiles(*)")

            if (tasksError) throw tasksError

            // Create task_assignees entries for all assignees
            const assigneesToCreate = validActivities.flatMap((activity, index) =>
                activity.assigneeIds.map((userId) => ({
                    task_id: tasks[index].id,
                    user_id: userId,
                }))
            )

            if (assigneesToCreate.length > 0) {
                const { error: assigneesError } = await supabase
                    .from("task_assignees")
                    .insert(assigneesToCreate)

                if (assigneesError) {
                    console.error("Error creating task assignees:", assigneesError)
                }
            }

            onActivitiesCreated(tasks)
            setIsOpen(false)
            setActivities([createEmptyActivity(), createEmptyActivity(), createEmptyActivity()])
        } catch (error) {
            console.error("Error creating roadmap activities:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const validCount = activities.filter((a) => a.name.trim() && a.dueDate).length

    const cellClass = (row: number, col: string) => `
    border border-[#e1e3e6] dark:border-[#3d4043] bg-white dark:bg-[#202124]
    ${selectedCell?.row === row && selectedCell?.col === col
            ? 'ring-2 ring-[#1a73e8] ring-inset z-10'
            : 'hover:bg-[#f8f9fa] dark:hover:bg-[#292a2d]'}
  `

    const headerCellClass = `
    bg-[#f8f9fa] dark:bg-[#292a2d] border border-[#e1e3e6] dark:border-[#3d4043]
    text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wide
    px-2 py-1.5 text-left select-none
  `

    const inputClass = `
    w-full h-full bg-transparent border-none outline-none px-2 py-1.5
    text-[13px] text-[#202124] dark:text-[#e8eaed]
    placeholder:text-[#9aa0a6] dark:placeholder:text-[#5f6368]
  `

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <MapIcon className="h-4 w-4" />
                    Configure Roadmap
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <MapIcon className="h-5 w-5 text-primary" />
                        Activity Roadmap
                    </DialogTitle>
                    <DialogDescription>
                        Fill in the cells below. Name and Due Date are required.
                    </DialogDescription>
                </DialogHeader>

                {/* Excel-like Spreadsheet */}
                <div className="flex-1 overflow-hidden p-5">
                    <ScrollArea className="h-[50vh]">
                        <div className="min-w-max">
                            {/* Header Row */}
                            <div className="flex sticky top-0 z-20">
                                <div className={headerCellClass} style={{ width: COLUMN_WIDTHS.rowNum, minWidth: COLUMN_WIDTHS.rowNum }}>#</div>
                                <div className={headerCellClass} style={{ width: COLUMN_WIDTHS.name, minWidth: COLUMN_WIDTHS.name }}>Activity Name *</div>
                                <div className={headerCellClass} style={{ width: COLUMN_WIDTHS.description, minWidth: COLUMN_WIDTHS.description }}>Description</div>
                                <div className={headerCellClass} style={{ width: COLUMN_WIDTHS.startDate, minWidth: COLUMN_WIDTHS.startDate }}>Start Date & Time</div>
                                <div className={headerCellClass} style={{ width: COLUMN_WIDTHS.dueDate, minWidth: COLUMN_WIDTHS.dueDate }}>Due Date & Time *</div>
                                <div className={headerCellClass} style={{ width: COLUMN_WIDTHS.assignees, minWidth: COLUMN_WIDTHS.assignees }}>Assignees</div>
                                <div className={headerCellClass} style={{ width: COLUMN_WIDTHS.importance, minWidth: COLUMN_WIDTHS.importance }}>Importance</div>
                                <div className={headerCellClass} style={{ width: COLUMN_WIDTHS.cluster, minWidth: COLUMN_WIDTHS.cluster }}>Cluster</div>
                                <div className={headerCellClass} style={{ width: COLUMN_WIDTHS.actions, minWidth: COLUMN_WIDTHS.actions }}></div>
                            </div>

                            {/* Data Rows */}
                            {activities.map((activity, rowIndex) => (
                                <div key={activity.id} className="flex">
                                    {/* Row Number */}
                                    <div
                                        className={`${headerCellClass} flex items-center justify-center`}
                                        style={{ width: COLUMN_WIDTHS.rowNum, minWidth: COLUMN_WIDTHS.rowNum }}
                                    >
                                        {rowIndex + 1}
                                    </div>

                                    {/* Activity Name */}
                                    <div
                                        className={cellClass(rowIndex, 'name')}
                                        style={{ width: COLUMN_WIDTHS.name, minWidth: COLUMN_WIDTHS.name }}
                                        onClick={() => setSelectedCell({ row: rowIndex, col: 'name' })}
                                    >
                                        <input
                                            type="text"
                                            className={inputClass}
                                            placeholder="Enter activity name..."
                                            value={activity.name}
                                            onChange={(e) => handleUpdateActivity(activity.id, "name", e.target.value)}
                                        />
                                    </div>

                                    {/* Description */}
                                    <div
                                        className={cellClass(rowIndex, 'description')}
                                        style={{ width: COLUMN_WIDTHS.description, minWidth: COLUMN_WIDTHS.description }}
                                        onClick={() => setSelectedCell({ row: rowIndex, col: 'description' })}
                                    >
                                        <input
                                            type="text"
                                            className={inputClass}
                                            placeholder="Optional description..."
                                            value={activity.description}
                                            onChange={(e) => handleUpdateActivity(activity.id, "description", e.target.value)}
                                        />
                                    </div>

                                    {/* Start Date & Time */}
                                    <div
                                        className={cellClass(rowIndex, 'startDate')}
                                        style={{ width: COLUMN_WIDTHS.startDate, minWidth: COLUMN_WIDTHS.startDate }}
                                        onClick={() => setSelectedCell({ row: rowIndex, col: 'startDate' })}
                                    >
                                        <div className="flex items-center gap-1 px-1">
                                            <input
                                                type="date"
                                                className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#202124] dark:text-[#e8eaed]"
                                                value={activity.startDate}
                                                onChange={(e) => handleUpdateActivity(activity.id, "startDate", e.target.value)}
                                            />
                                            {activity.startDate && (
                                                <input
                                                    type="time"
                                                    className="w-20 bg-transparent border-none outline-none text-[12px] text-[#5f6368] dark:text-[#9aa0a6]"
                                                    value={activity.startTime}
                                                    onChange={(e) => handleUpdateActivity(activity.id, "startTime", e.target.value)}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Due Date & Time */}
                                    <div
                                        className={cellClass(rowIndex, 'dueDate')}
                                        style={{ width: COLUMN_WIDTHS.dueDate, minWidth: COLUMN_WIDTHS.dueDate }}
                                        onClick={() => setSelectedCell({ row: rowIndex, col: 'dueDate' })}
                                    >
                                        <div className="flex items-center gap-1 px-1">
                                            <input
                                                type="date"
                                                className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#202124] dark:text-[#e8eaed]"
                                                value={activity.dueDate}
                                                onChange={(e) => handleUpdateActivity(activity.id, "dueDate", e.target.value)}
                                            />
                                            {activity.dueDate && (
                                                <input
                                                    type="time"
                                                    className="w-20 bg-transparent border-none outline-none text-[12px] text-[#5f6368] dark:text-[#9aa0a6]"
                                                    value={activity.dueTime}
                                                    onChange={(e) => handleUpdateActivity(activity.id, "dueTime", e.target.value)}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Assignees */}
                                    <div
                                        className={cellClass(rowIndex, 'assignees')}
                                        style={{ width: COLUMN_WIDTHS.assignees, minWidth: COLUMN_WIDTHS.assignees }}
                                        onClick={() => setSelectedCell({ row: rowIndex, col: 'assignees' })}
                                    >
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button className="w-full h-full text-left px-2 py-1.5 text-[13px]">
                                                    {activity.assigneeIds.length === 0 ? (
                                                        <span className="text-[#9aa0a6] dark:text-[#5f6368]">Select assignees...</span>
                                                    ) : (
                                                        <span className="text-[#202124] dark:text-[#e8eaed]">
                                                            {getAssigneeDisplay(activity.assigneeIds)}
                                                        </span>
                                                    )}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-60 p-2" align="start">
                                                <div className="space-y-1">
                                                    {workspaceMembers.map((member) => {
                                                        const isSelected = activity.assigneeIds.includes(member.user_id)
                                                        return (
                                                            <div
                                                                key={member.user_id}
                                                                className="flex items-center gap-2 cursor-pointer hover:bg-accent rounded px-2 py-1.5"
                                                                onClick={() => toggleAssignee(activity.id, member.user_id)}
                                                            >
                                                                <Checkbox checked={isSelected} className="h-4 w-4" />
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarFallback className="text-xs">
                                                                        {(member.profiles?.full_name || member.profiles?.email || "U")[0].toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span className="text-sm truncate">
                                                                    {member.profiles?.full_name || member.profiles?.email || "Unknown"}
                                                                </span>
                                                            </div>
                                                        )
                                                    })}
                                                    {workspaceMembers.length === 0 && (
                                                        <p className="text-xs text-muted-foreground p-2">No members available</p>
                                                    )}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Importance */}
                                    <div
                                        className={cellClass(rowIndex, 'importance')}
                                        style={{ width: COLUMN_WIDTHS.importance, minWidth: COLUMN_WIDTHS.importance }}
                                        onClick={() => setSelectedCell({ row: rowIndex, col: 'importance' })}
                                    >
                                        <Select
                                            value={activity.importance}
                                            onValueChange={(v) => handleUpdateActivity(activity.id, "importance", v as Task["priority"])}
                                        >
                                            <SelectTrigger className="h-full border-none shadow-none bg-transparent text-[13px] px-2">
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

                                    {/* Cluster */}
                                    <div
                                        className={cellClass(rowIndex, 'cluster')}
                                        style={{ width: COLUMN_WIDTHS.cluster, minWidth: COLUMN_WIDTHS.cluster }}
                                        onClick={() => setSelectedCell({ row: rowIndex, col: 'cluster' })}
                                    >
                                        <div className="p-1 h-full">
                                            <ClusterSelector
                                                boardId={boardId}
                                                clusters={clusters}
                                                selectedClusterId={activity.clusterId}
                                                onSelect={(id) => handleUpdateActivity(activity.id, "clusterId", id)}
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div
                                        className={`${cellClass(rowIndex, 'actions')} flex items-center justify-center`}
                                        style={{ width: COLUMN_WIDTHS.actions, minWidth: COLUMN_WIDTHS.actions }}
                                    >
                                        <button
                                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-[#9aa0a6] hover:text-red-500 disabled:opacity-30"
                                            onClick={() => handleRemoveRow(activity.id)}
                                            disabled={activities.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Add Row Button */}
                            <div className="flex">
                                <div
                                    className="border border-[#e1e3e6] dark:border-[#3d4043] border-dashed bg-[#f8f9fa] dark:bg-[#292a2d] hover:bg-[#e8f0fe] dark:hover:bg-[#303134] cursor-pointer transition-colors"
                                    style={{ width: Object.values(COLUMN_WIDTHS).reduce((a, b) => a + b, 0) }}
                                    onClick={handleAddRow}
                                >
                                    <div className="flex items-center justify-center gap-2 py-2 text-[13px] text-[#1a73e8] dark:text-[#8ab4f8]">
                                        <Plus className="h-4 w-4" />
                                        Add new row
                                    </div>
                                </div>
                            </div>
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-[#f8f9fa] dark:bg-[#292a2d]">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-sm text-muted-foreground">
                            {validCount} valid {validCount === 1 ? "activity" : "activities"} ready to create
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveAll}
                                disabled={isLoading || validCount === 0}
                                className="bg-[#1a73e8] hover:bg-[#1557b0]"
                            >
                                {isLoading ? "Creating..." : `Create ${validCount} ${validCount === 1 ? "Activity" : "Activities"}`}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
