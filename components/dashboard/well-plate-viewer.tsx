"use client"

import React, { useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"

export interface DetailedResultsData {
    wellNumber?: string
    date: string
    storageTime: string
    assayDay: string
    format: string
    process: string
    result: string
}

interface WellPlateViewerProps {
    inkNumber: string
    cellLine: string
    formulation: string
    drugs?: any
    conditions: {
        date: string
        storageTime: string
        assayDay: string
        format: string
        process: string
    }
    data: DetailedResultsData[]
    
    // Comparison Feature
    availableBatches?: any[]
    compareData?: DetailedResultsData[]
    compareConditions?: {
        inkNumber: string
        cellLine: string
        formulation: string
        drugs?: any
        date: string
        storageTime: string
        assayDay: string
        format: string
        process: string
    }
}

interface WellDisplayData {
    value: number
    rawData: DetailedResultsData
    isCompare: boolean
}

export function WellPlateViewer({ inkNumber, cellLine, formulation, drugs, conditions, data, availableBatches = [], compareData = [], compareConditions }: WellPlateViewerProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Parse numerical results for color mapping and metrics
    const numericData = useMemo(() => {
        const primary = data.map(d => parseFloat(d.result)).filter(n => !isNaN(n))
        const compare = compareData.map(d => parseFloat(d.result)).filter(n => !isNaN(n))
        return { primary, compare, combined: [...primary, ...compare] }
    }, [data, compareData])

    // Calculate metrics for primary batch
    const pMetrics = useMemo(() => {
        const nData = numericData.primary
        if (nData.length === 0) return { mean: 0, sd: 0, cv: 0 }
        const sum = nData.reduce((acc, val) => acc + val, 0)
        const currentMean = sum / nData.length
        const variance = nData.reduce((acc, val) => acc + Math.pow(val - currentMean, 2), 0) / nData.length
        const currentSd = Math.sqrt(variance)
        const currentCv = currentMean !== 0 ? (currentSd / currentMean) * 100 : 0
        return { mean: currentMean, sd: currentSd, cv: currentCv }
    }, [numericData])

    // Calculate metrics for compare batch
    const cMetrics = useMemo(() => {
        const nData = numericData.compare
        if (nData.length === 0) return null
        const sum = nData.reduce((acc, val) => acc + val, 0)
        const currentMean = sum / nData.length
        const variance = nData.reduce((acc, val) => acc + Math.pow(val - currentMean, 2), 0) / nData.length
        const currentSd = Math.sqrt(variance)
        const currentCv = currentMean !== 0 ? (currentSd / currentMean) * 100 : 0
        return { mean: currentMean, sd: currentSd, cv: currentCv }
    }, [numericData])

    // Calculate generic scale based on BOTH batches to ensure colors match correctly
    const { min, max } = useMemo(() => {
        const comb = numericData.combined
        if (comb.length === 0) return { min: 0, max: 0 }
        return { min: Math.min(...comb), max: Math.max(...comb) }
    }, [numericData])

    // Helper to get color proportional to result (Gradient from Red -> Green)
    // Red (0 hue) for minimum values, Green (120 hue) for maximum values
    const getColor = (val: number) => {
        if (min === max) return 'hsl(120, 80%, 60%)' // solid green if no variance
        let norm = (val - min) / (max - min)
        const hue = norm * 120 
        return `hsl(${hue}, 80%, 55%)`
    }

    const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const COLS = Array.from({ length: 12 }, (_, i) => i + 1)

    // Maps
    const primaryWellMap = useMemo(() => {
        const map = new Map<string, WellDisplayData>()
        data.forEach((d) => {
            if (d.wellNumber) map.set(d.wellNumber, { value: parseFloat(d.result), rawData: d, isCompare: false })
        })
        return map
    }, [data])

    const compareWellMap = useMemo(() => {
        const map = new Map<string, WellDisplayData>()
        compareData.forEach((d) => {
            if (d.wellNumber) map.set(d.wellNumber, { value: parseFloat(d.result), rawData: d, isCompare: true })
        })
        return map
    }, [compareData])

    // Check for overlap
    const sharedWells = useMemo(() => {
        let overlap = false
        primaryWellMap.forEach((_, key) => {
            if (compareWellMap.has(key)) overlap = true
        })
        return overlap
    }, [primaryWellMap, compareWellMap])

    const mergedWellMap = useMemo(() => {
        if (sharedWells) return null 
        const map = new Map(primaryWellMap)
        compareWellMap.forEach((val, key) => map.set(key, val))
        return map
    }, [sharedWells, primaryWellMap, compareWellMap])

    const formatExcelDate = (serial: string) => {
        if (!serial) return "N/A"
        if (serial.includes("-") || serial.includes("/")) return serial;
        const num = Number(serial)
        if (isNaN(num)) return serial
        const excelEpoch = new Date(1899, 11, 30)
        const date = new Date(excelEpoch.getTime() + num * 86400000)
        return date.toISOString().split('T')[0]
    }

    // Dropdown handler Keys
    const getBatchKey = (b: any) => `${b.inkNumber}|${b.cellLine}|${b.date}|${b.storageTime}|${b.assayDay}|${b.format}|${b.process}|${JSON.stringify(b.drugs || null)}`
    
    const currentBatchKey = compareConditions ? getBatchKey({
        ...compareConditions,
        drugs: compareConditions.drugs || null
    }) : "";

    const clearComparison = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("compareInk")
        params.delete("compareCell")
        params.delete("compareDate")
        params.delete("compareStorage")
        params.delete("compareAssay")
        params.delete("compareFormat")
        params.delete("compareProcess")
        params.delete("compareDrugs")
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleCompareSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value
        if (val === "") {
            clearComparison()
            return
        }
        
        const batch = availableBatches.find(b => getBatchKey(b) === val)
        if (!batch) return;

        const params = new URLSearchParams(searchParams.toString())
        params.set("compareInk", batch.inkNumber)
        params.set("compareCell", batch.cellLine)
        params.set("compareDate", batch.date)
        params.set("compareStorage", batch.storageTime)
        params.set("compareAssay", batch.assayDay)
        params.set("compareFormat", batch.format)
        params.set("compareProcess", batch.process)
        if (batch.drugs) {
            params.set("compareDrugs", JSON.stringify(batch.drugs))
        } else {
            params.delete("compareDrugs")
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    // Renders a single plate grid
    const renderPlateGrid = (mapToUse: Map<string, WellDisplayData>, title?: string, isCompareVisual?: boolean) => (
        <div className={`w-full max-w-[560px] mx-auto bg-white dark:bg-slate-900 rounded-xl border ${isCompareVisual ? 'border-indigo-500/30 shadow-indigo-500/5' : 'border-slate-200 dark:border-slate-800'} p-4 shadow-sm flex flex-col items-center justify-center shrink-0 relative overflow-hidden`} style={{ scrollSnapAlign: 'center' }}>
            {isCompareVisual && <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500" />}
            {title && <h4 className={`text-xs font-bold mb-3 uppercase tracking-widest ${isCompareVisual ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>{title}</h4>}
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'minmax(12px, 16px) repeat(12, minmax(0, 1fr))', width: '100%' }}>
                <div></div>
                {COLS.map(c => (
                    <div key={`header-col-${c}`} className="flex items-center justify-center font-bold text-[9px] text-slate-400 select-none">{c}</div>
                ))}
                {ROWS.map(r => (
                    <React.Fragment key={`row-${r}`}>
                        <div className="flex items-center justify-center font-bold text-[9px] text-slate-400 select-none">{r}</div>
                        {COLS.map(c => {
                            const wellId = `${r}${c}`
                            const wellData = mapToUse.get(wellId)
                            const hasData = !!wellData

                            return (
                                <div
                                    key={wellId}
                                    className={`relative aspect-square rounded-full transition-all group/well flex items-center justify-center cursor-pointer hover:scale-110 hover:z-10 ${hasData && wellData.isCompare && !isCompareVisual ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''}`}
                                    style={{
                                        backgroundColor: hasData && !isNaN(wellData.value) ? getColor(wellData.value) : 'transparent',
                                        border: hasData ? 'none' : '1.5px solid #cbd5e1',
                                        opacity: hasData ? 0.9 : 0.5,
                                    }}
                                >
                                    {hasData && !isNaN(wellData.value) && (
                                        <span className="text-[8px] font-bold text-white drop-shadow-md pointer-events-none">
                                            {Math.round(wellData.value)}
                                        </span>
                                    )}

                                    {hasData && (
                                        <div className="absolute opacity-0 group-hover/well:opacity-100 transition-opacity bottom-[110%] left-1/2 -translate-x-1/2 z-50 pointer-events-none bg-slate-900 text-white text-[10px] px-2 py-1.5 rounded shadow-xl whitespace-nowrap border border-slate-700">
                                            <div className="font-bold border-b border-slate-700 pb-0.5 mb-0.5">
                                                Well {wellId} {wellData.isCompare && <span className="text-indigo-400">(Compared Batch)</span>}
                                            </div>
                                            Result: <span className="font-bold">{wellData.value.toFixed(2)}</span>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    )

    // Helper for rendering metric differences
    const renderMetricDiff = (primaryVal: number, compareVal: number | undefined, isLowerBetter: boolean = false, isPercent: boolean = false) => {
        if (compareVal === undefined) return null;
        
        const diff = compareVal - primaryVal;
        if (Math.abs(diff) < 0.01) return <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">No Change</span>;
        
        const improved = isLowerBetter ? diff < 0 : diff > 0;
        const colorClass = improved ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400' : 'text-rose-700 bg-rose-100 dark:bg-rose-500/20 dark:text-rose-400';
        const sign = diff > 0 ? '+' : '';
        
        return (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colorClass}`}>
                {sign}{diff.toFixed(2)}{isPercent ? '%' : ''}
            </span>
        );
    }

    const getCvColor = (cv: number) => {
        if (cv > 15) return 'text-rose-600 dark:text-rose-400';
        if (cv > 10) return 'text-amber-500';
        return 'text-emerald-600 dark:text-emerald-400';
    }

    const renderMetricCard = (title: string, pVal: number, cVal: number | undefined, isCv: boolean, isLowerBetter: boolean) => (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col relative w-full overflow-hidden">
            {cVal !== undefined && <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none" />}
            <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                {renderMetricDiff(pVal, cVal, isLowerBetter, isCv)}
            </div>
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className={`text-2xl font-bold ${isCv ? getCvColor(pVal) : 'text-slate-900 dark:text-white'}`}>{pVal.toFixed(2)}{isCv ? '%' : ''}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Primary Batch</span>
                </div>
                
                {cVal !== undefined && (
                    <>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col">
                            <span className={`text-2xl font-bold ${isCv ? getCvColor(cVal) : 'text-indigo-600 dark:text-indigo-400'}`}>{cVal.toFixed(2)}{isCv ? '%' : ''}</span>
                            <span className="text-[10px] text-indigo-500/80 dark:text-indigo-400/80 font-medium whitespace-nowrap">Compared Batch</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    )

    const ConditionItem = ({ label, value, isDiff }: { label: string, value: string | React.ReactNode, isDiff?: boolean }) => (
        <div className="min-w-[60px] max-w-full">
            <p className={`text-[9px] mb-0.5 ${isDiff ? 'text-indigo-500/80 dark:text-indigo-400/80' : 'text-slate-400'}`}>{label}</p>
            <p className={`text-xs font-semibold ${isDiff ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-100/50 dark:bg-indigo-900/30 px-1.5 py-0.5 -ml-1.5 rounded-md w-fit inline-block' : 'text-slate-800 dark:text-slate-200'}`}>
                {value}
            </p>
        </div>
    )

    return (
        <div className="flex flex-col gap-3 w-full items-start justify-center pb-0 pt-0 relative" style={{ minHeight: 'calc(100svh - 10rem)' }}>
            
            {/* Top Compare Control (Minimalist wrapper pulled natively into page header negative space) */}
            <div className={`absolute -top-10 sm:-top-[52px] right-0 w-full flex justify-end z-20 pointer-events-none transition-all delay-75`}>
                <div className="flex items-center gap-2 relative pointer-events-auto">
                    {compareConditions && (
                        <button 
                            onClick={clearComparison} 
                            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        >
                            Clear
                        </button>
                    )}
                    <div className="relative">
                        <select 
                            className="appearance-none bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2 pl-3 pr-8 rounded-lg cursor-pointer outline-none transition-colors border border-slate-200 dark:border-slate-700"
                            onChange={handleCompareSelect}
                            value={currentBatchKey}
                        >
                            <option value="">{compareConditions ? "Switch comparison batch..." : "Compare with another batch..."}</option>
                            {availableBatches.map((b, i) => {
                                const isSelf = b.inkNumber === inkNumber && b.cellLine === cellLine && b.date === conditions.date && b.storageTime === conditions.storageTime && b.assayDay === conditions.assayDay && b.format === conditions.format && b.process === conditions.process && JSON.stringify(b.drugs || null) === JSON.stringify(drugs || null)
                                if (isSelf) return null;
                                const label = `${b.inkNumber || 'N/A'} | Date: ${formatExcelDate(b.date)} | ST: ${b.storageTime || 'N/A'} | AD: ${b.assayDay || 'N/A'}`
                                return (
                                    <option key={i} value={getBatchKey(b)}>
                                        {label}
                                    </option>
                                )
                            })}
                        </select>
                        <svg className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
            </div>

            {compareConditions ? (
                // --- COMPARISON MODE LAYOUT ---
                <>
                    {/* Metrics Row (Full Width) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                        {renderMetricCard("Overall Mean Value", pMetrics.mean, cMetrics?.mean, false, false)}
                        {renderMetricCard("Standard Deviation", pMetrics.sd, cMetrics?.sd, false, true)}
                        {renderMetricCard("Interwell CV", pMetrics.cv, cMetrics?.cv, true, true)}
                    </div>

                    <div className="flex flex-col xl:flex-row gap-4 w-full mt-2">
                        {/* Left: Plates */}
                        <div className="w-full xl:w-2/3 flex flex-col relative max-w-full">
                            {compareData.length > 0 && mergedWellMap === null && (
                                <div className="min-w-0 mb-3">
                                    <div className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded inline-block">
                                        Multiple Plates: Scroll Horizontally
                                    </div>
                                </div>
                            )}

                            {/* Plates Container */}
                            {compareData.length > 0 && mergedWellMap === null ? (
                                <div className="flex flex-col w-full">
                                    <div className="w-full flex justify-end mb-2">
                                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                                            <span>Lower ({min.toFixed(1)})</span>
                                            <div className="w-20 h-1.5 rounded-full bg-gradient-to-r from-[hsl(0,80%,55%)] via-[hsl(60,80%,55%)] to-[hsl(120,80%,55%)] opacity-80 shadow-inner" />
                                            <span>Higher ({max.toFixed(1)})</span>
                                        </div>
                                    </div>
                                    <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar">
                                        <div className="min-w-[95%] sm:min-w-full xl:min-w-[90%] snap-center flex justify-center">
                                            {renderPlateGrid(primaryWellMap, "Primary Batch", false)}
                                        </div>
                                        <div className="min-w-[95%] sm:min-w-full xl:min-w-[90%] snap-center flex justify-center">
                                            {renderPlateGrid(compareWellMap, "Compared Batch", true)}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center w-full">
                                    <div className="w-full max-w-[560px] flex justify-end mb-2">
                                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                                            <span>Lower ({min.toFixed(1)})</span>
                                            <div className="w-20 h-1.5 rounded-full bg-gradient-to-r from-[hsl(0,80%,55%)] via-[hsl(60,80%,55%)] to-[hsl(120,80%,55%)] opacity-80 shadow-inner" />
                                            <span>Higher ({max.toFixed(1)})</span>
                                        </div>
                                    </div>
                                    <div className="w-full flex justify-center">
                                        {renderPlateGrid(mergedWellMap || primaryWellMap)}
                                    </div>
                                </div>
                            )}
                            
                            {mergedWellMap !== null && compareData.length > 0 && (
                                <div className="text-center text-[10px] font-medium text-slate-500 mt-2 flex items-center justify-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full ring-2 ring-indigo-500" /> 
                                    <span>Indicate data points from the compared batch</span>
                                </div>
                            )}
                        </div>

                        {/* Right: Conditions Details */}
                        <div className="w-full xl:w-1/3 flex flex-col gap-4">
                            {/* Primary Conditions Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                                <h3 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-3 text-left">Primary Conditions</h3>
                                <div className="flex flex-wrap gap-x-5 gap-y-4">
                                    {inkNumber && <ConditionItem label="Ink Number" value={inkNumber} />}
                                    <ConditionItem label="Cell Line" value={cellLine} />
                                    <ConditionItem label="Date Printed" value={formatExcelDate(conditions.date)} />
                                    <ConditionItem label="Storage Time" value={conditions.storageTime !== "" ? conditions.storageTime : "N/A"} />
                                    <ConditionItem label="Assay Day" value={conditions.assayDay !== "" ? conditions.assayDay : "N/A"} />
                                    <ConditionItem label="Format" value={conditions.format !== "" ? conditions.format : "N/A"} />
                                    <ConditionItem label="Process" value={conditions.process !== "" ? conditions.process : "N/A"} />
                                </div>
                            </div>

                            {/* Compared Conditions Card */}
                            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200/60 dark:border-indigo-800/50 rounded-xl p-4 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400 dark:bg-indigo-500" />
                                <h3 className="text-[10px] font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase mb-3 ml-2 text-left">Compared Conditions</h3>
                                <div className="flex flex-wrap gap-x-5 gap-y-4 ml-2">
                                    {compareConditions.inkNumber && <ConditionItem label="Ink Number" value={compareConditions.inkNumber} isDiff={compareConditions.inkNumber !== inkNumber} />}
                                    <ConditionItem label="Cell Line" value={compareConditions.cellLine} isDiff={compareConditions.cellLine !== cellLine} />
                                    <ConditionItem label="Date Printed" value={formatExcelDate(compareConditions.date)} isDiff={compareConditions.date !== conditions.date} />
                                    <ConditionItem label="Storage Time" value={compareConditions.storageTime !== "" ? compareConditions.storageTime : "N/A"} isDiff={compareConditions.storageTime !== conditions.storageTime} />
                                    <ConditionItem label="Assay Day" value={compareConditions.assayDay !== "" ? compareConditions.assayDay : "N/A"} isDiff={compareConditions.assayDay !== conditions.assayDay} />
                                    <ConditionItem label="Format" value={compareConditions.format !== "" ? compareConditions.format : "N/A"} isDiff={compareConditions.format !== conditions.format} />
                                    <ConditionItem label="Process" value={compareConditions.process !== "" ? compareConditions.process : "N/A"} isDiff={compareConditions.process !== conditions.process} />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                // --- SINGLE BATCH MODE LAYOUT ---
                <div className="flex flex-col xl:flex-row gap-4 w-full mt-2">
                    {/* Left Column: Well Plate Heatmap */}
                    <div className="w-full xl:w-1/2 flex flex-col order-2 xl:order-1 relative max-w-full">
                        <div className="flex flex-col items-center w-full">
                            <div className="w-full max-w-[560px] flex justify-end mb-2 pr-0">
                                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                                    <span>Lower ({min.toFixed(1)})</span>
                                    <div className="w-20 h-1.5 rounded-full bg-gradient-to-r from-[hsl(0,80%,55%)] via-[hsl(60,80%,55%)] to-[hsl(120,80%,55%)] opacity-80 shadow-inner" />
                                    <span>Higher ({max.toFixed(1)})</span>
                                </div>
                            </div>
                            
                            <div className="w-full flex justify-center">
                                {renderPlateGrid(primaryWellMap)}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Conditions & Metrics */}
                    <div className="w-full xl:w-1/2 flex flex-col gap-4 order-1 xl:order-2">
                        
                        {/* Primary Batch Conditions */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                            <h3 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-3">Batch Conditions</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-3">
                                {inkNumber && (
                                    <div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Ink</p>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{inkNumber}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Cell Line</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{cellLine}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Date Date</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatExcelDate(conditions.date)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Storage Time</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{conditions.storageTime !== "" ? conditions.storageTime : "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Assay Day</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{conditions.assayDay !== "" ? conditions.assayDay : "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Format</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{conditions.format !== "" ? conditions.format : "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Process</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{conditions.process !== "" ? conditions.process : "N/A"}</p>
                                </div>
                            </div>
                        </div>

                        {/* Primary Metrics */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                            <h3 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-3">Reproducibility Metrics</h3>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Overall Mean Value</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{pMetrics.mean.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Standard Deviation</p>
                                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{pMetrics.sd.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Interwell CV</p>
                                    <p className={`text-lg font-bold ${pMetrics.cv > 15 ? 'text-destructive' : pMetrics.cv > 10 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {pMetrics.cv.toFixed(2)}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
