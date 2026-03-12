"use client"

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react"
import {
    BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ErrorBar, LabelList, ReferenceLine,
} from "recharts"
import { toPng } from "html-to-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Download, Plus, Trash2, Upload, Palette, Type, Ruler,
    BarChart3, LineChart as LineChartIcon, ScatterChart as ScatterChartIcon,
    Layers, Settings2, Move,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

type ChartType = "bar" | "grouped-bar" | "stacked-bar" | "line" | "scatter"
type LegendLayout = "horizontal" | "vertical" | "columns"

interface SeriesConfig {
    key: string
    label: string
    color: string
    errorBarKey?: string
}

interface AxisConfig {
    label: string
    fontSize: number
    tickFontSize: number
    lineWidth: number
    tickSize: number
    showGrid: boolean
    color: string
    fontColor: string
    min?: string
    max?: string
}

interface LegendConfig {
    show: boolean
    position: "top" | "bottom"
    layout: LegendLayout
    columns: number
    fontSize: number
    iconType: "circle" | "square" | "diamond" | "triangle" | "line" | "rect"
    offsetX: number
    offsetY: number
}

interface TitleConfig {
    text: string
    fontSize: number
    color: string
    align: "left" | "center" | "right"
    offsetX: number
    offsetY: number
}

interface MarginConfig {
    top: number
    right: number
    bottom: number
    left: number
}

interface FigureConfig {
    chartType: ChartType
    title: TitleConfig
    fontFamily: string
    chartWidth: number
    chartHeight: number
    barWidth: number
    barGap: number
    barCategoryGap: number
    margin: MarginConfig
    xAxis: AxisConfig
    yAxis: AxisConfig
    legend: LegendConfig
    showErrorBars: boolean
    errorBarStrokeWidth: number
    errorBarColor: string
    showDataLabels: boolean
    dataLabelFontSize: number
    previewBg: string
}

const DEFAULT_COLORS = [
    "#8B9D77", "#E8A87C", "#6C8EBF", "#D4A5A5", "#7EC8C8",
    "#C49BBB", "#F4D35E", "#F87171", "#60A5FA", "#34D399",
]

const DEFAULT_AXIS: AxisConfig = {
    label: "",
    fontSize: 14,
    tickFontSize: 12,
    lineWidth: 2,
    tickSize: 6,
    showGrid: false,
    color: "#000000",
    fontColor: "#000000",
}

const DEFAULT_CONFIG: FigureConfig = {
    chartType: "grouped-bar",
    title: { text: "", fontSize: 18, color: "#000000", align: "center", offsetX: 0, offsetY: 0 },
    fontFamily: "Arial",
    chartWidth: 700,
    chartHeight: 450,
    barWidth: 30,
    barGap: 4,
    barCategoryGap: 30,
    margin: { top: 20, right: 30, bottom: 20, left: 25 },
    xAxis: { ...DEFAULT_AXIS },
    yAxis: { ...DEFAULT_AXIS },
    legend: { show: true, position: "top", layout: "horizontal", columns: 3, fontSize: 13, iconType: "circle", offsetX: 0, offsetY: 0 },
    showErrorBars: false,
    errorBarStrokeWidth: 1.5,
    errorBarColor: "#000000",
    showDataLabels: false,
    dataLabelFontSize: 11,
    previewBg: "checkerboard",
}

const DEFAULT_DATA = [
    { category: "Day 1", series1: 80, series2: 80 },
    { category: "Day 3", series1: 80, series2: 80 },
    { category: "Day 7", series1: 83, series2: 86 },
]

