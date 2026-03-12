"use client"

import { useState, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Plus, User, Linkedin, Mail, ExternalLink, Trash2, X, Clock, History, Edit2 } from "lucide-react"

// Types (Mirrored from investors-table.tsx for now to avoid circular deps or heavy refactor)
export type PointOfContact = {
    type: 'linkedin' | 'email' | 'other'
    name?: string
    value: string
    linkedin?: string
    date?: string | null
    contact_link?: string
    role?: 'from' | 'to'
}

export type StatusEntry = {
    id: string // Unique ID for the status entry
    status: string
    description?: string
    date: string // ISO date string
    contacts: PointOfContact[]
    created_at: string
}

interface StatusCellProps {
    statusHistory: StatusEntry[]
    currentStatus: string | null
    onUpdate: (newHistory: StatusEntry[]) => void
    isAccepted: boolean
}

const STATUS_PRESETS = [
    "Cold outreach",
    "Need to ask for warm intro",
    "Asked for warm intro",
    "Submitted deck online",
    "Meeting N° Scheduled",
    "Had Meeting N°",
    "Due diligence",
    "Term sheet",
    "Invested",
    "They Passed",
    "Pending",
    "Custom"
]

const isWarmIntroStatus = (status: string) =>
    status === "Need to ask for warm intro" || status === "Asked for warm intro"

// ---------------------------------------------------------------------------
// Helper: Clickable contact name link
// ---------------------------------------------------------------------------
function ContactLink({ contact, className }: { contact: PointOfContact; className?: string }) {
    const link = contact.contact_link || (contact.type === 'email' ? `mailto:${contact.value}` : contact.value)
    const isLink = !!link && (contact.type === 'email' || contact.type === 'linkedin' || !!contact.contact_link)
    const displayName = contact.name || contact.value

    if (isLink) {
        return (
            <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={cn("hover:underline font-medium", className)}
            >
                {displayName}
            </a>
        )
    }
    return <span className={cn("font-medium", className)}>{displayName}</span>
}

// ---------------------------------------------------------------------------
// Helper: Render warm intro contacts as "from X, Y to Z, W"
// ---------------------------------------------------------------------------
function WarmIntroContactsDisplay({ contacts, className }: { contacts: PointOfContact[]; className?: string }) {
    const fromContacts = contacts.filter(c => c.role === 'from')
    const toContacts = contacts.filter(c => c.role === 'to')
    if (fromContacts.length === 0 && toContacts.length === 0) return null

    return (
        <span className={cn("inline", className)}>
            {fromContacts.length > 0 && (
                <>
                    <span className="opacity-70">from </span>
                    {fromContacts.map((c, i) => (
                        <span key={i}>
                            <ContactLink contact={c} />
                            {i < fromContacts.length - 1 && ", "}
                        </span>
                    ))}
                </>
            )}
            {fromContacts.length > 0 && toContacts.length > 0 && " "}
            {toContacts.length > 0 && (
                <>
                    <span className="opacity-70">to </span>
                    {toContacts.map((c, i) => (
                        <span key={i}>
                            <ContactLink contact={c} />
                            {i < toContacts.length - 1 && ", "}
                        </span>
                    ))}
                </>
            )}
        </span>
    )
}

