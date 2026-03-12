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
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, ExternalLink, Search, ArrowUpDown, Filter, Save, MapPin, CheckCircle2, Calendar as CalendarIcon, X, ChevronDown, ChevronRight, Edit2 } from "lucide-react"
import { formatDistanceToNow, subDays, format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { AddItemDialog } from "./add-item-dialog"
// import { DateRange } from "react-day-picker"

// Define DateRange locally if import fails or type is missing in older react-day-picker versions
type DateRange = {
    from: Date | undefined;
    to?: Date | undefined;
};

interface Company {
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

interface Feedback {
    id: string
    company_id: string
    rating: boolean | null
    comments: string | null
    score: number | null
    created_at: string
    updated_at: string
}

interface CompanyWithFeedback extends Company {
    feedback: Feedback[]
}

interface ProspectsTableProps {
    initialData: CompanyWithFeedback[]
}

type SortOrder = 'name-asc' | 'name-desc' | 'newest' | 'oldest'
type AcceptedFilter = 'all' | 'accepted' | 'not-accepted'

export function ProspectsTable({ initialData }: ProspectsTableProps) {
    const [data, setData] = useState<CompanyWithFeedback[]>(initialData)
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)

    // Filters
    const [searchQuery, setSearchQuery] = useState("")
    const [locationQuery, setLocationQuery] = useState("")
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
    const [date, setDate] = useState<DateRange | undefined>(undefined)
    const [acceptedFilter, setAcceptedFilter] = useState<AcceptedFilter>('all')

    // Tracking unsaved changes: key = companyId
    // const [modifiedRows, setModifiedRows] = useState<Record<string, { rating?: boolean | null, comments?: string | null, score?: number | null }>>({})

    const supabase = createClient()

    const activeFilterCount = (locationQuery ? 1 : 0) + (date?.from ? 1 : 0) + (acceptedFilter !== 'all' ? 1 : 0)

    const handleAutosave = async (companyId: string, updates: Partial<Feedback>) => {
        setIsSaving(true)
        // 1. Optimistic Update
        setData(currentData => {
            const companyIndex = currentData.findIndex(c => c.id === companyId)
            if (companyIndex === -1) return currentData

            const company = currentData[companyIndex]
            const currentFeedback = company.feedback[0] || {
                company_id: companyId,
                rating: null,
                comments: null,
                score: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }

            // Apply updates
            let updatedFeedback = { ...currentFeedback, ...updates, updated_at: new Date().toISOString() }

            const newCompany = {
                ...company,
                feedback: [updatedFeedback as Feedback]
            }

            const newData = [...currentData]
            newData[companyIndex] = newCompany
            return newData
        })

        const payload = {
            company_id: companyId,
            ...updates,
            updated_at: new Date().toISOString()
        }

        // 2. Persist to DB
        try {

            const company = data.find(c => c.id === companyId)
            const localFeedback = company?.feedback?.[0]

            if (localFeedback?.id) {
                // Update using local ID
                const { error } = await supabase
                    .from('feedback')
                    .update(payload)
                    .eq('id', localFeedback.id)

                if (error) throw error
            } else {
                // Check if record exists in DB (in case local state is stale or it was created elsewhere)
                const { data: existing, error: fetchError } = await supabase
                    .from('feedback')
                    .select('id')
                    .eq('company_id', companyId)
                    .maybeSingle()

                if (fetchError) throw fetchError

                if (existing?.id) {
                    // Update existing record
                    const { error } = await supabase
                        .from('feedback')
                        .update(payload)
                        .eq('id', existing.id)

                    if (error) throw error

                    // Update local state with real ID
                    setData(prev => {
                        const idx = prev.findIndex(c => c.id === companyId)
                        if (idx === -1) return prev
                        const c = prev[idx]
                        const currentFeedback = c.feedback[0] || {}
                        const mergedFeedback = { ...currentFeedback, id: existing.id }
                        return [
                            ...prev.slice(0, idx),
                            { ...c, feedback: [mergedFeedback] },
                            ...prev.slice(idx + 1)
                        ]
                    })
                } else {
                    // Insert new record
                    const { data: result, error } = await supabase
                        .from('feedback')
                        .insert(payload)
                        .select()
                        .single()

                    if (error) throw error

                    // Update local state with real ID
                    if (result) {
                        setData(prev => {
                            const idx = prev.findIndex(c => c.id === companyId)
                            if (idx === -1) return prev
                            const c = prev[idx]
                            const currentFeedback = c.feedback[0] || {}
                            const mergedFeedback = { ...result, ...currentFeedback, id: result.id }
                            return [
                                ...prev.slice(0, idx),
                                { ...c, feedback: [mergedFeedback] },
                                ...prev.slice(idx + 1)
                            ]
                        })
                    }
                }
            }

        } catch (error) {
            console.error("Autosave failed. Details:", {
                companyId,
                payload,
                error,
                errorMessage: (error as any)?.message,
                errorDetails: (error as any)?.details,
                errorCode: (error as any)?.code
            });
            // toast.error("Failed to save changes")
        } finally {
            setTimeout(() => {
                setIsSaving(false)
                setLastSaved(new Date())
            }, 500)
        }
    }

    const handleUpdateCompany = async (companyId: string, updates: Partial<Company>) => {
        // 1. Optimistic Update
        setData(prev => prev.map(item =>
            item.id === companyId ? { ...item, ...updates } : item
        ))

        try {
            const { error } = await supabase
                .from('companies')
                .update(updates)
                .eq('id', companyId)

            if (error) throw error
        } catch (error) {
            console.error("Failed to update company:", error)
            toast.error("Failed to update company details")
            // Revert optimistic update (optional, but good practice)
            // For now, we'll rely on the user refreshing if it fails, or we could fetch the old data back.
        }
    }

    const handleAddProspect = async (input: { name: string, website: string, description: string, location: string }) => {
        try {
            // Insert into companies table
            const { data: newCompany, error } = await supabase
                .from('companies')
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
            const newItem: CompanyWithFeedback = {
                ...newCompany,
                feedback: []
            }

            setData(prev => [newItem, ...prev])
        } catch (error) {
            console.error("Error adding prospect:", error)
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

        // 4. Accepted Filter
        if (acceptedFilter !== 'all') {
            filtered = filtered.filter(item => {
                const feedback = item.feedback[0] || {}
                const isAccepted = feedback.rating === true

                if (acceptedFilter === 'accepted') return isAccepted
                if (acceptedFilter === 'not-accepted') return !isAccepted
                return true
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
    }, [data, searchQuery, locationQuery, sortOrder, date, acceptedFilter])

    const clearFilters = () => {
        setLocationQuery("")
        setDate(undefined)
        setAcceptedFilter("all")
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
                            placeholder="Search companies..."
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
                            <PopoverContent className="w-80" align="end">
                                <div className="grid gap-4">
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
                                        <Label htmlFor="status">Status</Label>
                                        <Select value={acceptedFilter} onValueChange={(v: AcceptedFilter) => setAcceptedFilter(v)}>
                                            <SelectTrigger id="status">
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Status</SelectItem>
                                                <SelectItem value="accepted">Accepted</SelectItem>
                                                <SelectItem value="not-accepted">Not Accepted</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <AddItemDialog type="prospect" onAdd={handleAddProspect} />

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
                                <TableHead className="w-[5%]" style={{ minWidth: '40px' }}></TableHead>
                                <TableHead className="w-[24%]" style={{ minWidth: '200px' }}>Name</TableHead>
                                <TableHead className="w-[13%] text-center" style={{ minWidth: '100px' }}>Accepted</TableHead>
                                <TableHead className="w-[35%]" style={{ minWidth: '250px' }}>Feedback</TableHead>
                                <TableHead className="w-[20%] text-center" style={{ minWidth: '120px' }}>Score</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No companies found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((company) => {
                                    return (
                                        <CompanyRow
                                            key={company.id}
                                            company={company}
                                            rowNumber={idMap[company.id]}
                                            handleAutosave={handleAutosave}
                                            onUpdateCompany={handleUpdateCompany}
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


function CompanyRow({ company, rowNumber, handleAutosave, onUpdateCompany }: {
    company: CompanyWithFeedback,
    rowNumber: number,
    handleAutosave: (companyId: string, updates: Partial<Feedback>) => void,
    onUpdateCompany: (companyId: string, updates: Partial<Company>) => void
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const feedback = company.feedback[0] || {}

    // Local state for comments to handle debouncing
    const [commentValue, setCommentValue] = useState(feedback.comments || '')
    const [debouncedComment, setDebouncedComment] = useState(commentValue)

    // Sync local state if feedback changes externally (e.g. init)
    useEffect(() => {
        setCommentValue(feedback.comments || '')
    }, [feedback.comments])

    // Manual debounce logic
    useEffect(() => {
        const handler = setTimeout(() => {
            if (debouncedComment !== (feedback.comments || '')) {
                handleAutosave(company.id, { comments: debouncedComment })
            }
        }, 1000)

        return () => {
            clearTimeout(handler)
        }
    }, [debouncedComment, company.id])

    const isAccepted = feedback.rating === true

    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState({
        name: company.name,
        website: company.metadata?.website || '',
        location: company.location || '',
        description: company.description || ''
    })

    const handleSave = () => {
        onUpdateCompany(company.id, {
            name: editForm.name,
            location: editForm.location,
            description: editForm.description,
            metadata: { ...company.metadata, website: editForm.website }
        })
        setIsEditing(false)
    }

    const cancelEdit = () => {
        setEditForm({
            name: company.name,
            website: company.metadata?.website || '',
            location: company.location || '',
            description: company.description || ''
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
                                title="Edit Company Details"
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
                                placeholder="Company Name"
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
                        <div className="flex flex-col gap-1 w-full relative">
                            <div className="flex items-center gap-2">
                                {company.metadata?.website ? (
                                    <a
                                        href={company.metadata.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="whitespace-normal break-words font-semibold text-sm hover:underline hover:text-primary transition-colors"
                                    >
                                        {company.name}
                                        <ExternalLink className="inline-block ml-2 h-3 w-3 opacity-50" />
                                    </a>
                                ) : (
                                    <div className="whitespace-normal break-words font-semibold text-sm">{company.name}</div>
                                )}
                            </div>

                            {company.location && (
                                <div className="flex items-start text-sm text-foreground/80 w-full">
                                    <MapPin className="h-3 w-3 mr-1 mt-0.5 shrink-0" />
                                    <span className="whitespace-normal break-words">{company.location}</span>
                                </div>
                            )}

                            <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-0.5">
                                <div suppressHydrationWarning>Added {formatDistanceToNow(new Date(company.created_at), { addSuffix: true })}</div>
                                {feedback.updated_at && (
                                    <div>Updated {format(new Date(feedback.updated_at), "MMM d, yyyy")}</div>
                                )}
                            </div>
                        </div>
                    )}
                </TableCell>
                <TableCell className="align-top py-4 text-center">
                    <div className="flex justify-center">
                        <Checkbox
                            checked={isAccepted}
                            onCheckedChange={(checked) => handleAutosave(company.id, { rating: checked === true })}
                        />
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
                            handleAutosave(company.id, { score: val })
                        }}
                    />
                </TableCell>
            </TableRow>
            {isExpanded && (
                <TableRow className="bg-muted/30 border-t-0">
                    <TableCell colSpan={2}></TableCell>
                    <TableCell colSpan={4} className="py-4 text-sm text-muted-foreground whitespace-pre-wrap">
                        {isEditing ? (
                            <Textarea
                                value={editForm.description}
                                onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Description"
                                className="min-h-[100px]"
                            />
                        ) : (
                            company.description || "No description available."
                        )}
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}