const DEFAULT_SERIES: SeriesConfig[] = [
    { key: "series1", label: "NIH/3T3", color: "#8B9D77" },
    { key: "series2", label: "HUVECs", color: "#E8A87C" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseColor(raw: string): string {
    const hex = raw.trim()
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
        return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    }
    const m = raw.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
    if (m) {
        const r = parseInt(m[1]).toString(16).padStart(2, "0")
        const g = parseInt(m[2]).toString(16).padStart(2, "0")
        const b = parseInt(m[3]).toString(16).padStart(2, "0")
        return `#${r}${g}${b}`
    }
    return hex
}

/** Returns perceived luminance 0..1 */
function luminance(hex: string): number {
    const c = hex.replace("#", "")
    if (c.length !== 6) return 0.5
    const r = parseInt(c.slice(0, 2), 16) / 255
    const g = parseInt(c.slice(2, 4), 16) / 255
    const b = parseInt(c.slice(4, 6), 16) / 255
    return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Pick contrastColor: light bg → black text, dark bg → white text */
function contrastColor(bgHex: string): string {
    return luminance(bgHex) > 0.55 ? "#000000" : "#ffffff"
}

function previewBgStyle(bg: string): React.CSSProperties {
    if (bg === "checkerboard") {
        return {
            backgroundImage: "repeating-conic-gradient(#d1d5db 0% 25%, #ffffff 0% 50%)",
            backgroundSize: "16px 16px",
        }
    }
    return { backgroundColor: bg }
}

// ─── Draggable with shift-lock ───────────────────────────────────────────────

function DraggableOffset({
    x, y, onDrag, children, zIndex = 1000,
}: {
    x: number; y: number
    onDrag: (dx: number, dy: number) => void
    children: React.ReactNode
    zIndex?: number
}) {
    const dragging = useRef(false)
    const start = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
    const [isDragging, setIsDragging] = useState(false)

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragging.current = true
        setIsDragging(true)
        start.current = { mx: e.clientX, my: e.clientY, ox: x, oy: y }
            ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
    }, [x, y])

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return
        let dx = e.clientX - start.current.mx
        let dy = e.clientY - start.current.my

        // Shift-lock: constrain to one axis
        if (e.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy)) {
                dy = 0 // lock Y → horizontal only
            } else {
                dx = 0 // lock X → vertical only
            }
        }

        onDrag(start.current.ox + dx, start.current.oy + dy)
    }, [onDrag])

    const onPointerUp = useCallback(() => {
        dragging.current = false
        setIsDragging(false)
    }, [])

    return (
        <div
            style={{
                transform: `translate(${x}px, ${y}px)`,
                cursor: isDragging ? "grabbing" : "grab",
                userSelect: "none",
                position: "relative",
                zIndex: zIndex,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {children}
        </div>
    )
}

// ─── Color input row ────────────────────────────────────────────────────────

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-20 shrink-0">{label}</Label>
            <input type="color" value={value} onChange={e => onChange(e.target.value)} className="h-6 w-6 rounded cursor-pointer border-0 p-0 shrink-0" />
            <Input value={value} onChange={e => onChange(parseColor(e.target.value))} className="h-7 text-xs w-24 font-mono" />
        </div>
    )
}

// ─── Custom legend renderer ─────────────────────────────────────────────────

