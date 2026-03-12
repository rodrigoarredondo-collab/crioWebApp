"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FlaskConical, Calendar, CheckCircle2, Bell } from "lucide-react"
import { addDays, format } from "date-fns"
import type { Group, Task, Experiment } from "@/lib/types"
import { EXPERIMENT_WORKFLOW } from "@/lib/types"

interface StartExperimentDialogProps {
  boardId: string
  groups: (Group & { tasks: Task[] })[]
  workspaceId: string
  onExperimentCreated: (tasks: Task[], experiment: Experiment) => void
}

export function StartExperimentDialog({
  boardId,
  groups,
  workspaceId,
  onExperimentCreated,
}: StartExperimentDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [experimentName, setExperimentName] = useState("")
  const [printDate, setPrintDate] = useState(format(new Date(), "yyyy-MM-dd"))

  // Find the "Scheduled" group or first group
  const scheduledGroup = groups.find((g) => g.name === "Scheduled") || groups[0]

  const handleStartExperiment = async () => {
    if (!experimentName.trim() || !scheduledGroup) return

    setIsLoading(true)
    const supabase = createClient()

    try {
      // Create experiment record
      const { data: experiment, error: expError } = await supabase
        .from("experiments")
        .insert({
          board_id: boardId,
          name: experimentName.trim(),
          print_date: printDate,
        })
        .select()
        .single()

      if (expError) throw expError

      // Create tasks for each step in the workflow
      // Parse the date strictly as local date (year, month, day) at 00:00:00
      const [year, month, day] = printDate.split("-").map(Number)
      const printDateObj = new Date(year, month - 1, day) // Month is 0-indexed

      const tasksToCreate = EXPERIMENT_WORKFLOW.map((step, index) => {
        const stepDate = addDays(printDateObj, step.dayOffset)
        return {
          board_id: boardId,
          group_id: scheduledGroup.id,
          title: `[${experimentName}] ${step.label}`,
          description: step.description,
          status: step.dayOffset === 0 ? ("done" as const) : ("not_started" as const),
          priority: "high" as const,
          start_date: format(stepDate, "yyyy-MM-dd"),
          due_date: format(stepDate, "yyyy-MM-dd"),
          position: index,
          experiment_id: experiment.id,
          task_type: step.type,
          notification_enabled: true,
        }
      })

      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .insert(tasksToCreate)
        .select("*, assignee:profiles(*)")

      if (tasksError) throw tasksError

      const notificationsToCreate = tasks
        .filter((task) => task.task_type !== "printing")
        .map((task) => ({
          task_id: task.id,
          board_id: boardId,
          workspace_id: workspaceId,
          notify_date: task.due_date,
        }))

      if (notificationsToCreate.length > 0) {
        const { error: notifError } = await supabase.from("task_notifications").insert(notificationsToCreate)
        if (notifError) {
          console.error("Error creating notifications:", notifError)
        }
      }

      onExperimentCreated(tasks, experiment)
      setIsOpen(false)
      setExperimentName("")
      setPrintDate(format(new Date(), "yyyy-MM-dd"))
    } catch (error) {
      console.error("Error creating experiment:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Preview dates
  // Same parsing logic for preview
  const [year, month, day] = printDate.split("-").map(Number)
  const printDateObj = new Date(year, month - 1, day)
  
  const previewDates = EXPERIMENT_WORKFLOW.map((step) => ({
    ...step,
    date: addDays(printDateObj, step.dayOffset),
  }))

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-purple-600 hover:bg-purple-700">
          <FlaskConical className="h-4 w-4" />I Printed Today
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-600" />
            Start New Experiment
          </DialogTitle>
          <DialogDescription>Mark your printing day to automatically schedule all experiment tasks.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="experimentName">Experiment Name</Label>
            <Input
              id="experimentName"
              placeholder="e.g., Batch 001, Sample A"
              value={experimentName}
              onChange={(e) => setExperimentName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="printDate">Printing Date</Label>
            <Input id="printDate" type="date" value={printDate} onChange={(e) => setPrintDate(e.target.value)} />
          </div>

          {/* Preview Schedule */}
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">Scheduled Tasks Preview</h4>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Bell className="h-3 w-3" />
                Email alerts enabled
              </span>
            </div>
            <div className="space-y-2">
              {previewDates.map((step, index) => (
                <div key={step.type} className="flex items-center gap-3">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      index === 0 ? "bg-purple-600 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                    }`}
                  >
                    {index === 0 ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(step.date, "MMM d, yyyy")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleStartExperiment}
            disabled={isLoading || !experimentName.trim()}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? "Creating..." : "Start Experiment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
