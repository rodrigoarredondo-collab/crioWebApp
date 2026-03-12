"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { format, parseISO, isSameDay } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Circle, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { Task } from "@/lib/types"

interface DailyTasksProps {
    userId: string
}

export function DailyTasks({ userId }: DailyTasksProps) {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchTasks = async () => {
            const supabase = createClient()
            const today = new Date()

            // Fetch tasks assigned to user that are not done
            const { data, error } = await supabase
                .from("tasks")
                .select(`
                    *,
                    board:boards(id, name, color, workspace_id),
                    group:groups(id, name, color)
                `)
                .eq("assignee_id", userId)
                .neq("status", "done")
                .order("due_date", { ascending: true })
            console.log(data)
            if (error) {
                console.error("Error fetching daily tasks:", error)
                setLoading(false)
                return
            }

            // Filter for tasks relevant to "Today"
            const todaysTasks = (data || []).filter((task) => {
                if (!task.due_date && !task.start_date) return false

                const dueDate = task.due_date ? parseISO(task.due_date) : null
                const startDate = task.start_date ? parseISO(task.start_date) : null

                // Check if due today
                if (dueDate && isSameDay(dueDate, today)) return true

                // Check if start today
                if (startDate && isSameDay(startDate, today)) return true

                return false
            })
            
            setTasks(todaysTasks)
            setLoading(false)
        }

        fetchTasks()
    }, [userId])

    if (loading) {
        return (
            <Card className="glass h-full">
                <CardHeader>
                    <CardTitle className="text-lg font-medium">My Day</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 animate-pulse">
                                <div className="h-4 w-4 rounded-full bg-muted" />
                                <div className="h-4 w-full rounded bg-muted" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="glass h-[53vh] border-primary/20 bg-primary/5 overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Today tasks
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                        {format(new Date(), "EEEE, MMM d")}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[100%]">
                {tasks.length === 0 ? (
                    <div className="min-h-[100%] flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                        <CheckCircle2 className="h-10 w-10 mb-2 opacity-20" />
                        <p>No tasks scheduled for today</p>
                        <p className="text-xs mt-1">Keep working hard!</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {tasks.map((task) => (
                            <div
                                key={task.id}
                                className="group flex items-center gap-3 rounded-lg p-2 hover:bg-white/5 transition-colors border border-transparent hover:border-border/50"
                            >
                                <div className={`mt-0.5 ${task.status === "in_progress" ? "text-amber-500" : "text-muted-foreground"}`}>
                                    {task.status === "in_progress" ? <Clock className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        {(task as any).board && (
                                            <span className="flex items-center gap-1">
                                                <span
                                                    className="h-1.5 w-1.5 rounded-full"
                                                    style={{ backgroundColor: (task as any).board.color || 'var(--primary)' }}
                                                />
                                                {(task as any).board.name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                    <Link href={`dashboard/workspace/${(task as any).board?.workspace_id}/board/${task.board_id}`}>
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
