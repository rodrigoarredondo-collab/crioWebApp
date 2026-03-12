"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Check, CalendarIcon, User, Layers, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import type { TaskCluster, WorkspaceMember } from "@/lib/types"

export interface FilterState {
    dateRange: DateRange | undefined
    assigneeIds: string[]
    clusterIds: string[]
}

interface TaskFiltersProps {
    filters: FilterState
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>
    workspaceMembers: WorkspaceMember[]
    clusters: TaskCluster[]
}

export function TaskFilters({ filters, setFilters, workspaceMembers, clusters }: TaskFiltersProps) {
    const [isOpen, setIsOpen] = useState(false)

    const handleDateRangeSelect = (range: DateRange | undefined) => {
        setFilters((prev) => ({ ...prev, dateRange: range }))
    }

    const toggleAssignee = (userId: string) => {
        setFilters((prev) => {
            const isSelected = prev.assigneeIds.includes(userId)
            if (isSelected) {
                return { ...prev, assigneeIds: prev.assigneeIds.filter((id) => id !== userId) }
            } else {
                return { ...prev, assigneeIds: [...prev.assigneeIds, userId] }
            }
        })
    }

    const toggleCluster = (clusterId: string) => {
        setFilters((prev) => {
            const isSelected = prev.clusterIds.includes(clusterId)
            if (isSelected) {
                return { ...prev, clusterIds: prev.clusterIds.filter((id) => id !== clusterId) }
            } else {
                return { ...prev, clusterIds: [...prev.clusterIds, clusterId] }
            }
        })
    }

    const clearFilters = () => {
        setFilters({
            dateRange: undefined,
            assigneeIds: [],
            clusterIds: [],
        })
        setIsOpen(false)
    }

    const activeFilterCount =
        (filters.dateRange ? 1 : 0) + filters.assigneeIds.length + filters.clusterIds.length

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-dashed">
                    <Layers className="mr-2 h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <>
                            <Separator orientation="vertical" className="mx-2 h-4" />
                            <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                                {activeFilterCount}
                            </Badge>
                            <div className="hidden space-x-1 lg:flex">
                                {activeFilterCount > 2 ? (
                                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                        {activeFilterCount} selected
                                    </Badge>
                                ) : (
                                    <>
                                        {filters.dateRange && (
                                            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                                Date Range
                                            </Badge>
                                        )}
                                        {filters.assigneeIds.length > 0 && (
                                            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                                {filters.assigneeIds.length} Assignees
                                            </Badge>
                                        )}
                                        {filters.clusterIds.length > 0 && (
                                            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                                {filters.clusterIds.length} Clusters
                                            </Badge>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0 h-[80vh] overflow-y-auto scrollbar-hide" align="start">
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium leading-none">Filter Tasks</h4>
                        {activeFilterCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-muted-foreground hover:text-primary">
                                Reset
                            </Button>
                        )}
                    </div>

                    <Separator />

                    {/* Date Range Filter */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <CalendarIcon className="h-4 w-4" />
                            <span>Due Date Range</span>
                        </div>
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={filters.dateRange?.from}
                            selected={filters.dateRange}
                            onSelect={handleDateRangeSelect}
                            numberOfMonths={1}
                            className="rounded-md border"
                        />
                    </div>

                    <Separator />

                    {/* Cluster Filter */}
                    {clusters.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Layers className="h-4 w-4" />
                                <span>Clusters</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {clusters.map(cluster => (
                                    <Badge
                                        key={cluster.id}
                                        variant={filters.clusterIds.includes(cluster.id) ? "default" : "outline"}
                                        className="cursor-pointer"
                                        style={filters.clusterIds.includes(cluster.id) ? { backgroundColor: cluster.color } : { borderColor: cluster.color, color: cluster.color }}
                                        onClick={() => toggleCluster(cluster.id)}
                                    >
                                        {cluster.name}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Assignee Filter */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>Assignees</span>
                        </div>
                        <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto">
                            {workspaceMembers.map(member => (
                                <div
                                    key={member.user_id}
                                    className={cn(
                                        "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted",
                                        filters.assigneeIds.includes(member.user_id) && "bg-muted"
                                    )}
                                    onClick={() => toggleAssignee(member.user_id)}
                                >
                                    <div
                                        className={cn(
                                            "flex h-4 w-4 items-center justify-center rounded border border-primary",
                                            filters.assigneeIds.includes(member.user_id) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                        )}
                                    >
                                        <Check className={cn("h-3 w-3")} />
                                    </div>
                                    <span>{member.profiles?.full_name || member.profiles?.email || "Unknown User"}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </PopoverContent>
        </Popover>
    )
}
