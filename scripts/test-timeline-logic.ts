
import { startOfWeek, addWeeks, parseISO, eachDayOfInterval, format } from "date-fns"

// Mock Types
type Task = {
    id: string
    start_date: string | null
    due_date: string | null
}
type Group = {
    tasks: Task[]
}

// Logic extracted from TimelineView
function calculateTimelineRange(groups: Group[]) {
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

    return { earliest, latest }
}

// Tests
console.log("Running Timeline Date Range Logic Tests...")
const today = new Date()
const nextWeek = addWeeks(today, 1)
const inTwoMonths = addWeeks(today, 8)

const testCases = [
    {
        name: "Default (No Tasks)",
        groups: [{ tasks: [] }],
        expectedDurationMinWeeks: 5 // 4 weeks min + 1 buffer
    },
    {
        name: "Task in future",
        groups: [{ tasks: [{ id: "1", start_date: null, due_date: inTwoMonths.toISOString() }] }],
        expectedEndAfter: inTwoMonths
    }
]

testCases.forEach((tc, i) => {
    console.log(`Test ${i + 1}: ${tc.name}`)
    const result = calculateTimelineRange(tc.groups)
    console.log(`  Start: ${format(result.earliest, "yyyy-MM-dd")}`)
    console.log(`  End:   ${format(result.latest, "yyyy-MM-dd")}`)

    if (tc.expectedEndAfter) {
        if (result.latest > tc.expectedEndAfter) console.log("  PASS: End date extended correctly")
        else console.error("  FAIL: End date too early")
    }
})
console.log("Done.")
