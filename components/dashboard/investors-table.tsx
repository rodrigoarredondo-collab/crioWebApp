"use client"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, ExternalLink, Search, ArrowUpDown, Filter, Save, MapPin, CheckCircle2, Calendar as CalendarIcon, X, Plus, Linkedin, Edit2, Mail, FileText, MoreHorizontal, ChevronDown, ChevronRight, Trash2, User } from "lucide-react"
import { formatDistanceToNow, subDays, format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { AddItemDialog } from "./add-item-dialog"
import { StatusCell, StatusEntry } from "./status-cell"

// Define DateRange locally if import fails or type is missing in older react-day-picker versions
type DateRange = {
    from: Date | undefined;
    to?: Date | undefined;
};

interface Venture {
    id: string
    name: string
    description: string
    location: string
    created_at: string
    metadata: {
        website?: string
        [key: string]: any
    }
}

type PointOfContact = {
    type: 'linkedin' | 'email' | 'other'
    name?: string
    value: string
    linkedin?: string // legacy support
    date?: string | null
    contact_link?: string // New field for linked contact URL
}

interface VentureFeedback {
    id: string
    venture_id: string
    rating: boolean | null
    comments: string | null
    contact: StatusEntry[] | null
    status: string | null
    score: number | null
    created_at: string
    updated_at: string
}

interface VentureWithFeedback extends Venture {
    feedback: VentureFeedback[]
}

interface InvestorsTableProps {
    initialData: VentureWithFeedback[]
}

type SortOrder = 'name-asc' | 'name-desc' | 'newest' | 'oldest'
type StatusFilter = 'all' | 'Rejected' | 'Pending' | 'Contacted' | 'Replied' | 'Invested' | 'Meeting'

export function InvestorsTable({ initialData }: InvestorsTableProps) {
    const [data, setData] = useState<VentureWithFeedback[]>(initialData)
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)

    // Filters
    const [searchQuery, setSearchQuery] = useState("")
    const [locationQuery, setLocationQuery] = useState("")
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
    const [date, setDate] = useState<DateRange | undefined>(undefined)
    const [statusFilters, setStatusFilters] = useState<string[]>([])
    const [decisionFilters, setDecisionFilters] = useState<string[]>([])

    // Nth Meeting Dialog State



    const supabase = createClient()

    const activeFilterCount = (locationQuery ? 1 : 0) + (date?.from ? 1 : 0) + (statusFilters.length > 0 ? 1 : 0) + (decisionFilters.length > 0 ? 1 : 0)



    const handleAutosave = async (ventureId: string, updates: Partial<VentureFeedback>) => {
        setIsSaving(true)

        // 1. Optimistic Update
        setData(currentData => {
            const ventureIndex = currentData.findIndex(v => v.id === ventureId)
            if (ventureIndex === -1) return currentData

            const venture = currentData[ventureIndex]
            const currentFeedback = venture.feedback[0] || {
                venture_id: ventureId,
                rating: null,
                comments: null,
                status: null,
                contact: null,
                score: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }

            // Apply updates
            let updatedFeedback = { ...currentFeedback, ...updates, updated_at: new Date().toISOString() }

            // Logic: Auto-set status to "Pending" if Accepted (rating=true) and current status is inactive
            // Check if rating is being updated
            if ('rating' in updates) {
                if (updates.rating === true) {
                    const currentStatus = updatedFeedback.status
                    const activeStages = ['Contacted', 'Replied', 'Meeting', 'Invested', 'Pending']
                    const isActive = activeStages.includes(currentStatus || '') || (currentStatus && currentStatus.toLowerCase().includes('meeting'));

                    if (!isActive) {
                        updatedFeedback.status = 'Pending'
                    }
                } else if (updates.rating === false) {
                    // specific logic for rejection if any
                }
            }

            const newVenture = {
                ...venture,
                feedback: [updatedFeedback as VentureFeedback]
            }

            const newData = [...currentData]
            newData[ventureIndex] = newVenture
            return newData
        })

        const payload = {
            venture_id: ventureId,
            ...updates,
            updated_at: new Date().toISOString()
        }

        // 2. Persist to DB
        try {
            const venture = data.find(v => v.id === ventureId)
            const localFeedback = venture?.feedback?.[0]

            if (localFeedback?.id) {
                // Update using local ID
                const { error } = await supabase
                    .from('venture_feedback')
                    .update(payload)
                    .eq('id', localFeedback.id)
                if (error) throw error
            } else {
                // Check if record exists in DB (in case local state is stale)
                const { data: existing, error: fetchError } = await supabase
                    .from('venture_feedback')
                    .select('id')
                    .eq('venture_id', ventureId)
                    .maybeSingle()

                if (fetchError) throw fetchError

                if (existing?.id) {
                    // Update existing record
                    const { error } = await supabase
                        .from('venture_feedback')
                        .update(payload)
                        .eq('id', existing.id)

                    if (error) throw error

                    // Update local state with real ID
                    setData(prev => {
                        const idx = prev.findIndex(v => v.id === ventureId)
                        if (idx === -1) return prev
                        const v = prev[idx]
                        const currentFeedback = v.feedback[0] || {}
                        const mergedFeedback = { ...currentFeedback, id: existing.id }
                        return [
                            ...prev.slice(0, idx),
                            { ...v, feedback: [mergedFeedback] },
                            ...prev.slice(idx + 1)
                        ]
                    })
                } else {
                    // Insert new record
                    const { data: result, error } = await supabase
                        .from('venture_feedback')
                        .insert(payload)
                        .select()
                        .single()

                    if (error) throw error

                    // Update local state with real ID
                    if (result) {
                        setData(prev => {
                            const idx = prev.findIndex(v => v.id === ventureId)
                            if (idx === -1) return prev
                            const v = prev[idx]
                            const currentFeedback = v.feedback[0] || {}
                            const mergedFeedback = { ...result, ...currentFeedback, id: result.id }
                            return [
                                ...prev.slice(0, idx),
                                { ...v, feedback: [mergedFeedback] },
                                ...prev.slice(idx + 1)
                            ]
                        })
                    }
                }
            }

        } catch (error) {
            console.error("Autosave failed:", error)
            // distinct error handling?
        } finally {
            setTimeout(() => {
                setIsSaving(false)
                setLastSaved(new Date())
            }, 500)
        }
    }

    const handleUpdateInvestor = async (ventureId: string, updates: Partial<Venture>) => {
        // 1. Optimistic Update
        setData(prev => prev.map(item =>
            item.id === ventureId ? { ...item, ...updates } : item
        ))

        try {
            const { error } = await supabase
                .from('ventures')
                .update(updates)
                .eq('id', ventureId)

            if (error) throw error
        } catch (error) {
            console.error("Failed to update investor:", error)
            toast.error("Failed to update investor details")
        }
    }



    const handleAddInvestor = async (input: { name: string, website: string, description: string, location: string }) => {
        try {
            // Insert into ventures table
            const { data: newVenture, error } = await supabase
                .from('ventures')
                .insert({
                    name: input.name,
                    description: input.description,
                    location: input.location,
                    metadata: { website: input.website },
                })
                .select()
                .single()

            if (error) throw error

            // Add to local state
            const newItem: VentureWithFeedback = {
                ...newVenture,
                feedback: []
            }

            setData(prev => [newItem, ...prev])
        } catch (error) {
            console.error("Error adding investor:", error)
            throw error
        }
    }





    // Deterministic sequential ID map: sort all rows by created_at (oldest first), assign 1..n
    const idMap = useMemo(() => {
        const sorted = [...data].sort((a, b) => {
            const timeA = new Date(a.created_at).getTime()
            const timeB = new Date(b.created_at).getTime()
            if (timeA !== timeB) return timeA - timeB
            return a.id.localeCompare(b.id)
        })
        const map: Record<string, number> = {}
        sorted.forEach((item, index) => { map[item.id] = index + 1 })
        return map
    }, [data])

    // Filter and Sort Data
    const filteredData = useMemo(() => {
        let filtered = [...data]

        // 1. Search (Name, Description)
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query)
            )
        }

        // 2. Location Filter
        if (locationQuery) {
            const query = locationQuery.toLowerCase()
            filtered = filtered.filter(item =>
                item.location?.toLowerCase().includes(query)
            )
        }

        // 3. Time Filter (Date Range)
        if (date?.from) {
            const from = startOfDay(date.from)
            const to = date.to ? endOfDay(date.to) : endOfDay(date.from)

            filtered = filtered.filter(item => {
                const created = new Date(item.created_at)
                return isWithinInterval(created, { start: from, end: to })
            })
        }

        // 4. Status Filter
        if (statusFilters.length > 0) {
            filtered = filtered.filter(item => {
                const feedback = item.feedback[0] || {}
                const current = feedback.status
                const status = current

                if (!status) return false

                return statusFilters.some(filter => {
                    if (filter === 'Meeting') {
                        return status.toLowerCase().includes('meeting')
                    }
                    if (filter === 'Custom') {
                        const knownStatuses = ['Cold outreach', 'Need warm intro', 'Need to ask for warm intro', 'Asked for warm intro', 'Submitted deck', 'Submitted deck online', 'Due diligence', 'Term sheet', 'Invested', 'Stopped interaction', 'Pending']
                        return !knownStatuses.some(k => status.toLowerCase().startsWith(k.toLowerCase())) && !status.toLowerCase().includes('meeting')
                    }
                    return status.toLowerCase().startsWith(filter.toLowerCase())
                })
            })
        }

        // 5. Decision Filter
        if (decisionFilters.length > 0) {
            filtered = filtered.filter(item => {
                const feedback = item.feedback[0] || {}
                // Resolve rating
                const rating = feedback.rating ?? null

                const status = rating === true ? 'Accepted' : rating === false ? 'Rejected' : 'Pending'
                return decisionFilters.includes(status)
            })
        }

        // 5. Sorting
        filtered.sort((a, b) => {
            if (sortOrder === 'name-asc') return a.name.localeCompare(b.name)
            if (sortOrder === 'name-desc') return b.name.localeCompare(a.name)
            if (sortOrder === 'newest') {
                const timeA = new Date(a.created_at).getTime()
                const timeB = new Date(b.created_at).getTime()
                if (timeA !== timeB) return timeB - timeA
                return b.id.localeCompare(a.id)
            }
            if (sortOrder === 'oldest') {
                const timeA = new Date(a.created_at).getTime()
                const timeB = new Date(b.created_at).getTime()
                if (timeA !== timeB) return timeA - timeB
                return a.id.localeCompare(b.id)
            }
            return 0
        })

        return filtered
    }, [data, searchQuery, locationQuery, sortOrder, date, statusFilters, decisionFilters])

    const clearFilters = () => {
        setLocationQuery("")
        setDate(undefined)
        setStatusFilters([])
        setDecisionFilters([])
    }



    return (
        <div className="flex flex-col h-full">
            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            {/* Toolbar */}
            <div className="flex flex-col gap-4 bg-card p-4 rounded-t-lg border-b border-x border-t shrink-0">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                    {/* Left: Search */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search investors..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mr-2">
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : lastSaved ? (
                                <>
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    <span>Saved</span>
                                </>
                            ) : null}
                        </div>
                        <AddItemDialog type="investor" onAdd={handleAddInvestor} />

                        {/* Filters Popover */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="gap-2 relative">
                                    <Filter className="h-4 w-4" />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0" align="end">
                                <div className="grid gap-4 p-4 max-h-[400px] overflow-y-auto">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium leading-none">Filters</h4>
                                        {activeFilterCount > 0 && (
                                            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
                                                Clear all
                                            </Button>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="location">Location</Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="location"
                                                placeholder="Filter by location..."
                                                className="pl-8"
                                                value={locationQuery}
                                                onChange={(e) => setLocationQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Date Range</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    id="date"
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !date && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {date?.from ? (
                                                        date.to ? (
                                                            <>
                                                                {format(date.from, "LLL dd, y")} -{" "}
                                                                {format(date.to, "LLL dd, y")}
                                                            </>
                                                        ) : (
                                                            format(date.from, "LLL dd, y")
                                                        )
                                                    ) : (
                                                        <span>Pick a date range</span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    initialFocus
                                                    mode="range"
                                                    defaultMonth={date?.from}
                                                    selected={date}
                                                    onSelect={setDate}
                                                    numberOfMonths={2}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Decision</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['Pending', 'Accepted', 'Rejected'].map((decision) => (
                                                <div key={decision} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`decision-${decision}`}
                                                        checked={decisionFilters.includes(decision)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setDecisionFilters([...decisionFilters, decision])
                                                            } else {
                                                                setDecisionFilters(decisionFilters.filter((d) => d !== decision))
                                                            }
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={`decision-${decision}`}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                    >
                                                        {decision}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Status</Label>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                            {['Cold outreach', 'Need warm intro', 'Asked for warm intro', 'Submitted deck', 'Meeting', 'Due diligence', 'Term sheet', 'Invested', 'Stopped interaction', 'Pending', 'Custom'].map((status) => (
                                                <div key={status} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`status-${status}`}
                                                        checked={statusFilters.includes(status)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setStatusFilters([...statusFilters, status])
                                                            } else {
                                                                setStatusFilters(statusFilters.filter((s) => s !== status))
                                                            }
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={`status-${status}`}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate"
                                                        title={status === 'Meeting' ? 'Meeting (Any)' : status}
                                                    >
                                                        {status === 'Meeting' ? 'Meeting (Any)' : status}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Sorting Popover */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <ArrowUpDown className="h-4 w-4" />
                                    Sort
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56" align="end">
                                <div className="grid gap-4">
                                    <h4 className="font-medium leading-none">Sort By</h4>
                                    <div className="grid gap-2">
                                        <Button
                                            variant={sortOrder === 'name-asc' ? "secondary" : "ghost"}
                                            className="justify-start font-normal"
                                            onClick={() => setSortOrder('name-asc')}
                                        >
                                            Name (A-Z)
                                        </Button>
                                        <Button
                                            variant={sortOrder === 'name-desc' ? "secondary" : "ghost"}
                                            className="justify-start font-normal"
                                            onClick={() => setSortOrder('name-desc')}
                                        >
                                            Name (Z-A)
                                        </Button>
                                        <Button
                                            variant={sortOrder === 'newest' ? "secondary" : "ghost"}
                                            className="justify-start font-normal"
                                            onClick={() => setSortOrder('newest')}
                                        >
                                            Newest Added
                                        </Button>
                                        <Button
                                            variant={sortOrder === 'oldest' ? "secondary" : "ghost"}
                                            className="justify-start font-normal"
                                            onClick={() => setSortOrder('oldest')}
                                        >
                                            Oldest Added
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Global Save Button */}

                        {/* Global Save Button Removed */}

                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 rounded-b-md border-x border-b bg-card overflow-hidden">
                <div className="h-full overflow-y-auto scrollbar-hide">
                    <Table className="w-full table-fixed">
                        <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[3%] text-center" style={{ minWidth: '36px' }}>#</TableHead>
                                <TableHead className="w-[4%]" style={{ minWidth: '40px' }}></TableHead>
                                <TableHead className="w-[18%]" style={{ minWidth: '150px' }}>Name</TableHead>
                                <TableHead className="w-[13%] text-center" style={{ minWidth: '140px' }}>Decision</TableHead>
                                <TableHead className="w-[28%]" style={{ minWidth: '200px' }}>Feedback</TableHead>
                                <TableHead className="w-[14%] text-center" style={{ minWidth: '100px' }}>Score</TableHead>
                                <TableHead className="w-[20%] text-center" style={{ minWidth: '160px' }}>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        No investors found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((venture) => {
                                    return (
                                        <InvestorRow
                                            key={venture.id}
                                            venture={venture}
                                            rowNumber={idMap[venture.id]}
                                            handleAutosave={handleAutosave}
                                            onUpdateInvestor={handleUpdateInvestor}
                                        />
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>


        </div>
    )
}


function InvestorRow({
    venture,
    rowNumber,
    handleAutosave,
    onUpdateInvestor
}: {
    venture: VentureWithFeedback,
    rowNumber: number,
    handleAutosave: (ventureId: string, updates: Partial<VentureFeedback>) => void,
    onUpdateInvestor: (ventureId: string, updates: Partial<Venture>) => void
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const feedback = venture.feedback[0] || {}

    // Local state for comments to handle debouncing
    const [commentValue, setCommentValue] = useState(feedback.comments || '')

    // Update local comment state when prepopulated data changes (e.g. after a save or initial load)
    // We check if it's different to avoid resetting user's typing if there's a race condition, 
    // but typically feedback.comments changes only when validated.
    // However, if we are typing, we don't want to be overwritten by the delayed save coming back?
    // Actually, since we optimistic update `data`, feedback.comments updates immediately in parent state.
    // So we just sync if it differs and we are not focusing? 
    // Simplest approach: Use useEffect to debounce the call to handleAutosave.

    // To properly handle debouncing without re-triggering on every prop change:
    // We can just rely on the parent's optimistic update being fast enough for other fields.
    // For comments, we want to type without lag.

    // Effect to update local value if parent value changes externally (e.g. initial load)
    // But we need to be careful not to overwrite user input while typing.
    // If the parent updates because of OUR autosave, it matches our local state.
    // If it updates because of something else, we might want to take it?
    // For now, let's just initialize.

    // NOTE: If we used `defaultValue` for Textarea, we wouldn't need this sync, but we want controlled.
    // Better pattern: Sync local state to prop when prop changes, BUT only if we aren't "editing" or if values match significantly?
    // Actually, with optimistic updates, the prop `feedback.comments` will immediately reflect what we typed after we call handleAutosave.
    // The issue is the debounce delay.
    // 1. User types "a" -> local "a".
    // 2. User types "b" -> local "ab".
    // ...
    // N. User stops. Timeout -> call handleAutosave("ab").
    // Parent updates `data` -> `feedback.comments` = "ab".
    // Prop updates. useEffect checks if "ab" !== local "ab" (it is same). No flicker.

    // BUT, if we typed "abc" before prop updated for "a"?
    // If we optimistically update, we MUST ensure the prop doesn't revert us.
    // Since parent update is synchronous (React state set), it should be fine.

    // Debounce implementation
    const [debouncedComment, setDebouncedComment] = useState(commentValue)

    // Sync prop to local state
    // We only want to update local state from props if the prop changed AND it's different from local (e.g. external update)
    // But since we drive the prop via autosave, we just need to be careful.
    // A simple `key` on the row or just careful effect?
    // Let's use a `useEffect` on `feedback.comments` to update `setCommentValue` ONLY if it differs significantly or we assume single user.
    // Actually, for a single user, just initializing `useState(feedback.comments || '')` is usually enough if we don't expect external concurrent edits from others in real-time.
    // But if we want to support that, it's harder. Let's assume single session.
    // However, fast switching between rows might require resetting.
    // So we DO need to react to `venture.id` changes or `feedback.comments` changes if they are substantial.
    // Let's rely on standard "controlled input with debounce" pattern.

    // Using a ref to track if we are the ones who triggered the update could work, but let's stick to simple:
    // We will trigger headersAutosave inside a useEffect that watches `debouncedComment`.

    // Sync prop to local state
    useEffect(() => {
        setCommentValue(feedback.comments || '')
    }, [feedback.comments])


    // Let's just use a useEffect for the autosave trigger.

    // Manual debounce logic
    useEffect(() => {
        const handler = setTimeout(() => {
            if (debouncedComment !== (feedback.comments || '')) {
                handleAutosave(venture.id, { comments: debouncedComment })
            }
        }, 1000)

        return () => {
            clearTimeout(handler)
        }
    }, [debouncedComment, venture.id]) // removing feedback.comments from dep to avoid loops

    const ratingVal = feedback.rating ?? null
    const decisionValue = ratingVal === true ? "Accepted" : ratingVal === false ? "Rejected" : "Pending"
    const statusValue = feedback.status || ''
    const displaySelectValue = getSelectValue(statusValue)

    // Helper functions need to be defined or imported if they were used.
    // getSelectValue was defined in the component in previous code.
    function getSelectValue(val: string | null) {
        if (!val) return ""
        if (['Rejected', 'Pending', 'Accepted', 'Contacted', 'Replied', 'Invested'].includes(val)) return val
        if (val.endsWith(' meeting')) return 'nth_meeting'
        return val
    }

    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState({
        name: venture.name,
        website: venture.metadata?.website || '',
        location: venture.location || '',
        description: venture.description || ''
    })

    const handleSave = () => {
        onUpdateInvestor(venture.id, {
            name: editForm.name,
            location: editForm.location,
            description: editForm.description,
            metadata: { ...venture.metadata, website: editForm.website }
        })
        setIsEditing(false)
    }

    const cancelEdit = () => {
        setEditForm({
            name: venture.name,
            website: venture.metadata?.website || '',
            location: venture.location || '',
            description: venture.description || ''
        })
        setIsEditing(false)
    }

    return (
        <>
            <TableRow className="group">
                <TableCell className="align-top py-4 text-center">
                    <span className="text-xs text-muted-foreground font-mono">{rowNumber}</span>
                </TableCell>
                <TableCell className="align-top py-4">
                    <div className="flex flex-col items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-6 w-6 p-0">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        {!isEditing && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                onClick={() => setIsEditing(true)}
                                title="Edit Investor Details"
                            >
                                <Edit2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </TableCell>
                <TableCell className="font-medium align-top py-4 pr-6 max-w-0">
                    {isEditing ? (
                        <div className="flex flex-col gap-2 w-full">
                            <Input
                                value={editForm.name}
                                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Investor Name"
                                className="h-8"
                            />
                            <Input
                                value={editForm.website}
                                onChange={e => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                                placeholder="Website URL"
                                className="h-8"
                            />
                            <Input
                                value={editForm.location}
                                onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                                placeholder="Location"
                                className="h-8"
                            />
                            <div className="flex gap-2 mt-2">
                                <Button size="sm" onClick={handleSave} className="h-7 px-2"><Save className="h-3 w-3 mr-1" /> Save</Button>
                                <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 px-2"><X className="h-3 w-3 mr-1" /> Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1 w-full">
                            <div className="flex items-center gap-2">
                                {venture.metadata?.website ? (
                                    <a
                                        href={venture.metadata.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="whitespace-normal break-words font-semibold text-sm hover:underline hover:text-primary transition-colors"
                                    >
                                        {venture.name}
                                        <ExternalLink className="inline-block ml-2 h-3 w-3 opacity-50" />
                                    </a>
                                ) : (
                                    <div className="whitespace-normal break-words font-semibold text-sm">{venture.name}</div>
                                )}
                            </div>

                            {venture.location && (
                                <div className="flex items-start text-sm text-foreground/80 w-full">
                                    <MapPin className="h-3 w-3 mr-1 mt-0.5 shrink-0" />
                                    <span className="whitespace-normal break-words">{venture.location}</span>
                                </div>
                            )}

                            <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-0.5">
                                <div suppressHydrationWarning>Added {formatDistanceToNow(new Date(venture.created_at), { addSuffix: true })}</div>
                                {feedback.updated_at && (
                                    <div>Updated {format(new Date(feedback.updated_at), "MMM d, yyyy")}</div>
                                )}
                            </div>
                        </div>
                    )}
                </TableCell>
                <TableCell className="align-top py-4 text-center">
                    <div className="flex justify-center">
                        <Select
                            value={decisionValue}
                            onValueChange={(val) => {
                                const newVal = val === "Accepted" ? true : val === "Rejected" ? false : null
                                handleAutosave(venture.id, { rating: newVal })
                            }}
                        >
                            <SelectTrigger className={`h-8 w-[120px] ${decisionValue === "Accepted" ? "text-green-600 font-medium" : decisionValue === "Rejected" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Accepted" className="text-green-600 font-medium">Accepted</SelectItem>
                                <SelectItem value="Rejected" className="text-destructive font-medium">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </TableCell>
                <TableCell className="align-top py-4">
                    <div className="relative w-full">
                        <Textarea
                            className="min-h-[40px] w-full py-2 resize-none whitespace-pre-wrap break-words bg-background border-input hover:border-input focus:border-input focus:ring-1 focus:ring-ring transition-all"
                            placeholder="Add feedback..."
                            value={commentValue}
                            onChange={(e) => {
                                setCommentValue(e.target.value)
                                setDebouncedComment(e.target.value)
                            }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${target.scrollHeight}px`;
                            }}
                            rows={1}
                        />
                    </div>
                </TableCell>
                <TableCell className="align-top py-4">
                    <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="0"
                        className="w-full h-8 text-center bg-background border-input hover:border-input focus:border-input focus:ring-1 focus:ring-ring transition-all"
                        value={feedback.score ?? ''}
                        onChange={(e) => {
                            const val = e.target.value === '' ? null : Number(e.target.value)
                            if (val !== null && (val < 0 || val > 100)) return
                            handleAutosave(venture.id, { score: val })
                        }}
                    />
                </TableCell>
                <TableCell className="align-top py-4 text-center">
                    <div className="flex justify-center w-full">
                        <StatusCell
                            statusHistory={venture.feedback[0]?.contact || []}
                            currentStatus={displaySelectValue || "Pending"}
                            isAccepted={ratingVal === true}
                            onUpdate={(newHistory) => {
                                // Sync status to latest entry
                                const sorted = [...newHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                let newStatus = displaySelectValue || "Pending"
                                if (sorted.length > 0) {
                                    newStatus = sorted[0].status
                                } else {
                                    // Fallback if history cleared
                                    newStatus = 'Pending'
                                }

                                handleAutosave(venture.id, {
                                    contact: newHistory,
                                    status: newStatus
                                })
                            }}
                        />
                    </div>
                </TableCell>
            </TableRow>
            {isExpanded && (
                <TableRow className="bg-muted/30 border-t-0">
                    <TableCell colSpan={2}></TableCell>
                    <TableCell colSpan={5} className="py-4 text-sm text-muted-foreground whitespace-pre-wrap">
                        {isEditing ? (
                            <Textarea
                                value={editForm.description}
                                onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Description"
                                className="min-h-[100px]"
                            />
                        ) : (
                            venture.description || "No description available."
                        )}
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}


