"use client"

import React, { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, SlidersHorizontal, ArrowUpDown } from "lucide-react"
import Link from "next/link"

interface DynamicDataTableProps {
    headers: string[]
    rows: string[][]
    isReadOnly?: boolean
}

export function DynamicDataTable({ headers, rows, isReadOnly }: DynamicDataTableProps) {
    // Indexes
    const idxCellLine = headers.indexOf("Cell_Line")
    const idxInkNumber = headers.indexOf("Ink_Number")
    const idxCPA1Name = headers.indexOf("CPA1_name")
    const idxCPA1Ptg = headers.indexOf("CPA1_ptg")
    const idxCPA2Name = headers.indexOf("CPA2_name")
    const idxCPA2Ptg = headers.indexOf("CPA2_ptg")
    const idxCPA3Name = headers.indexOf("CPA3_name")
    const idxCPA3Ptg = headers.indexOf("CPA3_ptg")
    const idxDrugs = headers.indexOf("Drugs")

    const groupedData = useMemo(() => {
        const groups: Record<string, {
            inkNumber: string
            cellLine: string
            cpa1Name: string
            cpa1Ptg: string
            cpa2Name: string
            cpa2Ptg: string
            cpa3Name: string
            cpa3Ptg: string
            drugs: any
        }> = {}

        for (const row of rows) {
            const inkNumber = row[idxInkNumber] || ""
            const cellLine = row[idxCellLine] || ""

            // Skip rows with no data to avoid showing an N/A row at the end
            if (!inkNumber && !cellLine && !row[idxCPA1Name]) continue;

            const rawDrugs = row[idxDrugs] || "";
            const key = `${inkNumber}-${cellLine}-${rawDrugs}`

            if (!groups[key]) {
                let parsedDrugs = null;
                if (idxDrugs >= 0 && row[idxDrugs]) {
                    try {
                        parsedDrugs = JSON.parse(row[idxDrugs]);
                    } catch (e) {
                        console.error("Failed to parse drugs JSON", e);
                    }
                }

                groups[key] = {
                    inkNumber,
                    cellLine,
                    cpa1Name: row[idxCPA1Name] || "",
                    cpa1Ptg: row[idxCPA1Ptg] || "",
                    cpa2Name: row[idxCPA2Name] || "",
                    cpa2Ptg: row[idxCPA2Ptg] || "",
                    cpa3Name: row[idxCPA3Name] || "",
                    cpa3Ptg: row[idxCPA3Ptg] || "",
                    drugs: parsedDrugs,
                }
            }
        }
        return Object.values(groups)
    }, [rows, idxCellLine, idxInkNumber, idxCPA1Name, idxCPA1Ptg, idxCPA2Name, idxCPA2Ptg, idxCPA3Name, idxCPA3Ptg, idxDrugs])

    const uniqueCellLines = useMemo(() => {
        const lines = new Set<string>()
        for (const row of rows) {
            const val = row[idxCellLine]
            if (val) lines.add(val)
        }
        return Array.from(lines).sort()
    }, [rows, idxCellLine])

    const uniqueCPAs = useMemo(() => {
        const cpas = new Set<string>()
        for (const row of rows) {
            if (row[idxCPA1Name]) cpas.add(row[idxCPA1Name])
            if (row[idxCPA2Name]) cpas.add(row[idxCPA2Name])
            if (row[idxCPA3Name]) cpas.add(row[idxCPA3Name])
        }
        return Array.from(cpas).sort()
    }, [rows, idxCPA1Name, idxCPA2Name, idxCPA3Name])

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: "asc" | "desc" } | null>(null)
    const [filterCellLines, setFilterCellLines] = useState<string[]>([])
    const [filterCPAs, setFilterCPAs] = useState<string[]>([])
    const [showFilters, setShowFilters] = useState(false)

    const processedData = useMemo(() => {
        let result = [...groupedData]

        // Filtering
        if (filterCellLines.length > 0) {
            result = result.filter(g => filterCellLines.includes(g.cellLine))
        }
        if (filterCPAs.length > 0) {
            result = result.filter(g => {
                const groupCpasWithPtg = [
                    g.cpa1Name && parseFloat(g.cpa1Ptg) > 0 ? g.cpa1Name : null,
                    g.cpa2Name && parseFloat(g.cpa2Ptg) > 0 ? g.cpa2Name : null,
                    g.cpa3Name && parseFloat(g.cpa3Ptg) > 0 ? g.cpa3Name : null,
                ].filter(Boolean)
                return filterCPAs.every(cpa => groupCpasWithPtg.includes(cpa))
            })
        }

        // Sorting
        if (sortConfig) {
            result.sort((a, b) => {
                let valA: string | number = "";
                let valB: string | number = "";

                if (sortConfig.key === "inkNumber") {
                    // Try to sort numerically if possible, otherwise string format
                    const numA = parseInt(String(a.inkNumber).replace(/\D/g, ''), 10);
                    const numB = parseInt(String(b.inkNumber).replace(/\D/g, ''), 10);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        valA = numA; valB = numB;
                    } else {
                        valA = a.inkNumber; valB = b.inkNumber;
                    }
                } else if (sortConfig.key === "cellLine") {
                    valA = a.cellLine; valB = b.cellLine;
                } else {
                    // Sort by CPA percentage
                    const getPtg = (g: any, cpa: string) => {
                        if (g.cpa1Name === cpa) return parseFloat(g.cpa1Ptg) || 0;
                        if (g.cpa2Name === cpa) return parseFloat(g.cpa2Ptg) || 0;
                        if (g.cpa3Name === cpa) return parseFloat(g.cpa3Ptg) || 0;
                        return 0;
                    }
                    valA = getPtg(a, sortConfig.key);
                    valB = getPtg(b, sortConfig.key);
                }

                if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
                if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            })
        }

        return result
    }, [groupedData, filterCellLines, filterCPAs, sortConfig])

    const toggleExpansion = (key: string) => {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(key)) {
                newSet.delete(key)
            } else {
                newSet.add(key)
            }
            return newSet
        })
    }

    const toggleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                if (prev.direction === "asc") return { key, direction: "desc" }
                return null
            }
            return { key, direction: "asc" }
        })
    }

    const toggleFilterCPA = (cpa: string) => {
        setFilterCPAs(prev => prev.includes(cpa) ? prev.filter(c => c !== cpa) : [...prev, cpa])
        // Close expansions when filtering changes to avoid confusing states
        setExpandedGroups(new Set())
    }

    const toggleFilterCellLine = (cl: string) => {
        setFilterCellLines(prev => prev.includes(cl) ? prev.filter(c => c !== cl) : [...prev, cl])
        setExpandedGroups(new Set())
    }

    const formatFormulation = (group: any) => {
        const parts = []
        if (group.cpa1Name && parseFloat(group.cpa1Ptg) > 0) parts.push(`${group.cpa1Name}: ${parseFloat(group.cpa1Ptg)}%`)
        if (group.cpa2Name && parseFloat(group.cpa2Ptg) > 0) parts.push(`${group.cpa2Name}: ${parseFloat(group.cpa2Ptg)}%`)
        if (group.cpa3Name && parseFloat(group.cpa3Ptg) > 0) parts.push(`${group.cpa3Name}: ${parseFloat(group.cpa3Ptg)}%`)
        return parts.length > 0 ? parts.join(", ") : "No formulation data available"
    }

    return (
        <div className="w-full">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-card shadow-sm">
                {/* Header / Filter Toggle */}
                <div className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-lg">Ink Formulations</h3>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md transition-colors border shadow-sm ${showFilters
                            ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        {showFilters ? 'Hide Filters & Sort' : 'Filters & Sort'}
                    </button>
                </div>

                {/* Controls Area */}
                {showFilters && (
                    <div className="flex flex-col gap-6 bg-slate-50/50 dark:bg-slate-900/30 p-6 border-b border-slate-200 dark:border-slate-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* CPAs Filter */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Formulation</label>
                                <div className="flex flex-wrap gap-2">
                                    {uniqueCPAs.map(cpa => (
                                        <button
                                            key={cpa}
                                            onClick={() => toggleFilterCPA(cpa)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all border shadow-sm ${filterCPAs.includes(cpa)
                                                ? "bg-primary text-primary-foreground border-primary shadow-primary/20 scale-105"
                                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                                }`}
                                        >
                                            {cpa}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Cell Lines Filter */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cell Lines</label>
                                <div className="flex flex-wrap gap-2">
                                    {uniqueCellLines.map(cl => (
                                        <button
                                            key={cl}
                                            onClick={() => toggleFilterCellLine(cl)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all border shadow-sm ${filterCellLines.includes(cl)
                                                ? "bg-primary text-primary-foreground border-primary shadow-primary/20 scale-105"
                                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                                }`}
                                        >
                                            {cl}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-slate-200 dark:bg-slate-800 full-width" />

                        {/* Sorting */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sort By</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: "Ink Number", key: "inkNumber" },
                                    { label: "Cell Line", key: "cellLine" },
                                    ...uniqueCPAs.map(cpa => ({ label: `% ${cpa}`, key: cpa }))
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

                <table className="w-full text-base text-left border-collapse">
                    <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-800 hidden sm:table-header-group">
                        <tr>
                            <th className="px-6 py-4 w-12 rounded-tl-md"></th>
                            <th className="px-6 py-4">Formulation / Drugs</th>
                            <th className="px-6 py-4 rounded-tr-md">Cell Line</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {processedData.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                    No formulations match the current filters.
                                </td>
                            </tr>
                        ) : processedData.map((group, i) => {
                            const key = `${group.inkNumber}-${group.cellLine}`
                            const isExpanded = expandedGroups.has(key)

                            return (
                                <React.Fragment key={i}>
                                    <tr
                                        className="bg-white dark:bg-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all cursor-pointer group"
                                        onClick={() => toggleExpansion(key)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center p-1.5 rounded-md group-hover:bg-slate-200/80 dark:group-hover:bg-slate-700 transition-colors w-7 h-7">
                                                {isExpanded ? (
                                                    <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                                ) : (
                                                    <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                                                {group.inkNumber ? `Ink ${group.inkNumber}` : "No Ink"}
                                            </div>
                                            {group.drugs && Object.keys(group.drugs).length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {Object.values(group.drugs).map((d: any, dIdx) => (
                                                        <span key={dIdx} className="text-[10px] text-amber-700 dark:text-amber-400 font-medium bg-amber-500/10 dark:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/20 dark:border-amber-500/30 flex items-center gap-1">
                                                            <span className="font-bold">{d.name}</span>
                                                            <span className="opacity-70">/ {d.concentration}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 dark:text-slate-400 font-medium align-top">{group.cellLine || "N/A"}</td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                                            <td className="px-6 py-5 border-r border-slate-100 dark:border-slate-800/50"></td>
                                            <td colSpan={2} className="px-6 py-5">
                                                <div className="bg-white dark:bg-slate-900/90 p-5 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.5)] border border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-sm uppercase tracking-wider text-primary">Ink Formulation:</span>
                                                        <span className="text-slate-800 dark:text-slate-200 sm:ml-2 font-medium bg-slate-100/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-200/50 dark:border-slate-700/50">{formatFormulation(group)}</span>
                                                    </div>
                                                    {!isReadOnly && (
                                                        <Link
                                                            href={`/dashboard/data/${encodeURIComponent(group.inkNumber || "no-ink")}/${encodeURIComponent(group.cellLine)}${group.drugs && Object.keys(group.drugs).length > 0 ? `?drugs=${encodeURIComponent(JSON.stringify(group.drugs))}` : ""}`}
                                                            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:bg-primary/90 transition-colors shrink-0"
                                                        >
                                                            View Details
                                                            <ChevronRight className="w-4 h-4" />
                                                        </Link>
                                                    )}
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
    )
}
