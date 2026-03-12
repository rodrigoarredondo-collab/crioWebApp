"use client"

import React, { useState, useMemo, useCallback, useRef } from "react"
import { Upload, FileSpreadsheet, ChevronRight, ChevronLeft, Check, X, Plus, Loader2, AlertCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ExistingInk {
    inkNumber: string
    cpa1Name: string
    cpa1Ptg: string
    cpa2Name: string
    cpa2Ptg: string
    cpa3Name: string
    cpa3Ptg: string
}

interface CsvImportDialogProps {
    open: boolean
    onClose: () => void
    existingInks: ExistingInk[]
    onSuccess: () => void
}

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
const COLS = Array.from({ length: 12 }, (_, i) => i + 1)

// Well assignment: a group of wells sharing the same ink/cellLine/format
interface WellAssignment {
    id: string
    wells: Set<string>
    inkNumber: string
    cellLine: string
    format: string
    isNewInk: boolean
    cpa1Name: string
    cpa1Ptg: string
    cpa2Name: string
    cpa2Ptg: string
    cpa3Name: string
    cpa3Ptg: string
    drugs: { name: string; concentration: string }[]
}

export function CsvImportDialog({ open, onClose, existingInks, onSuccess }: CsvImportDialogProps) {
    const [step, setStep] = useState(1)
    const [csvData, setCsvData] = useState<(number | null)[][] | null>(null)
    const [fileName, setFileName] = useState("")
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Step 2 — Global metadata
    const [date, setDate] = useState("")
    const [process, setProcess] = useState("Cryobioprinting")
    const [storageTime, setStorageTime] = useState("")
    const [assayDay, setAssayDay] = useState("")
    const [plateNumber, setPlateNumber] = useState("")

    // Step 3 — Well assignments
    const [assignments, setAssignments] = useState<WellAssignment[]>([])
    const [selectedWells, setSelectedWells] = useState<Set<string>>(new Set())
    const [editingAssignment, setEditingAssignment] = useState<string | null>(null)

    // Step 4 — Submit
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    // CSV and TXT parsing
    const parseCSV = useCallback((text: string) => {
        const lines = text.trim().split(/\r?\n/)
        const data: (number | null)[][] = Array(8).fill(null).map(() => Array(12).fill(null))

        let foundStructuredData = false
        let colMap: Record<number, number> = {} // maps token index in line to col index (0-11)
        let currentRowIdx = 0
        let inDataBlock = false

        for (const line of lines) {
            // Tokens can be separated by tabs or commas
            const delimiter = line.includes('\t') ? '\t' : ','
            const tokens = line.split(delimiter).map(t => t.trim())

            // Is it a header line?
            const has1 = tokens.includes("1") || tokens.includes('"1"')
            const has2 = tokens.includes("2") || tokens.includes('"2"')

            if (has1 && has2) {
                colMap = {}
                tokens.forEach((t, i) => {
                    const cleanT = t.replace(/['"]/g, '')
                    const colNum = parseInt(cleanT)
                    if (!isNaN(colNum) && colNum >= 1 && colNum <= 12) {
                        colMap[i] = colNum - 1
                    }
                })
                inDataBlock = true
                currentRowIdx = 0
                continue
            }

            if (inDataBlock && Object.keys(colMap).length > 0) {
                let explicitRowLetter: string | null = null
                for (const t of tokens) {
                    const cleanT = t.replace(/['"]/g, '').toUpperCase()
                    if (/^[A-H]$/.test(cleanT)) {
                        explicitRowLetter = cleanT
                        break
                    }
                }

                if (explicitRowLetter) {
                    currentRowIdx = explicitRowLetter.charCodeAt(0) - 65
                }

                if (currentRowIdx > 7) {
                    inDataBlock = false
                    continue
                }

                let rowHasData = false
                tokens.forEach((t, i) => {
                    if (colMap[i] !== undefined) {
                        const cleanT = t.replace(/['"]/g, '')
                        if (cleanT !== "" && cleanT.toUpperCase() !== explicitRowLetter) {
                            const val = parseFloat(cleanT)
                            if (!isNaN(val)) {
                                data[currentRowIdx][colMap[i]] = val
                                rowHasData = true
                                foundStructuredData = true
                            }
                        }
                    }
                })

                if (rowHasData || explicitRowLetter) {
                    currentRowIdx++
                } else {
                    const maxMappedIdx = Math.max(...Object.keys(colMap).map(Number))
                    if (tokens.length >= maxMappedIdx && maxMappedIdx > 0) {
                        currentRowIdx++
                    }
                }
            }
        }

        if (foundStructuredData) {
            setCsvData(data)
            return true
        }

        // Fallback to strict dense 8x12 numerical grid
        const fallbackData: number[][] = []
        for (const line of lines) {
            const vals = line.split(",").map(v => parseFloat(v.trim()))
            // Take up to 12 valid numbers
            if (vals.length >= 12 && !vals.slice(0, 12).some(isNaN)) {
                fallbackData.push(vals.slice(0, 12))
            }
        }
        if (fallbackData.length >= 8) {
            setCsvData(fallbackData.slice(0, 8))
            return true
        }

        return false
    }, [])

    const handleFile = useCallback((file: File) => {
        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = (e) => {
            const text = e.target?.result as string
            if (!parseCSV(text)) {
                alert("Could not parse file. It must be either a tabular TXT with headers 1-12 and rows A-H, or a dense 8x12 CSV.")
            }
        }
        reader.readAsText(file)
    }, [parseCSV])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFile(file)
    }, [handleFile])

    // Well plate value at row, col
    const getWellValue = (rowIdx: number, colIdx: number) => {
        if (!csvData || rowIdx >= csvData.length || !csvData[rowIdx]) return null
        return csvData[rowIdx][colIdx] ?? null
    }

    const getWellId = (rowIdx: number, colIdx: number) => `${ROWS[rowIdx]}${colIdx + 1}`

    // Color for preview
    const previewMinMax = useMemo(() => {
        if (!csvData) return { min: 0, max: 1 }
        const all = csvData.flat().filter((v): v is number => v !== null && !isNaN(v))
        if (all.length === 0) return { min: 0, max: 1 }
        return { min: Math.min(...all), max: Math.max(...all) }
    }, [csvData])

    const getPreviewColor = (val: number) => {
        const { min, max } = previewMinMax
        if (min === max) return 'hsl(210, 80%, 60%)'
        const norm = (val - min) / (max - min)
        const hue = (1 - norm) * 240
        return `hsl(${hue}, 80%, 55%)`
    }

    // Track which wells are already assigned
    const assignedWells = useMemo(() => {
        const s = new Set<string>()
        for (const a of assignments) {
            for (const w of a.wells) s.add(w)
        }
        return s
    }, [assignments])

    // Toggle well selection
    const toggleWell = (wellId: string) => {
        setSelectedWells(prev => {
            const next = new Set(prev)
            if (next.has(wellId)) next.delete(wellId)
            else next.add(wellId)
            return next
        })
    }

    // Select a full row
    const selectRow = (rowIdx: number) => {
        setSelectedWells(prev => {
            const next = new Set(prev)
            let allSelected = true
            let hasUnassigned = false
            for (let c = 0; c < 12; c++) {
                const id = getWellId(rowIdx, c)
                if (!assignedWells.has(id)) {
                    hasUnassigned = true
                    if (!next.has(id)) allSelected = false
                }
            }
            if (hasUnassigned && allSelected) {
                // Deselect row
                for (let c = 0; c < 12; c++) {
                    const id = getWellId(rowIdx, c)
                    if (!assignedWells.has(id)) next.delete(id)
                }
            } else {
                // Select row
                for (let c = 0; c < 12; c++) {
                    const id = getWellId(rowIdx, c)
                    if (!assignedWells.has(id)) next.add(id)
                }
            }
            return next
        })
    }

    // Select a full column
    const selectCol = (colIdx: number) => {
        setSelectedWells(prev => {
            const next = new Set(prev)
            let allSelected = true
            let hasUnassigned = false
            for (let r = 0; r < 8; r++) {
                const id = getWellId(r, colIdx)
                if (!assignedWells.has(id)) {
                    hasUnassigned = true
                    if (!next.has(id)) allSelected = false
                }
            }
            if (hasUnassigned && allSelected) {
                // Deselect col
                for (let r = 0; r < 8; r++) {
                    const id = getWellId(r, colIdx)
                    if (!assignedWells.has(id)) next.delete(id)
                }
            } else {
                // Select col
                for (let r = 0; r < 8; r++) {
                    const id = getWellId(r, colIdx)
                    if (!assignedWells.has(id)) next.add(id)
                }
            }
            return next
        })
    }

    // Create new assignment from selection
    const createAssignment = () => {
        if (selectedWells.size === 0) return
        const newAssignment: WellAssignment = {
            id: `group-${Date.now()}`,
            wells: new Set(selectedWells),
            inkNumber: "",
            cellLine: "",
            format: "",
            isNewInk: false,
            cpa1Name: "", cpa1Ptg: "",
            cpa2Name: "", cpa2Ptg: "",
            cpa3Name: "", cpa3Ptg: "",
            drugs: [],
        }
        setAssignments(prev => [...prev, newAssignment])
        setEditingAssignment(newAssignment.id)
        setSelectedWells(new Set())
    }

    const updateAssignment = (id: string, updates: Partial<WellAssignment>) => {
        setAssignments(prev => prev.map(a => {
            if (a.id !== id) return a
            const updated = { ...a, ...updates }
            // If an existing ink is chosen, auto-fill CPA data
            if (updates.inkNumber && !updates.isNewInk) {
                const existing = existingInks.find(ink => ink.inkNumber === updates.inkNumber)
                if (existing) {
                    updated.isNewInk = false
                    updated.cpa1Name = existing.cpa1Name
                    updated.cpa1Ptg = existing.cpa1Ptg
                    updated.cpa2Name = existing.cpa2Name
                    updated.cpa2Ptg = existing.cpa2Ptg
                    updated.cpa3Name = existing.cpa3Name
                    updated.cpa3Ptg = existing.cpa3Ptg
                }
            }
            return updated
        }))
    }

    const removeAssignment = (id: string) => {
        setAssignments(prev => prev.filter(a => a.id !== id))
        if (editingAssignment === id) setEditingAssignment(null)
    }

    // Determine next available ink number
    const nextInkNumber = useMemo(() => {
        const existingNums = existingInks.map(i => parseInt(i.inkNumber)).filter(n => !isNaN(n))
        const assignedNums = assignments.filter(a => a.isNewInk).map(a => parseInt(a.inkNumber)).filter(n => !isNaN(n))
        const all = [...existingNums, ...assignedNums]
        return all.length > 0 ? String(Math.max(...all) + 1) : "1"
    }, [existingInks, assignments])

    // Build the final rows for submission
    const finalRows = useMemo(() => {
        if (!csvData) return []
        const rows: any[] = []
        for (const assignment of assignments) {
            for (const wellId of assignment.wells) {
                const rowLetter = wellId[0]
                const colNum = parseInt(wellId.slice(1))
                const rowIdx = ROWS.indexOf(rowLetter as typeof ROWS[number])
                const colIdx = colNum - 1
                const value = getWellValue(rowIdx, colIdx)
                rows.push({
                    wellNumber: wellId,
                    inkNumber: assignment.inkNumber,
                    cellLine: assignment.cellLine,
                    format: assignment.format,
                    result: value ?? 0,
                    cpa1Name: assignment.cpa1Name,
                    cpa1Ptg: assignment.cpa1Ptg,
                    cpa2Name: assignment.cpa2Name,
                    cpa2Ptg: assignment.cpa2Ptg,
                    cpa3Name: assignment.cpa3Name,
                    cpa3Ptg: assignment.cpa3Ptg,
                    drugs: assignment.drugs,
                })
            }
        }
        // Sort by well position
        rows.sort((a, b) => {
            const ra = ROWS.indexOf(a.wellNumber[0])
            const rb = ROWS.indexOf(b.wellNumber[0])
            if (ra !== rb) return ra - rb
            return parseInt(a.wellNumber.slice(1)) - parseInt(b.wellNumber.slice(1))
        })
        return rows
    }, [csvData, assignments])

    // Validate each step
    const canProceedStep2 = date && process && storageTime && assayDay && plateNumber
    const canProceedStep3 = assignments.length > 0 && assignments.every(a => {
        if (!a.cellLine || !a.format) return false;

        const hasInk = !!a.inkNumber && a.inkNumber !== "__none__";
        const hasDrugs = a.drugs && a.drugs.length > 0;

        if (!hasInk && !hasDrugs) return false;

        if (hasDrugs) {
            const allDrugsValid = a.drugs.every(d => d.name.trim() !== "" && d.concentration.trim() !== "");
            if (!allDrugsValid) return false;
        }

        return true;
    })
    const allWellsAssigned = assignedWells.size === 96

    // Submit
    const handleSubmit = async () => {
        setSubmitting(true)
        setSubmitError(null)
        try {
            const res = await fetch("/api/data/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date,
                    process,
                    storageTime,
                    assayDay,
                    plateNumber,
                    wells: finalRows,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Import failed")
            onSuccess()
            handleReset()
            onClose()
        } catch (err: any) {
            setSubmitError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleReset = () => {
        setStep(1)
        setCsvData(null)
        setFileName("")
        setDate("")
        setProcess("Cryobioprinting")
        setStorageTime("")
        setAssayDay("")
        setPlateNumber("")
        setAssignments([])
        setSelectedWells(new Set())
        setEditingAssignment(null)
        setSubmitError(null)
    }

    if (!open) return null

    // Assignment color palette for visual grouping
    const groupColors = [
        "bg-blue-500/20 border-blue-500/50",
        "bg-emerald-500/20 border-emerald-500/50",
        "bg-amber-500/20 border-amber-500/50",
        "bg-purple-500/20 border-purple-500/50",
        "bg-rose-500/20 border-rose-500/50",
        "bg-cyan-500/20 border-cyan-500/50",
        "bg-orange-500/20 border-orange-500/50",
        "bg-indigo-500/20 border-indigo-500/50",
    ]
    const dotColors = [
        "bg-blue-500",
        "bg-emerald-500",
        "bg-amber-500",
        "bg-purple-500",
        "bg-rose-500",
        "bg-cyan-500",
        "bg-orange-500",
        "bg-indigo-500",
    ]

    const getAssignmentForWell = (wellId: string) => {
        const idx = assignments.findIndex(a => a.wells.has(wellId))
        return idx >= 0 ? { assignment: assignments[idx], colorIdx: idx % groupColors.length } : null
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-primary" />
                        <h2 className="font-bold text-lg text-slate-900 dark:text-white">Import Well Plate Data</h2>
                    </div>
                    <button onClick={() => { handleReset(); onClose() }} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-0 px-6 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900">
                    {["Upload File", "Metadata", "Assign Wells", "Review"].map((label, i) => (
                        <React.Fragment key={label}>
                            <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${step > i + 1 ? "text-emerald-600 dark:text-emerald-400" : step === i + 1 ? "text-primary" : "text-slate-400"}`}>
                                <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold border-2 transition-all ${step > i + 1 ? "bg-emerald-500 border-emerald-500 text-white" : step === i + 1 ? "border-primary text-primary bg-primary/10" : "border-slate-300 dark:border-slate-600 text-slate-400"}`}>
                                    {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
                                </div>
                                <span className="hidden sm:inline">{label}</span>
                            </div>
                            {i < 3 && <div className={`flex-1 h-0.5 mx-2 rounded ${step > i + 1 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`} />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* STEP 1 — Upload CSV */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${isDragging ? "border-primary bg-primary/5 scale-[1.01]" : csvData ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-900/10" : "border-slate-300 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                            >
                                <input ref={fileInputRef} type="file" accept=".csv,.txt,text/plain" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
                                {csvData ? (
                                    <div className="space-y-2">
                                        <Check className="w-10 h-10 mx-auto text-emerald-500" />
                                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">{fileName}</p>
                                        <p className="text-sm text-slate-500">Data parsed successfully — {csvData.flat().filter(v => v !== null).length} values detected</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Upload className="w-10 h-10 mx-auto text-slate-400" />
                                        <p className="font-medium text-slate-700 dark:text-slate-300">Drop your file here or click to browse</p>
                                    </div>
                                )}
                            </div>

                            {/* Preview plate */}
                            {csvData && (
                                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Parsed Well Plate Preview</h3>
                                    <div className="grid gap-[3px]" style={{ gridTemplateColumns: '20px repeat(12, 1fr)' }}>
                                        <div></div>
                                        {COLS.map(c => (
                                            <div key={c} className="flex items-center justify-center text-[9px] font-bold text-slate-400">{c}</div>
                                        ))}
                                        {ROWS.map((r, ri) => (
                                            <React.Fragment key={r}>
                                                <div className="flex items-center justify-center text-[9px] font-bold text-slate-400">{r}</div>
                                                {COLS.map((_, ci) => {
                                                    const val = getWellValue(ri, ci)
                                                    return (
                                                        <div key={`${r}${ci + 1}`}
                                                            className="aspect-square rounded-full flex items-center justify-center"
                                                            style={{ backgroundColor: val !== null ? getPreviewColor(val) : 'transparent', border: val !== null ? 'none' : '1.5px solid #cbd5e1', opacity: val !== null ? 0.85 : 0.4 }}
                                                        >
                                                            {val !== null && <span className="text-[7px] font-bold text-white drop-shadow">{Math.round(val)}</span>}
                                                        </div>
                                                    )
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2 — Global Metadata */}
                    {step === 2 && (
                        <div className="max-w-lg mx-auto space-y-5">
                            <div>
                                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Batch Metadata</h3>
                                <p className="text-sm text-slate-500">These values apply to all 96 wells in this import.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="space-y-1.5">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Date <span className="text-destructive">*</span></span>
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Manufacturing Process <span className="text-destructive">*</span></span>
                                    <input type="text" value={process} onChange={e => setProcess(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Storage Time <span className="text-destructive">*</span></span>
                                    <input type="text" value={storageTime} onChange={e => setStorageTime(e.target.value)} placeholder="e.g. 0, 7, 14..." className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Assay Day <span className="text-destructive">*</span></span>
                                    <input type="text" value={assayDay} onChange={e => setAssayDay(e.target.value)} placeholder="e.g. 1, 4, 7..." className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                                </label>
                                <label className="space-y-1.5 sm:col-span-2">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Plate Number <span className="text-destructive">*</span></span>
                                    <input type="text" value={plateNumber} onChange={e => setPlateNumber(e.target.value)} placeholder="e.g. 1, 2, P1..." className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* STEP 3 — Per-Well Assignment */}
                    {step === 3 && csvData && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Assign Wells to Groups</h3>
                                <p className="text-sm text-slate-500">Click wells to select them, then create a group with shared ink number, cell line, and format. Click row/column headers to select entire rows/columns.</p>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-4">
                                {/* Left column: Plate + Action bar */}
                                <div className="flex-1 flex flex-col gap-3">
                                    {/* Well plate selector */}
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                                        <div className="grid gap-[3px]" style={{ gridTemplateColumns: '24px repeat(12, 1fr)' }}>
                                            <div></div>
                                            {COLS.map((c, ci) => (
                                                <button key={c} onClick={() => selectCol(ci)} className="flex items-center justify-center text-[9px] font-bold text-slate-400 hover:text-primary transition-colors cursor-pointer">{c}</button>
                                            ))}
                                            {ROWS.map((r, ri) => (
                                                <React.Fragment key={r}>
                                                    <button onClick={() => selectRow(ri)} className="flex items-center justify-center text-[9px] font-bold text-slate-400 hover:text-primary transition-colors cursor-pointer">{r}</button>
                                                    {COLS.map((_, ci) => {
                                                        const wellId = getWellId(ri, ci)
                                                        const val = getWellValue(ri, ci)
                                                        const assigned = getAssignmentForWell(wellId)
                                                        const isSelected = selectedWells.has(wellId)
                                                        const isAssigned = assignedWells.has(wellId)

                                                        return (
                                                            <button key={wellId}
                                                                onClick={() => !isAssigned && toggleWell(wellId)}
                                                                className={`aspect-square rounded-full flex items-center justify-center text-[7px] font-bold transition-all relative ${isSelected ? "ring-2 ring-primary ring-offset-[1.5px] z-10" : ""
                                                                    } ${isAssigned && assigned ? `${groupColors[assigned.colorIdx]} border` : ""}`}
                                                                style={{
                                                                    backgroundColor: isAssigned ? undefined : (val !== null ? getPreviewColor(val) : 'transparent'),
                                                                    border: !isAssigned && val === null ? '1.5px solid #cbd5e1' : undefined,
                                                                    opacity: isAssigned ? 1 : (val !== null ? 0.7 : 0.3),
                                                                    cursor: isAssigned ? 'default' : 'pointer',
                                                                }}
                                                                disabled={isAssigned}
                                                            >
                                                                {val !== null && <span className={`drop-shadow ${isAssigned ? "text-slate-700 dark:text-slate-200" : "text-white"}`}>{Math.round(val)}</span>}
                                                            </button>
                                                        )
                                                    })}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>

                                    {selectedWells.size > 0 && (
                                        <div className="flex items-center justify-between bg-white dark:bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                                <span className="font-bold text-primary text-lg px-1">{selectedWells.size}</span> wells selected
                                            </span>
                                            <div className="flex gap-2">
                                                <button onClick={() => setSelectedWells(new Set())} className="text-sm px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                    Clear
                                                </button>
                                                <button onClick={createAssignment} className="text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm">
                                                    <Plus className="w-4 h-4" /> Create Group
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Group editors */}
                                <div className="w-full lg:w-80 space-y-3 max-h-[500px] overflow-y-auto">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Groups ({assignments.length})</span>
                                        <span className="text-xs text-slate-400">{assignedWells.size}/96 assigned</span>
                                    </div>

                                    {assignments.length === 0 && (
                                        <div className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                                            Select wells on the plate, then click "Create Group"
                                        </div>
                                    )}

                                    {assignments.map((a, idx) => {
                                        const colorIdx = idx % groupColors.length
                                        const isEditing = editingAssignment === a.id
                                        const existingInkNumbers = existingInks.map(ink => ink.inkNumber)

                                        return (
                                            <div key={a.id} className={`rounded-lg border p-3 space-y-2 transition-all ${groupColors[colorIdx]}`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-3 h-3 rounded-full ${dotColors[colorIdx]}`} />
                                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                            {a.inkNumber ? `Ink ${a.inkNumber}` : (a.drugs && a.drugs.length > 0 ? "Custom Drugs" : "Unassigned")} · {a.wells.size} wells
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => setEditingAssignment(isEditing ? null : a.id)} className="p-1 rounded hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors text-slate-500">
                                                            {isEditing ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        <button onClick={() => removeAssignment(a.id)} className="p-1 rounded hover:bg-destructive/20 transition-colors text-destructive/70">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {isEditing && (
                                                    <div className="space-y-2 pt-1">
                                                        <label className="space-y-1">
                                                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Ink Number</span>
                                                            <div className="flex gap-1">
                                                                <Select
                                                                    value={a.isNewInk ? "__new__" : (a.inkNumber || "__none__")}
                                                                    onValueChange={(val) => {
                                                                        if (val === "__new__") {
                                                                            updateAssignment(a.id, { isNewInk: true, inkNumber: nextInkNumber, cpa1Name: "", cpa1Ptg: "", cpa2Name: "", cpa2Ptg: "", cpa3Name: "", cpa3Ptg: "" })
                                                                        } else if (val === "__none__") {
                                                                            updateAssignment(a.id, { isNewInk: false, inkNumber: "", cpa1Name: "", cpa1Ptg: "", cpa2Name: "", cpa2Ptg: "", cpa3Name: "", cpa3Ptg: "" })
                                                                        } else {
                                                                            updateAssignment(a.id, { isNewInk: false, inkNumber: val })
                                                                        }
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="flex-1 h-8 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-1 focus:ring-primary shadow-sm">
                                                                        <SelectValue placeholder="Select ink..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="max-h-56">
                                                                        <SelectItem value="__none__" className="text-slate-500 italic">No Ink</SelectItem>
                                                                        {existingInks.map(ink => {
                                                                            const parts = []
                                                                            if (ink.cpa1Name) parts.push(`${ink.cpa1Name} ${ink.cpa1Ptg}%`)
                                                                            if (ink.cpa2Name) parts.push(`${ink.cpa2Name} ${ink.cpa2Ptg}%`)
                                                                            if (ink.cpa3Name) parts.push(`${ink.cpa3Name} ${ink.cpa3Ptg}%`)
                                                                            const formula = parts.length > 0 ? parts.join(" / ") : "No formulation"
                                                                            return (
                                                                                <SelectItem key={ink.inkNumber} value={ink.inkNumber}>
                                                                                    {ink.inkNumber} <span className="text-slate-400 text-[10px] ml-2 font-normal hidden sm:inline-block">— {formula}</span>
                                                                                </SelectItem>
                                                                            )
                                                                        })}
                                                                        <SelectItem value="__new__" className="text-primary font-bold">+ Add new ink</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </label>

                                                        {a.isNewInk && (
                                                            <div className="bg-white/60 dark:bg-slate-800/60 rounded-md p-2 space-y-2 border border-slate-200/50 dark:border-slate-700/50">
                                                                <p className="text-[10px] font-bold text-primary uppercase">New Ink #{a.inkNumber} — Formulation</p>
                                                                <div className="grid grid-cols-2 gap-1.5">
                                                                    <input type="text" placeholder="CPA1 Name" value={a.cpa1Name} onChange={e => updateAssignment(a.id, { cpa1Name: e.target.value })} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none" />
                                                                    <input type="text" placeholder="CPA1 %" value={a.cpa1Ptg} onChange={e => updateAssignment(a.id, { cpa1Ptg: e.target.value })} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none" />
                                                                    <input type="text" placeholder="CPA2 Name" value={a.cpa2Name} onChange={e => updateAssignment(a.id, { cpa2Name: e.target.value })} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none" />
                                                                    <input type="text" placeholder="CPA2 %" value={a.cpa2Ptg} onChange={e => updateAssignment(a.id, { cpa2Ptg: e.target.value })} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none" />
                                                                    <input type="text" placeholder="CPA3 Name" value={a.cpa3Name} onChange={e => updateAssignment(a.id, { cpa3Name: e.target.value })} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none" />
                                                                    <input type="text" placeholder="CPA3 %" value={a.cpa3Ptg} onChange={e => updateAssignment(a.id, { cpa3Ptg: e.target.value })} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none" />
                                                                </div>
                                                            </div>
                                                        )}

                                                        <label className="space-y-1">
                                                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Cell Line</span>
                                                            <input type="text" value={a.cellLine} onChange={e => updateAssignment(a.id, { cellLine: e.target.value })} placeholder="e.g. MCF7, HepG2..." className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-1 focus:ring-primary" />
                                                        </label>
                                                        <label className="space-y-1">
                                                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Format</span>
                                                            <input type="text" value={a.format} onChange={e => updateAssignment(a.id, { format: e.target.value })} placeholder="e.g. Pipet, Bioprint..." className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-1 focus:ring-primary" />
                                                        </label>

                                                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="text-[10px] font-semibold text-slate-500 uppercase">Drugs (Optional)</span>
                                                                <button onClick={() => updateAssignment(a.id, { drugs: [...(a.drugs || []), { name: "", concentration: "" }] })} className="text-[10px] text-primary hover:text-primary/80 font-semibold flex items-center gap-1">
                                                                    <Plus className="w-3 h-3" /> Add Drug
                                                                </button>
                                                            </div>
                                                            {a.drugs && a.drugs.length > 0 && (
                                                                <div className="space-y-1.5">
                                                                    {a.drugs.map((drug, dIdx) => (
                                                                        <div key={dIdx} className="flex gap-1.5 items-center">
                                                                            <input type="text" placeholder="Drug Name" value={drug.name} onChange={e => {
                                                                                const newDrugs = [...a.drugs];
                                                                                newDrugs[dIdx].name = e.target.value;
                                                                                updateAssignment(a.id, { drugs: newDrugs });
                                                                            }} className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-1 focus:ring-primary min-w-0" />
                                                                            <input type="text" placeholder="Conc." value={drug.concentration} onChange={e => {
                                                                                const newDrugs = [...a.drugs];
                                                                                newDrugs[dIdx].concentration = e.target.value;
                                                                                updateAssignment(a.id, { drugs: newDrugs });
                                                                            }} className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-1 focus:ring-primary shrink-0" />
                                                                            <button onClick={() => {
                                                                                const newDrugs = [...a.drugs];
                                                                                newDrugs.splice(dIdx, 1);
                                                                                updateAssignment(a.id, { drugs: newDrugs });
                                                                            }} className="p-1 text-slate-400 hover:text-destructive transition-colors shrink-0">
                                                                                <X className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4 — Review & Submit */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Review Import</h3>
                                <p className="text-sm text-slate-500">{finalRows.length} rows will be appended to the dataset.</p>
                            </div>

                            {/* Summary cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {[
                                    { label: "Date", value: date },
                                    { label: "Process", value: process },
                                    { label: "Storage Time", value: storageTime },
                                    { label: "Assay Day", value: assayDay },
                                    { label: "Plate #", value: plateNumber },
                                ].map(item => (
                                    <div key={item.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase">{item.label}</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{item.value || "—"}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Group summary */}
                            <div className="space-y-2">
                                {assignments.map((a, idx) => (
                                    <div key={a.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${groupColors[idx % groupColors.length]}`}>
                                        <div className={`w-3 h-3 rounded-full ${dotColors[idx % dotColors.length]}`} />
                                        <div className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                Ink {a.inkNumber} · {a.cellLine} · {a.format} — <span className="font-bold">{a.wells.size} wells</span>
                                            </span>
                                            {a.isNewInk && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">NEW INK</span>}
                                            {a.drugs && a.drugs.length > 0 && <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">+{a.drugs.length} DRUGS</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Data preview table */}
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden max-h-60 overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Well</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Ink #</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Cell Line</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Format</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {finalRows.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-3 py-1.5 font-mono font-bold text-slate-700 dark:text-slate-300">{row.wellNumber}</td>
                                                <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{row.inkNumber}</td>
                                                <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{row.cellLine}</td>
                                                <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{row.format}</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-900 dark:text-white">{typeof row.result === 'number' ? row.result.toFixed(2) : row.result}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {submitError && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {submitError}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        onClick={() => step > 1 && setStep(step - 1)}
                        disabled={step === 1}
                        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-4 h-4" /> Back
                    </button>

                    <div className="flex gap-2">
                        {step < 4 ? (
                            <button
                                onClick={() => setStep(step + 1)}
                                disabled={
                                    (step === 1 && !csvData) ||
                                    (step === 2 && !canProceedStep2) ||
                                    (step === 3 && !canProceedStep3)
                                }
                                className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || finalRows.length === 0}
                                className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                                ) : (
                                    <><Check className="w-4 h-4" /> Import {finalRows.length} Rows</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