// ---------------------------------------------------------------------------
// ContactFormWithAutocomplete – inline contact form with suggestion dropdown
// ---------------------------------------------------------------------------
function ContactFormWithAutocomplete({
    knownContacts,
    onAdd,
    onCancel,
}: {
    knownContacts: PointOfContact[]
    onAdd: (contact: PointOfContact) => void
    onCancel: () => void
}) {
    const [name, setName] = useState("")
    const [type, setType] = useState<'linkedin' | 'email'>('linkedin')
    const [value, setValue] = useState("")
    const [showSuggestions, setShowSuggestions] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const suggestions = useMemo(() => {
        if (!name) return []
        return knownContacts.filter(c =>
            (c.name || c.value).toLowerCase().includes(name.toLowerCase())
        )
    }, [name, knownContacts])

    const selectSuggestion = (contact: PointOfContact) => {
        setName(contact.name || "")
        setType(contact.type === 'other' ? 'linkedin' : contact.type)
        setValue(contact.value || "")
        setShowSuggestions(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab' && suggestions.length > 0 && showSuggestions) {
            e.preventDefault()
            selectSuggestion(suggestions[0])
        }
        if (e.key === 'Escape') {
            setShowSuggestions(false)
        }
    }

    const handleAdd = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!value) return
        onAdd({ type, name, value, date: new Date().toISOString() })
        setName("")
        setValue("")
    }

    return (
        <div className="bg-muted p-2 rounded-md grid gap-2">
            <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                    <Input
                        ref={inputRef}
                        placeholder="Name"
                        value={name}
                        onChange={e => {
                            setName(e.target.value)
                            setShowSuggestions(true)
                        }}
                        onFocus={() => { if (name) setShowSuggestions(true) }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        onKeyDown={handleKeyDown}
                        className="h-8 text-sm"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 w-full z-50 bg-popover border rounded-md shadow-lg mt-1 max-h-[150px] overflow-y-auto">
                            {suggestions.map((c, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2 transition-colors"
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        selectSuggestion(c)
                                    }}
                                >
                                    {c.type === 'linkedin' && <Linkedin className="h-3 w-3 text-blue-600 shrink-0" />}
                                    {c.type === 'email' && <Mail className="h-3 w-3 shrink-0" />}
                                    <span className="font-medium truncate">{c.name || c.value}</span>
                                    {c.name && (
                                        <span className="text-xs text-muted-foreground truncate ml-auto">{c.value}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex bg-background rounded-md border h-8">
                    <button
                        className={cn("flex-1 text-xs rounded-l-md transition-colors", type === 'linkedin' ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setType('linkedin') }}
                    >LinkedIn</button>
                    <div className="w-px bg-border" />
                    <button
                        className={cn("flex-1 text-xs rounded-r-md transition-colors", type === 'email' ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setType('email') }}
                    >Email</button>
                </div>
            </div>
            <Input
                placeholder={type === 'linkedin' ? "LinkedIn URL" : "Email Address"}
                value={value}
                onChange={e => setValue(e.target.value)}
                className="h-8 text-sm"
            />
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel() }} className="h-7 text-xs">Cancel</Button>
                <Button size="sm" onClick={handleAdd} className="h-7 text-xs" disabled={!value}>Add Contact</Button>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// ContactListSection – reusable contact list with add button for a section
// ---------------------------------------------------------------------------
function ContactListSection({
    label,
    contacts,
    setContacts,
    knownContacts,
}: {
    label?: string
    contacts: PointOfContact[]
    setContacts: (contacts: PointOfContact[]) => void
    knownContacts: PointOfContact[]
}) {
    const [isAdding, setIsAdding] = useState(false)

    return (
        <div className="grid gap-1.5">
            {label && <Label className="text-xs font-medium">{label}</Label>}

            {contacts.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-1">
                    {contacts.map((c, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded-md border">
                            {c.type === 'linkedin' && <Linkedin className="h-2.5 w-2.5 text-blue-600 shrink-0" />}
                            {c.type === 'email' && <Mail className="h-2.5 w-2.5 shrink-0" />}
                            <span className="font-medium">{c.name || c.value}</span>
                            <button onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setContacts(contacts.filter((_, idx) => idx !== i))
                            }} className="ml-1 hover:text-destructive">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {isAdding ? (
                <ContactFormWithAutocomplete
                    knownContacts={knownContacts}
                    onAdd={(contact) => {
                        setContacts([...contacts, contact])
                        setIsAdding(false)
                    }}
                    onCancel={() => setIsAdding(false)}
                />
            ) : (
                <Button variant="outline" size="sm" onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsAdding(true)
                }} className="w-full h-7 border-dashed text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Add Contact
                </Button>
            )}
        </div>
    )
}

// ===========================================================================================
// StatusCell
// ===========================================================================================

export function StatusCell({ statusHistory, currentStatus, onUpdate, isAccepted }: StatusCellProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<StatusEntry | null>(null)

    // Sort history by date desc
    const sortedHistory = useMemo(() => {
        const history = Array.isArray(statusHistory) ? statusHistory : []
        return [...history].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )
    }, [statusHistory])

    // Extract unique contacts from this row's entire history for autocomplete
    const knownContacts = useMemo(() => {
        const history = Array.isArray(statusHistory) ? statusHistory : []
        const contactMap = new Map<string, PointOfContact>()
        history.forEach(entry => {
            entry.contacts?.forEach(c => {
                const key = (c.name || c.value).toLowerCase()
                if (!contactMap.has(key)) {
                    contactMap.set(key, { ...c, role: undefined })
                }
            })
        })
        return Array.from(contactMap.values())
    }, [statusHistory])

    const latestStatus = sortedHistory.length > 0 ? sortedHistory[0].status : currentStatus

    const getStatusColor = (status: string | null) => {
        if (!status) return "bg-background border-input"
        if (status === 'Stopped interaction' || status === 'Rejected' || status === 'They Passed') return "bg-red-500/10 text-red-700 border-red-200 hover:bg-red-500/20"
        if (status === 'Pending') return "bg-gray-500/10 text-gray-700 border-gray-200 hover:bg-gray-500/20"
        if (status === 'Term sheet' || status === 'Invested') return "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white border-transparent hover:opacity-90 font-bold shadow-sm"
        // Greenish for positive progress
        return "bg-green-500/10 text-green-700 border-green-200 hover:bg-green-500/20"
    }

    const renderSelectTrigger = (value: string | null) => {
        if (!value) return "Select status"
        if (value.includes('Meeting N°')) return value // Already formatted
        return value
    }

    const handleAddStatus = (newEntry: StatusEntry) => {
        const newHistory = [newEntry, ...(statusHistory || [])]
        onUpdate(newHistory)
    }

    const handleUpdateStatus = (updatedEntry: StatusEntry) => {
        const newHistory = (statusHistory || []).map(entry =>
            entry.id === updatedEntry.id ? updatedEntry : entry
        )
        onUpdate(newHistory)
        setEditingEntry(null)
    }

    const handleDeleteStatus = (id: string) => {
        const newHistory = (statusHistory || []).filter(s => s.id !== id)
        onUpdate(newHistory)
    }

    // Render contacts for a status entry – handles both warm intro and regular
    const renderEntryContacts = (entry: StatusEntry, compact: boolean) => {
        if (!entry.contacts || entry.contacts.length === 0) return null

        if (isWarmIntroStatus(entry.status)) {
            return (
                <div className={cn("mt-1", compact ? "text-[10px]" : "text-xs text-muted-foreground")}>
                    <WarmIntroContactsDisplay contacts={entry.contacts} />
                </div>
            )
        }

        // Regular contacts
        return (
            <div className="flex flex-wrap gap-1 mt-1">
                {entry.contacts.map((c, i) => {
                    const link = c.contact_link || (c.type === 'email' ? `mailto:${c.value}` : c.value)
                    const isLink = !!link && (c.type === 'email' || c.type === 'linkedin' || !!c.contact_link)

                    return compact ? (
                        <a
                            key={i}
                            href={isLink ? link : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => { if (isLink) e.stopPropagation() }}
                            className={cn(
                                "text-[10px] bg-background/50 px-1.5 py-0.5 rounded border border-current opacity-80 inline-flex items-center gap-1 max-w-full hover:opacity-100 transition-opacity",
                                isLink && "hover:underline cursor-pointer hover:bg-background/80"
                            )}
                        >
                            {c.type === 'linkedin' && <Linkedin className="h-2 w-2 shrink-0" />}
                            {c.type === 'email' && <Mail className="h-2 w-2 shrink-0" />}
                            <span className="truncate group-hover:whitespace-normal group-hover:text-clip break-all">{c.name || c.value}</span>
                        </a>
                    ) : (
                        <a
                            key={i}
                            href={isLink ? link : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                                "flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md w-fit max-w-full group/contact transition-all",
                                isLink && "hover:bg-muted hover:text-foreground cursor-pointer"
                            )}
                        >
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[150px] group-hover/contact:whitespace-normal group-hover/contact:max-w-none font-medium text-foreground">{c.name || "Contact"}</span>
                            <span className="opacity-50 mx-1">|</span>
                            {c.type === 'linkedin' && <Linkedin className="h-3 w-3 shrink-0 text-blue-600" />}
                            {c.type === 'email' && <Mail className="h-3 w-3 shrink-0" />}
                            <span className="truncate max-w-[200px] group-hover/contact:whitespace-normal group-hover/contact:max-w-none">{c.value}</span>
                        </a>
                    )
                })}
            </div>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                        "w-full text-left px-3 py-2 rounded-md transition-all border min-h-[40px] flex flex-col gap-1 hover:bg-muted/50 group h-auto relative min-w-0",
                        !isAccepted && "opacity-50 cursor-not-allowed pointer-events-none", // Disable interaction if not accepted
                        getStatusColor(latestStatus)
                    )}
                // We let DialogTrigger handle the click for the main container
                >
                    <div className="flex items-start justify-between gap-2 w-full">
                        <span className="font-medium text-sm truncate group-hover:whitespace-normal group-hover:overflow-visible break-words w-full">
                            {renderSelectTrigger(latestStatus)}
                        </span>
                        {sortedHistory.length > 0 && (
                            <span className="text-xs opacity-70 whitespace-nowrap shrink-0 ml-auto">
                                {format(new Date(sortedHistory[0].date), "MMM d")}
                            </span>
                        )}
                    </div>

                    {sortedHistory.length > 0 && (
                        <>
                            {sortedHistory[0].description && (
                                <div className="text-xs opacity-90 line-clamp-1 group-hover:line-clamp-none group-hover:whitespace-normal break-words leading-snug w-full">
                                    {sortedHistory[0].description}
                                </div>
                            )}
                            {renderEntryContacts(sortedHistory[0], true)}
                        </>
                    )}
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[85vh]">
                <DialogHeader>
                    <DialogTitle>Status History</DialogTitle>
                    <DialogDescription>Track the progression of your interaction with this investor.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-1 -mr-2 flex flex-col gap-6 py-4">
                    {/* Add/Edit Form */}
                    {editingEntry ? (
                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
                                <Edit2 className="h-4 w-4" />
                                Edit Status
                            </h4>
                            <StatusForm
                                key={editingEntry.id}
                                initialValues={editingEntry}
                                onSubmit={handleUpdateStatus}
                                buttonText="Update Status"
                                onCancel={() => setEditingEntry(null)}
                                knownContacts={knownContacts}
                            />
                        </div>
                    ) : (
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                Add New Status
                            </h4>
                            <StatusForm key="new" onSubmit={handleAddStatus} buttonText="Add Status" knownContacts={knownContacts} />
                        </div>
                    )}

                    {/* History List */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-xs">Timeline</h4>
                        {sortedHistory.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                No status history yet.
                            </div>
                        ) : (
                            <div className="relative border-l-2 border-muted ml-3 space-y-6 pb-2">
                                {sortedHistory.map((entry, index) => (
                                    <div key={entry.id || index} className="pl-6 relative group">
                                        {/* Dot */}
                                        <div className={cn(
                                            "absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background",
                                            index === 0 ? "bg-primary" : "bg-muted-foreground/30"
                                        )} />

                                        <div className="flex flex-col gap-1.5 min-w-0 w-full">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex flex-col">
                                                    <div className="font-semibold text-sm">{entry.status}</div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {format(new Date(entry.date), "MMM d, yyyy")}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setEditingEntry(entry)
                                                        }}
                                                    >
                                                        <Edit2 className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleDeleteStatus(entry.id)
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {entry.description && (
                                                <div className="text-sm text-foreground/80 whitespace-pre-wrap">{entry.description}</div>
                                            )}

                                            {renderEntryContacts(entry, false)}
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ===========================================================================================
// StatusForm
// ===========================================================================================

interface StatusFormProps {
    initialValues?: StatusEntry
    onSubmit: (entry: StatusEntry) => void
    buttonText: string
    onCancel?: () => void
    knownContacts?: PointOfContact[]
}

function getOrdinal(n: number) {
    const s = ["th", "st", "nd", "rd"]
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function StatusForm({ initialValues, onSubmit, buttonText, onCancel, knownContacts = [] }: StatusFormProps) {
    // Parser for meeting status
    const parseMeetingStatus = (status: string) => {
        const meetingMatch = status.match(/(\d+)(st|nd|rd|th) Meeting Scheduled/)
        const hadMeetingMatch = status.match(/Had (\d+)(st|nd|rd|th) Meeting/)

        if (meetingMatch) {
            return { type: "Meeting N° Scheduled", number: parseInt(meetingMatch[1]) }
        }
        if (hadMeetingMatch) {
            return { type: "Had Meeting N°", number: parseInt(hadMeetingMatch[1]) }
        }
        return null
    }

    const getInitialStatusType = () => {
        if (!initialValues?.status) return ""
        if (STATUS_PRESETS.includes(initialValues.status)) return initialValues.status

        const meeting = parseMeetingStatus(initialValues.status)
        if (meeting) return meeting.type

        return "Custom"
    }

    const initialMeetingData = initialValues?.status ? parseMeetingStatus(initialValues.status) : null

    const [statusType, setStatusType] = useState<string>(getInitialStatusType())
    const [customStatus, setCustomStatus] = useState(
        initialValues?.status && !STATUS_PRESETS.includes(initialValues.status) && !initialMeetingData
            ? initialValues.status
            : ""
    )
    const [meetingNumber, setMeetingNumber] = useState<number | "">(initialMeetingData ? initialMeetingData.number : "")

    const [description, setDescription] = useState(initialValues?.description || "")
    const [date, setDate] = useState<Date | undefined>(initialValues?.date ? new Date(initialValues.date) : new Date())

    // ---- Contacts State ----

    // For warm intro: separate from/to lists
    const initFromContacts = initialValues?.contacts?.filter(c => c.role === 'from') || []
    const initToContacts = initialValues?.contacts?.filter(c => c.role === 'to') || []
    // For regular statuses: contacts without role (or all if no roles present)
    const initRegularContacts = initialValues?.contacts
        ? (initFromContacts.length > 0 || initToContacts.length > 0
            ? initialValues.contacts.filter(c => !c.role)
            : initialValues.contacts)
        : []

    const [contacts, setContacts] = useState<PointOfContact[]>(initRegularContacts)
    const [fromContacts, setFromContacts] = useState<PointOfContact[]>(initFromContacts)
    const [toContacts, setToContacts] = useState<PointOfContact[]>(initToContacts)

    const warmIntro = isWarmIntroStatus(statusType)

    const handleSubmit = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault()
            e.stopPropagation()
        }

        let finalStatus = statusType

        if (statusType === "Custom") {
            finalStatus = customStatus
        } else if (statusType === "Meeting N° Scheduled") {
            if (!meetingNumber) return
            finalStatus = `${getOrdinal(Number(meetingNumber))} Meeting Scheduled`
        } else if (statusType === "Had Meeting N°") {
            if (!meetingNumber) return
            finalStatus = `Had ${getOrdinal(Number(meetingNumber))} Meeting`
        }

        if (!finalStatus || !date) return

        // Build final contacts array
        let finalContacts: PointOfContact[]
        if (warmIntro) {
            finalContacts = [
                ...fromContacts.map(c => ({ ...c, role: 'from' as const })),
                ...toContacts.map(c => ({ ...c, role: 'to' as const })),
            ]
        } else {
            finalContacts = contacts
        }

        onSubmit({
            id: initialValues?.id || crypto.randomUUID(),
            status: finalStatus,
            description,
            date: date.toISOString(),
            contacts: finalContacts,
            created_at: initialValues?.created_at || new Date().toISOString()
        })

        if (!initialValues) {
            // Reset form only if adding new
            setStatusType("")
            setCustomStatus("")
            setMeetingNumber("")
            setDescription("")
            setDate(new Date())
            setContacts([])
            setFromContacts([])
            setToContacts([])
        }
    }

    return (
        <div className="grid gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select value={statusType} onValueChange={(val) => {
                        setStatusType(val)
                        if ((val === "Meeting N° Scheduled" || val === "Had Meeting N°") && !meetingNumber) {
                            setMeetingNumber(1)
                        }
                    }}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select status..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                            {STATUS_PRESETS.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {statusType === "Custom" && (
                <div className="grid gap-2">
                    <Label>Custom Status Name</Label>
                    <Input value={customStatus} onChange={e => setCustomStatus(e.target.value)} placeholder="Enter status name..." />
                </div>
            )}

            {(statusType === "Meeting N° Scheduled" || statusType === "Had Meeting N°") && (
                <div className="grid gap-2">
                    <Label>Meeting Number</Label>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">N°</span>
                        <Input
                            type="number"
                            min="1"
                            value={meetingNumber}
                            onChange={e => setMeetingNumber(parseInt(e.target.value) || "")}
                            placeholder="1"
                            className="w-20"
                        />
                        {meetingNumber && (
                            <span className="text-sm font-medium text-muted-foreground">
                                {getOrdinal(Number(meetingNumber))}
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div className="grid gap-2">
                <Label>Description <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
                <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add details..."
                    rows={2}
                />
            </div>

            {/* Contacts Section – switches between regular and warm-intro from/to */}
            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label>Contacts <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
                </div>

                {warmIntro ? (
                    <div className="grid gap-3 bg-muted/20 p-3 rounded-lg border border-dashed">
                        <ContactListSection
                            label="From (who to ask)"
                            contacts={fromContacts}
                            setContacts={setFromContacts}
                            knownContacts={knownContacts}
                        />
                        <div className="border-t" />
                        <ContactListSection
                            label="To (who they connect you with)"
                            contacts={toContacts}
                            setContacts={setToContacts}
                            knownContacts={knownContacts}
                        />
                    </div>
                ) : (
                    <ContactListSection
                        contacts={contacts}
                        setContacts={setContacts}
                        knownContacts={knownContacts}
                    />
                )}
            </div>

            <div className="flex gap-2 mt-2">
                {onCancel && (
                    <Button variant="ghost" onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onCancel()
                    }} className="flex-1">
                        Cancel
                    </Button>
                )}
                <Button onClick={handleSubmit} disabled={!statusType || !date} className="flex-1">
                    {buttonText}
                </Button>
            </div>
        </div>
    )
}

function ChevronDown(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    )
}
