"use client"

import React, { useState, useMemo } from "react"
import { SlidersHorizontal, ArrowUpDown, ChevronDown, ChevronRight, Activity } from "lucide-react"
import { useRouter } from "next/navigation"

// Helper to convert Excel serial dates to standard Date strings
function formatExcelDate(serial: string) {
    if (!serial) return ""
    // Pass through if it's already a formatted date string
    if (serial.includes("-") || serial.includes("/")) return serial;

    // Reject parsing if not strictly numeric
    const num = Number(serial)
    if (isNaN(num)) return serial

    // Excel dates are days since Dec 30, 1899
    const excelEpoch = new Date(1899, 11, 30) // Months are 0-indexed in JS
    const date = new Date(excelEpoch.getTime() + num * 86400000)
    return date.toISOString().split('T')[0] // Returns YYYY-MM-DD
}

export interface DetailedResultsData {
    wellNumber?: string
    date: string
    storageTime: string
    assayDay: string
    format: string
    process: string
    result: string
}

interface DetailedResultsTableProps {
    inkNumber: string
    cellLine: string
    formulation: string
    drugs?: any
    data: DetailedResultsData[]
}

export function DetailedResultsTable({ inkNumber, cellLine, formulation, drugs, data }: DetailedResultsTableProps) {
    const router = useRouter()
    const [sortConfig, setSortConfig] = useState<{ key: keyof DetailedResultsData, direction: "asc" | "desc" } | null>(null)
    const [showFilters, setShowFilters] = useState(false)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const [filterStorageTime, setFilterStorageTime] = useState<string[]>([])
    const [filterAssayDay, setFilterAssayDay] = useState<string[]>([])
    const [filterFormat, setFilterFormat] = useState<string[]>([])

    const uniqueStorageTimes = useMemo(() => Array.from(new Set(data.map(d => d.storageTime).filter(Boolean))).sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b)), [data])
    const uniqueAssayDays = useMemo(() => Array.from(new Set(data.map(d => d.assayDay).filter(Boolean))).sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b)), [data])
    const uniqueFormats = useMemo(() => Array.from(new Set(data.map(d => d.format).filter(Boolean))).sort(), [data])

    const processedData = useMemo(() => {
        let result = [...data]

        // Default grouping for triplicates: sort by condition fields
        result.sort((a, b) => {
            const keyA = `${a.date}-${a.storageTime}-${a.assayDay}-${a.format}-${a.process}`
            const keyB = `${b.date}-${b.storageTime}-${b.assayDay}-${b.format}-${b.process}`
            if (keyA < keyB) return -1
            if (keyA > keyB) return 1
            return 0
        })

        if (filterStorageTime.length > 0) result = result.filter(d => filterStorageTime.includes(d.storageTime))
        if (filterAssayDay.length > 0) result = result.filter(d => filterAssayDay.includes(d.assayDay))
        if (filterFormat.length > 0) result = result.filter(d => filterFormat.includes(d.format))

        if (sortConfig) {
            result.sort((a, b) => {
                const valA = a[sortConfig.key] || ""
                const valB = b[sortConfig.key] || ""
                const numA = parseFloat(valA)
                const numB = parseFloat(valB)
                const isNum = !isNaN(numA) && !isNaN(numB)
                const cmp = isNum ? numA - numB : valA.localeCompare(valB)
                return sortConfig.direction === "asc" ? cmp : -cmp
            })
        }

        return result
    }, [data, filterStorageTime, filterAssayDay, filterFormat, sortConfig])

    const groupedResults = useMemo(() => {
        const groups: Record<string, {
            date: string
            storageTime: string
            assayDay: string
            format: string
            process: string
            replicates: DetailedResultsData[]
        }> = {}
        const orderedKeys: string[] = []

        processedData.forEach(row => {
            const key = `${row.date}-${row.storageTime}-${row.assayDay}-${row.format}-${row.process}`
            if (!groups[key]) {
                groups[key] = {
                    date: row.date,
                    storageTime: row.storageTime,
                    assayDay: row.assayDay,
                    format: row.format,
                    process: row.process,
                    replicates: []
                }
                orderedKeys.push(key)
            }
            groups[key].replicates.push(row)
        })

        return orderedKeys.map(k => ({ key: k, ...groups[k] }))
    }, [processedData])

    const toggleExpansion = (key: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const toggleSort = (key: keyof DetailedResultsData) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                if (prev.direction === "asc") return { key, direction: "desc" }
                return null
            }
            return { key, direction: "asc" }
        })
    }

    const toggleFilterST = (st: string) => setFilterStorageTime(p => p.includes(st) ? p.filter(x => x !== st) : [...p, st])
    const toggleFilterAD = (ad: string) => setFilterAssayDay(p => p.includes(ad) ? p.filter(x => x !== ad) : [...p, ad])
    const toggleFilterFmt = (fmt: string) => setFilterFormat(p => p.includes(fmt) ? p.filter(x => x !== fmt) : [...p, fmt])

    const navigateToPlate = (group: { date: string, storageTime: string, assayDay: string, format: string, process: string }) => {
        const queryParams = new URLSearchParams()
        if (group.date) queryParams.set("date", group.date)
        if (group.storageTime !== "") queryParams.set("storageTime", group.storageTime)
        if (group.assayDay !== "") queryParams.set("assayDay", group.assayDay)
        if (group.format !== "") queryParams.set("format", group.format)
        if (group.process !== "") queryParams.set("process", group.process)
        if (drugs && Object.keys(drugs).length > 0) {
            queryParams.set("drugs", JSON.stringify(drugs))
        }

        router.push(`/dashboard/data/${encodeURIComponent(inkNumber || "no-ink")}/${encodeURIComponent(cellLine)}/plate?${queryParams.toString()}`)
    }

    return (
        <div className="w-full flex flex-col gap-6">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-card shadow-sm">

                {/* Header Container */}
                <div className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">
                            Cell Line: <span className="text-slate-900 dark:text-slate-100 uppercase tracking-wide">{cellLine}</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3 flex-wrap">
                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-md text-xl">{inkNumber ? inkNumber : "No Ink"}</span>
                            <span className="text-slate-400 dark:text-slate-500 font-light hidden sm:inline-block">|</span>
                            {drugs && Object.keys(drugs).length > 0 ? (
                                <div className="flex gap-2 items-center flex-wrap">
                                    {Object.values(drugs).map((d: any, dIdx) => (
                                        <span key={dIdx} className="text-sm text-amber-700 dark:text-amber-400 font-medium bg-amber-500/10 dark:bg-amber-500/20 px-2.5 py-1 rounded-md border border-amber-500/30 flex items-center gap-1.5">
                                            <span className="font-bold">{d.name}</span>
                                            <span className="opacity-70">/ {d.concentration}</span>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-lg font-medium text-slate-700 dark:text-slate-300">{formulation}</span>
                            )}
                        </h2>
                    </div>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-md transition-colors border shadow-sm ${showFilters
                            ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        {showFilters ? 'Hide Filters & Sort' : 'Filters & Sort'}
                    </button>
                </div>

                {/* Filters Area */}
                {showFilters && (
                    <div className="flex flex-col gap-6 bg-slate-50/50 dark:bg-slate-900/30 p-6 border-b border-slate-200 dark:border-slate-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {/* Storage Time Filter */}
                            {uniqueStorageTimes.length > 0 && (
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Storage Time</label>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueStorageTimes.map(st => (
                                            <button
                                                key={st}
                                                onClick={() => toggleFilterST(st)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all border shadow-sm ${filterStorageTime.includes(st)
                                                    ? "bg-primary text-primary-foreground border-primary shadow-primary/20 scale-105"
                                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                    }`}
                                            >
                                                {st}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Assay Day Filter */}
                            {uniqueAssayDays.length > 0 && (
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assay Day</label>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueAssayDays.map(ad => (
                                            <button
                                                key={ad}
                                                onClick={() => toggleFilterAD(ad)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all border shadow-sm ${filterAssayDay.includes(ad)
                                                    ? "bg-primary text-primary-foreground border-primary shadow-primary/20 scale-105"
                                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                    }`}
                                            >
                                                {ad}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Format Filter */}
                            {uniqueFormats.length > 0 && (
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Format</label>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueFormats.map(fmt => (
                                            <button
                                                key={fmt}
                                                onClick={() => toggleFilterFmt(fmt)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all border shadow-sm ${filterFormat.includes(fmt)
                                                    ? "bg-primary text-primary-foreground border-primary shadow-primary/20 scale-105"
                                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                    }`}
                                            >
                                                {fmt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>

                        <div className="h-px bg-slate-200 dark:bg-slate-800 full-width" />

                        {/* Sorting Area */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sort By Column</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: "Date", key: "date" as keyof DetailedResultsData },
                                    { label: "Storage Time", key: "storageTime" as keyof DetailedResultsData },
                                    { label: "Assay Day", key: "assayDay" as keyof DetailedResultsData },
                                    { label: "Format", key: "format" as keyof DetailedResultsData },
                                    { label: "Process", key: "process" as keyof DetailedResultsData },
                                    { label: "Result", key: "result" as keyof DetailedResultsData }
                                ].map(option => (
                                    <button
                                        key={option.key}
                                        onClick={() => toggleSort(option.key)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all border shadow-sm ${sortConfig?.key === option.key
                                            ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 shadow-md"
                                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                            }`}
                                    >
                                        {option.label}
                                        {sortConfig?.key === option.key && (
                                            <ArrowUpDown className={`w-3 h-3 ${sortConfig.direction === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Table */}
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-base text-left border-collapse">
                        <thead className="bg-slate-100/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 border-r border-slate-200/50 dark:border-slate-700/50">Date</th>
                                <th className="px-4 py-4 border-r border-slate-200/50 dark:border-slate-700/50">Storage Time</th>
                                <th className="px-4 py-4 border-r border-slate-200/50 dark:border-slate-700/50">Assay Day</th>
                                <th className="px-4 py-4 border-r border-slate-200/50 dark:border-slate-700/50">Format</th>
                                <th className="px-4 py-4 border-r border-slate-200/50 dark:border-slate-700/50">Process</th>
                                <th className="px-6 py-4 text-primary">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {groupedResults.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        No results match the current filters.
                                    </td>
                                </tr>
                            ) : groupedResults.map((group, i) => {
                                const isExpanded = expandedGroups.has(group.key)
                                return (
                                    <React.Fragment key={group.key}>
                                        <tr
                                            onClick={(e) => toggleExpansion(group.key, e)}
                                            className={`cursor-pointer bg-white dark:bg-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group ${isExpanded ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''
                                                }`}>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center justify-center p-1 rounded-md group-hover:bg-slate-200/80 dark:group-hover:bg-slate-700 transition-colors w-6 h-6 shrink-0">
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                                        )}
                                                    </div>
                                                    <span className="font-medium">{formatExcelDate(group.date)}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-slate-700 dark:text-slate-300 font-medium">{group.storageTime !== "" ? group.storageTime : "-"}</td>
                                            <td className="px-4 py-4 text-slate-700 dark:text-slate-300 font-medium">{group.assayDay !== "" ? group.assayDay : "-"}</td>
                                            <td className="px-4 py-4 text-slate-700 dark:text-slate-300 font-medium">{group.format !== "" ? group.format : "-"}</td>
                                            <td className="px-4 py-4 text-slate-600 dark:text-slate-400 text-sm font-medium">{group.process !== "" ? group.process : "-"}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 font-semibold text-primary">
                                                    <span className="px-2.5 py-1 bg-primary/10 rounded-md text-sm">{group.replicates.length} Replicates</span>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                                                <td colSpan={6} className="px-6 py-8">
                                                    <div className="w-full max-w-xl mx-auto bg-white dark:bg-card rounded-xl p-6 shadow-md border border-slate-200/80 dark:border-slate-800 flex flex-col gap-5">

                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                                All Results ({group.replicates.length} Replicates)
                                                            </h4>
                                                            {/* Action Button */}
                                                            <button
                                                                onClick={() => navigateToPlate(group)}
                                                                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-lg shadow-sm hover:bg-primary/90 transition-colors shrink-0 whitespace-nowrap text-sm"
                                                            >
                                                                <Activity className="w-4 h-4" />
                                                                View Plate Visualization
                                                            </button>
                                                        </div>

                                                        {/* Replicates Table */}
                                                        <div className="w-full max-h-[240px] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 relative shadow-inner">
                                                            <table className="w-full text-sm text-center">
                                                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10 shadow-sm border-b border-slate-200 dark:border-slate-700">
                                                                    <tr>
                                                                        <th className="px-5 py-3 w-1/2 text-center">Well</th>
                                                                        <th className="px-5 py-3 w-1/2 text-center">Result</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/50">
                                                                    {group.replicates.map((r, ri) => (
                                                                        <tr key={ri} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                                                                            <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-300 text-center">{r.wellNumber || "N/A"}</td>
                                                                            <td className="px-5 py-3 font-mono text-slate-900 dark:text-slate-100 text-center">{
                                                                                r.result !== "" ? (!isNaN(parseFloat(r.result)) ? parseFloat(r.result).toFixed(4) : r.result) : "-"
                                                                            }</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    )
}