function CustomLegend({
    series,
    config,
    layout,
    columns,
}: {
    series: SeriesConfig[]
    config: FigureConfig
    layout: LegendLayout
    columns: number
}) {
    const iconSize = 12

    const renderIcon = (color: string) => {
        const type = config.legend.iconType
        switch (type) {
            case "circle":
                return <svg width={iconSize} height={iconSize}><circle cx={6} cy={6} r={5} fill={color} /></svg>
            case "square":
            case "rect":
                return <svg width={iconSize} height={iconSize}><rect x={1} y={1} width={10} height={10} fill={color} /></svg>
            case "diamond":
                return <svg width={iconSize} height={iconSize}><polygon points="6,0 12,6 6,12 0,6" fill={color} /></svg>
            case "triangle":
                return <svg width={iconSize} height={iconSize}><polygon points="6,0 12,12 0,12" fill={color} /></svg>
            case "line":
                return <svg width={20} height={iconSize}><line x1={0} y1={6} x2={20} y2={6} stroke={color} strokeWidth={3} /></svg>
            default:
                return <svg width={iconSize} height={iconSize}><circle cx={6} cy={6} r={5} fill={color} /></svg>
        }
    }

    const items = series.map(s => (
        <div key={s.key} className="flex items-center gap-1.5" style={{ fontSize: config.legend.fontSize, fontFamily: config.fontFamily }}>
            {renderIcon(s.color)}
            <span style={{ color: config.xAxis.fontColor }}>{s.label}</span>
        </div>
    ))

    if (layout === "vertical") {
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: "100%" }}>
                {items}
            </div>
        )
    }

    if (layout === "columns") {
        return (
            <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, auto)`,
                gap: "4px 16px",
                justifyContent: "center",
                width: "100%",
            }}>
                {items}
            </div>
        )
    }

    // horizontal (default)
    return (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 16px", width: "100%" }}>
            {items}
        </div>
    )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FigureMaker() {
    const [config, setConfig] = useState<FigureConfig>(DEFAULT_CONFIG)
    const [data, setData] = useState<Record<string, any>[]>(DEFAULT_DATA)
    const [series, setSeries] = useState<SeriesConfig[]>(DEFAULT_SERIES)
    const [customFonts, setCustomFonts] = useState<string[]>([])
    const chartRef = useRef<HTMLDivElement>(null)

    const updateConfig = useCallback(<K extends keyof FigureConfig>(key: K, value: FigureConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }))
    }, [])

    const updateTitle = useCallback((key: string, value: any) => {
        setConfig(prev => ({ ...prev, title: { ...prev.title, [key]: value } }))
    }, [])

    const updateMargin = useCallback((key: string, value: number) => {
        setConfig(prev => ({ ...prev, margin: { ...prev.margin, [key]: value } }))
    }, [])

    const updateAxis = useCallback((axis: "xAxis" | "yAxis", key: string, value: any) => {
        setConfig(prev => ({ ...prev, [axis]: { ...prev[axis], [key]: value } }))
    }, [])

    const updateLegend = useCallback((key: string, value: any) => {
        setConfig(prev => ({ ...prev, legend: { ...prev.legend, [key]: value } }))
    }, [])

    // ── Auto-contrast on bg change ──────────────────────────────────────────────

    const applyAutoContrast = useCallback((bg: string) => {
        if (bg === "checkerboard") return // neutral bg, no change

        const cc = contrastColor(bg)

        setConfig(prev => ({
            ...prev,
            previewBg: bg,
            title: { ...prev.title, color: cc },
            xAxis: { ...prev.xAxis, color: cc, fontColor: cc },
            yAxis: { ...prev.yAxis, color: cc, fontColor: cc },
            errorBarColor: cc,
        }))
    }, [])

    // ── CSV Import ──────────────────────────────────────────────────────────────

    const handleCsvImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const text = ev.target?.result as string
            const lines = text.trim().split("\n").map(l => l.split(",").map(c => c.trim()))
            if (lines.length < 2) return
            const headers = lines[0]
            const newSeriesKeys = headers.slice(1)
            const newData = lines.slice(1).map(row => {
                const obj: Record<string, any> = { category: row[0] }
                newSeriesKeys.forEach((key, i) => {
                    const val = parseFloat(row[i + 1])
                    obj[key] = isNaN(val) ? row[i + 1] : val
                })
                return obj
            })
            const newSeries: SeriesConfig[] = newSeriesKeys.map((key, i) => ({
                key,
                label: key,
                color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
            }))
            setData(newData)
            setSeries(newSeries)
        }
        reader.readAsText(file)
        e.target.value = ""
    }, [])

    // ── Font Import ─────────────────────────────────────────────────────────────

    const handleFontImport = useCallback(() => {
        const url = prompt("Paste a Google Fonts @import URL or <link> href:")
        if (!url) return
        const href = url.replace(/@import\s+url\(['"]?/, "").replace(/['"]?\);?$/, "").replace(/<link[^>]*href="/, "").replace(/"[^>]*>/, "").trim()
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = href
        document.head.appendChild(link)
        const match = href.match(/family=([^:&]+)/)
        if (match) {
            const family = decodeURIComponent(match[1]).replace(/\+/g, " ")
            setCustomFonts(prev => prev.includes(family) ? prev : [...prev, family])
            updateConfig("fontFamily", family)
        }
    }, [updateConfig])

    // ── Data Management ─────────────────────────────────────────────────────────

    const addRow = useCallback(() => {
        const newRow: Record<string, any> = { category: `Group ${data.length + 1}` }
        series.forEach(s => { newRow[s.key] = 0 })
        setData(prev => [...prev, newRow])
    }, [data.length, series])

    const removeRow = useCallback((index: number) => {
        setData(prev => prev.filter((_, i) => i !== index))
    }, [])

    const updateCell = useCallback((rowIdx: number, key: string, value: string) => {
        setData(prev => prev.map((row, i) => {
            if (i !== rowIdx) return row
            if (key === "category") return { ...row, [key]: value }
            const num = parseFloat(value)
            return { ...row, [key]: isNaN(num) ? value : num }
        }))
    }, [])

    const addSeries = useCallback(() => {
        const idx = series.length + 1
        const newKey = `series${idx}`
        const newSeries: SeriesConfig = {
            key: newKey,
            label: `Series ${idx}`,
            color: DEFAULT_COLORS[(idx - 1) % DEFAULT_COLORS.length],
        }
        setSeries(prev => [...prev, newSeries])
        setData(prev => prev.map(row => ({ ...row, [newKey]: 0 })))
    }, [series.length])

    const removeSeries = useCallback((index: number) => {
        const key = series[index].key
        setSeries(prev => prev.filter((_, i) => i !== index))
        setData(prev => prev.map(row => {
            const { [key]: _, ...rest } = row
            return rest
        }))
    }, [series])

    const updateSeriesConfig = useCallback((index: number, field: keyof SeriesConfig, value: string) => {
        setSeries(prev => prev.map((s, i) => {
            if (i !== index) return s
            if (field === "color") return { ...s, color: parseColor(value) }
            return { ...s, [field]: value }
        }))
    }, [])

    const addErrorBarColumn = useCallback((seriesIdx: number) => {
        const s = series[seriesIdx]
        const errKey = `${s.key}_error`
        setSeries(prev => prev.map((s2, i) => i === seriesIdx ? { ...s2, errorBarKey: errKey } : s2))
        setData(prev => prev.map(row => ({ ...row, [errKey]: 0 })))
        updateConfig("showErrorBars", true)
    }, [series, updateConfig])

    // ── Scatter data ────────────────────────────────────────────────────────────

    const scatterData = useMemo(() => {
        if (config.chartType !== "scatter" || series.length < 1) return []
        if (series.length < 2) {
            return data.map((row, i) => ({ x: i, y: row[series[0].key] ?? 0, category: row.category }))
        }
        return data.map(row => {
            const obj: Record<string, any> = { x: row[series[0].key] ?? 0, category: row.category }
            series.slice(1).forEach(s => { obj[s.key] = row[s.key] ?? 0 })
            return obj
        })
    }, [config.chartType, data, series])

    // ── Export ──────────────────────────────────────────────────────────────────

    const handleExport = useCallback(async () => {
        if (!chartRef.current) return
        try {
            const dataUrl = await toPng(chartRef.current, {
                backgroundColor: undefined,
                pixelRatio: 3,
                style: { background: "transparent" },
            })
            const link = document.createElement("a")
            link.download = "figure.png"
            link.href = dataUrl
            link.click()
        } catch (err) {
            console.error("Export failed:", err)
        }
    }, [])

    // ── Chart Render ────────────────────────────────────────────────────────────

    const renderChart = () => {
        const { xAxis: xa, yAxis: ya } = config
        const mg = { ...config.margin, bottom: xa.label ? config.margin.bottom + 25 : config.margin.bottom }

        const commonXAxis = (
            <XAxis
                dataKey="category"
                label={xa.label ? { value: xa.label, position: "insideBottom", offset: -5, style: { fontSize: xa.fontSize, fontFamily: config.fontFamily, fill: xa.fontColor } } : undefined}
                tick={{ fontSize: xa.tickFontSize, fontFamily: config.fontFamily, fill: xa.fontColor }}
                tickSize={xa.tickSize}
                strokeWidth={xa.lineWidth}
                stroke={xa.color}
                tickLine={{ stroke: xa.color }}
                axisLine={{ stroke: xa.color, strokeWidth: xa.lineWidth }}
            />
        )

        const yDomain: [any, any] = [
            ya.min ? parseFloat(ya.min) : "auto",
            ya.max ? parseFloat(ya.max) : "auto",
        ]

        const commonYAxis = (
            <YAxis
                domain={yDomain}
                label={ya.label ? { value: ya.label, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: ya.fontSize, fontFamily: config.fontFamily, fill: ya.fontColor, textAnchor: "middle" } } : undefined}
                tick={{ fontSize: ya.tickFontSize, fontFamily: config.fontFamily, fill: ya.fontColor }}
                tickSize={ya.tickSize}
                strokeWidth={ya.lineWidth}
                stroke={ya.color}
                tickLine={{ stroke: ya.color }}
                axisLine={{ stroke: ya.color, strokeWidth: ya.lineWidth }}
            />
        )

        const grid = xa.showGrid || ya.showGrid ? (
            <CartesianGrid
                strokeDasharray="3 3"
                horizontal={ya.showGrid}
                vertical={xa.showGrid}
                stroke="#cccccc"
            />
        ) : null

        // We use a custom legend instead of Recharts' built-in, so no legendComp here.
        // Recharts Legend is hidden; we render our own draggable legend outside.

        const tooltipStyle = { fontFamily: config.fontFamily, fontSize: 12 }

        const isBar = config.chartType === "bar" || config.chartType === "grouped-bar" || config.chartType === "stacked-bar"
        const isStacked = config.chartType === "stacked-bar"

        // Custom bar shape: centers bar on its allocated slot
        const CenteredBar = (props: any) => {
            const { x, y, width, height, fill } = props
            // Recharts gives us the allocated rect; re-center using desired barWidth
            const desired = config.barWidth
            const cx = x + width / 2
            const newX = cx - desired / 2
            return (
                <rect
                    x={newX}
                    y={y}
                    width={desired}
                    height={height}
                    fill={fill}
                    style={{ transition: "x 0.2s ease, width 0.2s ease" }}
                />
            )
        }

        if (isBar) {
            return (
                <BarChart data={data} barGap={config.barGap} barCategoryGap={config.barCategoryGap} margin={mg}>
                    {grid}
                    {/* Render bars FIRST, then axes on top */}
                    {series.map(s => (
                        <Bar key={s.key} dataKey={s.key} fill={s.color} stackId={isStacked ? "stack" : undefined} barSize={config.barWidth} name={s.key} shape={<CenteredBar />}>
                            {config.showDataLabels && (
                                <LabelList dataKey={s.key} position="top" style={{ fontSize: config.dataLabelFontSize, fontFamily: config.fontFamily, fill: s.color }} formatter={(v: number) => `${v}%`} />
                            )}
                            {config.showErrorBars && s.errorBarKey && (
                                <ErrorBar dataKey={s.errorBarKey} width={4} strokeWidth={config.errorBarStrokeWidth} stroke={config.errorBarColor} />
                            )}
                        </Bar>
                    ))}
                    {/* Axes rendered AFTER bars so they appear on top */}
                    {commonXAxis}
                    {commonYAxis}
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => {
                            const s = series.find(s2 => s2.key === name)
                            return [value, s?.label || name]
                        }}
                    />
                </BarChart>
            )
        }

        if (config.chartType === "line") {
            return (
                <LineChart data={data} margin={mg}>
                    {grid}
                    {commonXAxis}
                    {commonYAxis}
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => {
                            const s = series.find(s2 => s2.key === name)
                            return [value, s?.label || name]
                        }}
                    />
                    {series.map(s => (
                        <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={{ r: 4, fill: s.color }} name={s.key}>
                            {config.showErrorBars && s.errorBarKey && (
                                <ErrorBar dataKey={s.errorBarKey} width={4} strokeWidth={config.errorBarStrokeWidth} stroke={config.errorBarColor} />
                            )}
                        </Line>
                    ))}
                </LineChart>
            )
        }

        if (config.chartType === "scatter") {
            const xSeries = series[0]
            const ySeries = series.length >= 2 ? series.slice(1) : series

            return (
                <ScatterChart margin={mg}>
                    {grid}
                    <XAxis
                        type="number"
                        dataKey="x"
                        name={xSeries?.label || "X"}
                        label={xa.label ? { value: xa.label, position: "insideBottom", offset: -5, style: { fontSize: xa.fontSize, fontFamily: config.fontFamily, fill: xa.fontColor } } : undefined}
                        tick={{ fontSize: xa.tickFontSize, fontFamily: config.fontFamily, fill: xa.fontColor }}
                        tickSize={xa.tickSize}
                        strokeWidth={xa.lineWidth}
                        stroke={xa.color}
                        tickLine={{ stroke: xa.color }}
                        axisLine={{ stroke: xa.color, strokeWidth: xa.lineWidth }}
                    />
                    <YAxis
                        type="number"
                        dataKey={series.length >= 2 ? ySeries[0].key : "y"}
                        name={ySeries[0]?.label || "Y"}
                        domain={yDomain}
                        label={ya.label ? { value: ya.label, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: ya.fontSize, fontFamily: config.fontFamily, fill: ya.fontColor, textAnchor: "middle" } } : undefined}
                        tick={{ fontSize: ya.tickFontSize, fontFamily: config.fontFamily, fill: ya.fontColor }}
                        tickSize={ya.tickSize}
                        strokeWidth={ya.lineWidth}
                        stroke={ya.color}
                        tickLine={{ stroke: ya.color }}
                        axisLine={{ stroke: ya.color, strokeWidth: ya.lineWidth }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    {ySeries.map(s => (
                        <Scatter key={s.key} name={s.key} data={scatterData} fill={s.color} />
                    ))}
                </ScatterChart>
            )
        }

        return null
    }

    // ── Compute chart area height accounting for title + legend ──────────────────

    const titleHeight = config.title.text ? config.title.fontSize + 16 : 0
    const legendHeight = config.legend.show ? (
        config.legend.layout === "vertical" ? series.length * (config.legend.fontSize + 8) + 12 :
            config.legend.layout === "columns" ? Math.ceil(series.length / config.legend.columns) * (config.legend.fontSize + 8) + 12 :
                config.legend.fontSize + 20
    ) : 0
    const chartAreaHeight = config.chartHeight - titleHeight - legendHeight

    // ── UI ──────────────────────────────────────────────────────────────────────

    const SYSTEM_FONTS = ["Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana", "Courier New", "Inter", "Roboto"]
    const allFonts = [...SYSTEM_FONTS, ...customFonts]

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Figure Maker</h1>
                    <p className="text-sm text-muted-foreground">Design publication-quality figures</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                        <Input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
                        <Button variant="outline" size="sm" className="gap-1.5" asChild>
                            <span><Upload className="h-3.5 w-3.5" /> Import CSV</span>
                        </Button>
                    </label>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleFontImport}>
                        <Type className="h-3.5 w-3.5" /> Import Font
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={handleExport}>
                        <Download className="h-3.5 w-3.5" /> Download PNG
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Left Panel — Controls */}
                <div className="w-[400px] shrink-0 border-r border-border overflow-y-auto">
                    <Tabs defaultValue="chart" className="w-full">
                        <TabsList className="w-full grid grid-cols-5 rounded-none border-b border-border h-10">
                            <TabsTrigger value="chart" className="text-xs gap-1"><Layers className="h-3 w-3" /> Chart</TabsTrigger>
                            <TabsTrigger value="data" className="text-xs gap-1"><Settings2 className="h-3 w-3" /> Data</TabsTrigger>
                            <TabsTrigger value="style" className="text-xs gap-1"><Palette className="h-3 w-3" /> Style</TabsTrigger>
                            <TabsTrigger value="axis" className="text-xs gap-1"><Ruler className="h-3 w-3" /> Axis</TabsTrigger>
                            <TabsTrigger value="layout" className="text-xs gap-1"><Move className="h-3 w-3" /> Layout</TabsTrigger>
                        </TabsList>

                        {/* ── Chart Type Tab ── */}
                        <TabsContent value="chart" className="p-4 space-y-4 mt-0">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chart Type</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        // { value: "bar", label: "Single Bar", icon: BarChart3 },
                                        { value: "grouped-bar", label: "Bars", icon: BarChart3 },
                                        { value: "stacked-bar", label: "Stacked Bar", icon: Layers },
                                        { value: "line", label: "Line", icon: LineChartIcon },
                                        { value: "scatter", label: "Scatter", icon: ScatterChartIcon },
                                    ] as { value: ChartType; label: string; icon: any }[]).map(ct => (
                                        <button
                                            key={ct.value}
                                            onClick={() => updateConfig("chartType", ct.value)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${config.chartType === ct.value
                                                ? "border-primary bg-primary/10 text-primary font-medium"
                                                : "border-border hover:bg-accent text-foreground"
                                                }`}
                                        >
                                            <ct.icon className="h-4 w-4" />
                                            {ct.label}
                                        </button>
                                    ))}
                                </div>
                                {config.chartType === "scatter" && (
                                    <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                                        Scatter mode: 1st series = X values, 2nd+ series = Y values. Each row is a data point.
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Width (px)</Label>
                                    <Input type="number" value={config.chartWidth} onChange={e => updateConfig("chartWidth", parseInt(e.target.value) || 600)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Height (px)</Label>
                                    <Input type="number" value={config.chartHeight} onChange={e => updateConfig("chartHeight", parseInt(e.target.value) || 400)} />
                                </div>
                            </div>

                            {config.chartType.includes("bar") && (
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Bar Width: {config.barWidth}px</Label>
                                        <Slider value={[config.barWidth]} onValueChange={([v]) => updateConfig("barWidth", v)} min={5} max={80} step={1} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Gap Between Bars: {config.barGap}px</Label>
                                        <Slider value={[config.barGap]} onValueChange={([v]) => updateConfig("barGap", v)} min={0} max={30} step={1} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Gap Between Groups: {config.barCategoryGap}px</Label>
                                        <Slider value={[config.barCategoryGap]} onValueChange={([v]) => updateConfig("barCategoryGap", v)} min={0} max={80} step={1} />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Show Data Labels</Label>
                                <Switch checked={config.showDataLabels} onCheckedChange={v => updateConfig("showDataLabels", v)} />
                            </div>
                            {config.showDataLabels && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Label Font Size</Label>
                                    <Input type="number" value={config.dataLabelFontSize} onChange={e => updateConfig("dataLabelFontSize", parseInt(e.target.value) || 11)} />
                                </div>
                            )}
                        </TabsContent>

                        {/* ── Data Tab ── */}
                        <TabsContent value="data" className="p-4 space-y-4 mt-0">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Series</Label>
                                    <Button variant="ghost" size="sm" onClick={addSeries} className="h-7 text-xs gap-1"><Plus className="h-3 w-3" /> Add</Button>
                                </div>
                                {series.map((s, i) => (
                                    <div key={s.key} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card">
                                        <input type="color" value={s.color} onChange={e => updateSeriesConfig(i, "color", e.target.value)} className="h-7 w-7 rounded cursor-pointer border-0 p-0" />
                                        <Input value={s.label} onChange={e => updateSeriesConfig(i, "label", e.target.value)} className="h-7 text-xs flex-1" />
                                        <Input value={s.color} onChange={e => updateSeriesConfig(i, "color", e.target.value)} className="h-7 text-xs w-24 font-mono" placeholder="#hex or rgb()" />
                                        {!s.errorBarKey && (
                                            <Button variant="ghost" size="sm" onClick={() => addErrorBarColumn(i)} className="h-7 text-xs px-2" title="Add error bars">±</Button>
                                        )}
                                        {series.length > 1 && (
                                            <Button variant="ghost" size="sm" onClick={() => removeSeries(i)} className="h-7 px-1.5 text-destructive hover:text-destructive">
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</Label>
                                    <Button variant="ghost" size="sm" onClick={addRow} className="h-7 text-xs gap-1"><Plus className="h-3 w-3" /> Add Row</Button>
                                </div>
                                <div className="overflow-x-auto rounded-md border border-border">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/50">
                                                <th className="p-2 text-left font-medium text-muted-foreground">Category</th>
                                                {series.map(s => (
                                                    <React.Fragment key={s.key}>
                                                        <th className="p-2 text-left font-medium" style={{ color: s.color }}>{s.label}</th>
                                                        {s.errorBarKey && <th className="p-2 text-left font-medium text-muted-foreground">± Error</th>}
                                                    </React.Fragment>
                                                ))}
                                                <th className="p-2 w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.map((row, ri) => (
                                                <tr key={ri} className="border-b border-border last:border-0 hover:bg-muted/30">
                                                    <td className="p-1">
                                                        <Input value={row.category || ""} onChange={e => updateCell(ri, "category", e.target.value)} className="h-7 text-xs" />
                                                    </td>
                                                    {series.map(s => (
                                                        <React.Fragment key={s.key}>
                                                            <td className="p-1">
                                                                <Input type="number" value={row[s.key] ?? ""} onChange={e => updateCell(ri, s.key, e.target.value)} className="h-7 text-xs w-20" />
                                                            </td>
                                                            {s.errorBarKey && (
                                                                <td className="p-1">
                                                                    <Input type="number" value={row[s.errorBarKey] ?? ""} onChange={e => updateCell(ri, s.errorBarKey!, e.target.value)} className="h-7 text-xs w-16" />
                                                                </td>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                    <td className="p-1">
                                                        {data.length > 1 && (
                                                            <Button variant="ghost" size="sm" onClick={() => removeRow(ri)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ── Style Tab ── */}
                        <TabsContent value="style" className="p-4 space-y-5 mt-0">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Font Family</Label>
                                <Select value={config.fontFamily} onValueChange={v => updateConfig("fontFamily", v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {allFonts.map(f => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Colors */}
                            <div className="space-y-3 pt-2 border-t border-border">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Colors</Label>
                                <ColorRow label="Axis Lines" value={config.xAxis.color} onChange={v => { updateAxis("xAxis", "color", v); updateAxis("yAxis", "color", v) }} />
                                <ColorRow label="Axis Text" value={config.xAxis.fontColor} onChange={v => { updateAxis("xAxis", "fontColor", v); updateAxis("yAxis", "fontColor", v) }} />
                                <ColorRow label="Title" value={config.title.color} onChange={v => updateTitle("color", v)} />

                                <div className="space-y-1.5 pt-2">
                                    <Label className="text-xs text-muted-foreground">Preview Background</Label>
                                    <p className="text-[10px] text-muted-foreground/70">Colors auto-adjust for contrast — exported PNG is always transparent</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {[
                                            { value: "checkerboard", label: "Checker" },
                                            { value: "#ffffff", label: "White" },
                                            { value: "#000000", label: "Black" },
                                            { value: "#1a1a2e", label: "Dark" },
                                            { value: "#f0f0f0", label: "Light" },
                                        ].map(bg => (
                                            <button
                                                key={bg.value}
                                                onClick={() => applyAutoContrast(bg.value)}
                                                className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${config.previewBg === bg.value ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-accent"
                                                    }`}
                                            >
                                                {bg.label}
                                            </button>
                                        ))}
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="color"
                                                value={config.previewBg === "checkerboard" ? "#ffffff" : config.previewBg}
                                                onChange={e => applyAutoContrast(e.target.value)}
                                                className="h-6 w-6 rounded cursor-pointer border-0 p-0"
                                            />
                                            <span className="text-[10px] text-muted-foreground">Custom</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="space-y-3 pt-2 border-t border-border">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legend</Label>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">Show Legend</Label>
                                    <Switch checked={config.legend.show} onCheckedChange={v => updateLegend("show", v)} />
                                </div>
                                {config.legend.show && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Position</Label>
                                            <Select value={config.legend.position} onValueChange={v => updateLegend("position", v)}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="top">Top (above chart)</SelectItem>
                                                    <SelectItem value="bottom">Bottom (below chart)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Layout</Label>
                                            <Select value={config.legend.layout} onValueChange={v => updateLegend("layout", v)}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="horizontal">Horizontal row</SelectItem>
                                                    <SelectItem value="vertical">Vertical stack</SelectItem>
                                                    <SelectItem value="columns">Grid columns</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {config.legend.layout === "columns" && (
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-muted-foreground">Columns: {config.legend.columns}</Label>
                                                <Slider value={[config.legend.columns]} onValueChange={([v]) => updateLegend("columns", v)} min={1} max={6} step={1} />
                                            </div>
                                        )}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Icon Shape</Label>
                                            <Select value={config.legend.iconType} onValueChange={v => updateLegend("iconType", v)}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {(["circle", "square", "diamond", "triangle", "line", "rect"] as const).map(t => (
                                                        <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Font Size</Label>
                                            <Input type="number" value={config.legend.fontSize} onChange={e => updateLegend("fontSize", parseInt(e.target.value) || 13)} />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Error Bars */}
                            <div className="space-y-3 pt-2 border-t border-border">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Error Bars</Label>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">Show Error Bars</Label>
                                    <Switch checked={config.showErrorBars} onCheckedChange={v => updateConfig("showErrorBars", v)} />
                                </div>
                                {config.showErrorBars && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Stroke Width</Label>
                                            <Slider value={[config.errorBarStrokeWidth]} onValueChange={([v]) => updateConfig("errorBarStrokeWidth", v)} min={0.5} max={5} step={0.5} />
                                        </div>
                                        <ColorRow label="Color" value={config.errorBarColor} onChange={v => updateConfig("errorBarColor", v)} />
                                    </>
                                )}
                            </div>
                        </TabsContent>

                        {/* ── Axis Tab ── */}
                        <TabsContent value="axis" className="p-4 space-y-5 mt-0">
                            {(["xAxis", "yAxis"] as const).map(axis => (
                                <div key={axis} className="space-y-3">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {axis === "xAxis" ? "X Axis" : "Y Axis"}
                                    </Label>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Label</Label>
                                        <Input value={config[axis].label} onChange={e => updateAxis(axis, "label", e.target.value)} placeholder={`${axis === "xAxis" ? "X" : "Y"} axis label…`} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Label Font Size</Label>
                                            <Input type="number" value={config[axis].fontSize} onChange={e => updateAxis(axis, "fontSize", parseInt(e.target.value) || 14)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Tick Font Size</Label>
                                            <Input type="number" value={config[axis].tickFontSize} onChange={e => updateAxis(axis, "tickFontSize", parseInt(e.target.value) || 12)} />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Axis Line Width: {config[axis].lineWidth}px</Label>
                                        <Slider value={[config[axis].lineWidth]} onValueChange={([v]) => updateAxis(axis, "lineWidth", v)} min={0} max={5} step={0.5} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Tick Mark Length: {config[axis].tickSize}px</Label>
                                        <Slider value={[config[axis].tickSize]} onValueChange={([v]) => updateAxis(axis, "tickSize", v)} min={0} max={15} step={1} />
                                    </div>
                                    <ColorRow label="Line Color" value={config[axis].color} onChange={v => updateAxis(axis, "color", v)} />
                                    <ColorRow label="Text Color" value={config[axis].fontColor} onChange={v => updateAxis(axis, "fontColor", v)} />
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs text-muted-foreground">Show Gridlines</Label>
                                        <Switch checked={config[axis].showGrid} onCheckedChange={v => updateAxis(axis, "showGrid", v)} />
                                    </div>
                                    {axis === "yAxis" && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Min</Label>
                                                <Input value={config[axis].min || ""} onChange={e => updateAxis(axis, "min", e.target.value)} placeholder="Auto" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Max</Label>
                                                <Input value={config[axis].max || ""} onChange={e => updateAxis(axis, "max", e.target.value)} placeholder="Auto" />
                                            </div>
                                        </div>
                                    )}
                                    {axis === "xAxis" && <div className="border-b border-border" />}
                                </div>
                            ))}
                        </TabsContent>

                        {/* ── Layout Tab ── */}
                        <TabsContent value="layout" className="p-4 space-y-5 mt-0">
                            <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 bg-muted/50 rounded p-2">
                                <Move className="h-3 w-3 shrink-0" /> Drag title & legend directly on the preview. Hold <strong>Shift</strong> to lock to one axis.
                            </p>

                            {/* Title */}
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</Label>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Text</Label>
                                    <Input value={config.title.text} onChange={e => updateTitle("text", e.target.value)} placeholder="Figure title…" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Font Size</Label>
                                        <Input type="number" value={config.title.fontSize} onChange={e => updateTitle("fontSize", parseInt(e.target.value) || 18)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Alignment</Label>
                                        <Select value={config.title.align} onValueChange={v => updateTitle("align", v)}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="left">Left</SelectItem>
                                                <SelectItem value="center">Center</SelectItem>
                                                <SelectItem value="right">Right</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Offset X</Label>
                                        <Input type="number" value={config.title.offsetX} onChange={e => updateTitle("offsetX", parseInt(e.target.value) || 0)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Offset Y</Label>
                                        <Input type="number" value={config.title.offsetY} onChange={e => updateTitle("offsetY", parseInt(e.target.value) || 0)} />
                                    </div>
                                </div>
                            </div>

                            {/* Legend offset */}
                            {config.legend.show && (
                                <div className="space-y-3 pt-2 border-t border-border">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legend Position</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Offset X</Label>
                                            <Input type="number" value={config.legend.offsetX} onChange={e => updateLegend("offsetX", parseInt(e.target.value) || 0)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Offset Y</Label>
                                            <Input type="number" value={config.legend.offsetY} onChange={e => updateLegend("offsetY", parseInt(e.target.value) || 0)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Chart margins */}
                            <div className="space-y-3 pt-2 border-t border-border">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chart Margins (px)</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["top", "right", "bottom", "left"] as const).map(side => (
                                        <div key={side} className="space-y-1">
                                            <Label className="text-xs text-muted-foreground capitalize">{side}</Label>
                                            <Input type="number" value={config.margin[side]} onChange={e => updateMargin(side, parseInt(e.target.value) || 0)} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right Panel — Preview */}
                <div
                    className="flex-1 flex items-center justify-center overflow-auto p-8"
                    style={previewBgStyle(config.previewBg)}
                >
                    <div
                        ref={chartRef}
                        style={{
                            width: config.chartWidth,
                            height: config.chartHeight,
                            fontFamily: config.fontFamily,
                            background: "transparent",
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        {/* Title — draggable, always on top */}
                        {config.title.text && (
                            <DraggableOffset
                                x={config.title.offsetX}
                                y={config.title.offsetY}
                                onDrag={(nx, ny) => { updateTitle("offsetX", nx); updateTitle("offsetY", ny) }}
                                zIndex={2000}
                            >
                                <div
                                    style={{
                                        textAlign: config.title.align,
                                        fontSize: config.title.fontSize,
                                        fontWeight: "bold",
                                        fontFamily: config.fontFamily,
                                        color: config.title.color,
                                        marginBottom: 4,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {config.title.text}
                                </div>
                            </DraggableOffset>
                        )}

                        {/* Legend at top — draggable, always on top */}
                        {config.legend.show && config.legend.position === "top" && (
                            <DraggableOffset
                                x={config.legend.offsetX}
                                y={config.legend.offsetY}
                                onDrag={(nx, ny) => { updateLegend("offsetX", nx); updateLegend("offsetY", ny) }}
                                zIndex={2000}
                            >
                                <CustomLegend series={series} config={config} layout={config.legend.layout} columns={config.legend.columns} />
                            </DraggableOffset>
                        )}

                        {/* Chart */}
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                {renderChart() as any}
                            </ResponsiveContainer>
                        </div>

                        {/* Legend at bottom — draggable, always on top */}
                        {config.legend.show && config.legend.position === "bottom" && (
                            <DraggableOffset
                                x={config.legend.offsetX}
                                y={config.legend.offsetY}
                                onDrag={(nx, ny) => { updateLegend("offsetX", nx); updateLegend("offsetY", ny) }}
                                zIndex={2000}
                            >
                                <CustomLegend series={series} config={config} layout={config.legend.layout} columns={config.legend.columns} />
                            </DraggableOffset>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
