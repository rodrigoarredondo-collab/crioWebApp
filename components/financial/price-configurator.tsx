"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { UnitInput } from "@/components/ui/unit-input"
import { Checkbox } from "@/components/ui/checkbox"
import { config } from "process"

interface HumanHours {
    ink: number
    cell: number
    printing: number
    post: number
}

interface Assays {
    cell_viability_assay: number
    albumin_assay: number
    tryglicerides_assay: number
    alt_assay: number
    lactate_assay: number
}

// Supporting both number and object structure for backward compatibility
interface ValueWithUnit {
    value: number
    unit: string
}

interface PriceConfig {
    volume_96: number | ValueWithUnit
    cell_concentration: string // Keeping string for "12M", will parse to exponent
    gelma: number
    lap: number
    dmso: number
    raffinose: number
    ink_vol: number | ValueWithUnit
    cell: string
    ink_type: string
    consumables: number
    human_hours: HumanHours
    assays: Assays
}

interface PriceConfiguratorProps {
    initialConfig: PriceConfig
    userId: string
    priceMap: Record<string, { price: number, quantity: string }>
    isReadOnly?: boolean
}

interface ComponentBreakdown {
    unitPriceString: string
    amount: number
    amountUnit: string
    costInk: number
    costPlate: number
}

interface VolumeBreakdown {
    flasks: { count: number; costInk: number; costPlate: number; unitPrice: number }
    dmem: { volume: number; costInk: number; costPlate: number; unitPrice: number }
    fbs: { volume: number; costInk: number; costPlate: number; unitPrice: number }
    trypsin: { volume: number; costInk: number; costPlate: number; unitPrice: number }
    plates: { count: number; costInk: number; costPlate: number; unitPrice: number },
    mixture: { volume: number; costInk: number; costPlate: number; unitPrice: number },
    totalInk: number,
    totalPlate: number
}

interface AssayBreakdown {
    cell_viability_assay: { count: number; unitPrice: number; costPlate: number },
    albumin_assay: { count: number; unitPrice: number; costPlate: number },
    tryglicerides_assay: { count: number; unitPrice: number; costPlate: number },
    alt_assay: { count: number; unitPrice: number; costPlate: number },
    lactate_assay: { count: number; unitPrice: number; costPlate: number },
    totalPerPlate: number
}

interface HumanHoursBreakdown {
    ink: number
    cell: number
    printing: number
    post: number
    totalHours: number
    hourlyRate: number
    totalCost: number
    costPerPlate: number
}

interface Breakdown {
    gelma?: ComponentBreakdown
    lap?: ComponentBreakdown
    dmso?: ComponentBreakdown
    raffinose?: ComponentBreakdown
    inkVol?: VolumeBreakdown
    humanHours?: HumanHoursBreakdown
    assays?: AssayBreakdown
}

const BreakdownDisplay = ({ data, label, fullyExpand }: { data?: ComponentBreakdown, label: string, fullyExpand: boolean }) => {
    if (!data || !fullyExpand) return null
    return (
        <div className="mt-2 p-2 rounded-md bg-primary/5 border border-primary/10 text-[11px] space-y-1 animate-in fade-in slide-in-from-top-1">
            <p className="font-semibold text-primary">{label} Breakdown:</p>
            <div className="grid grid-cols-2 gap-x-2">
                <span className="text-muted-foreground">Price per unit:</span>
                <span className="text-right font-mono">{data.unitPriceString}</span>
                <span className="text-muted-foreground">Amount used:</span>
                <span className="text-right font-mono">{data.amount.toFixed(3)}{data.amountUnit}</span>
                <span className="text-muted-foreground">Cost per ink volume:</span>
                <span className="text-right font-mono">${data.costInk.toFixed(2)}</span>
                <span className="text-muted-foreground font-medium">Cost per well plate:</span>
                <span className="text-right font-mono font-medium">${data.costPlate.toFixed(2)}</span>
            </div>
        </div>
    )
}

const VolumeBreakdownDisplay = ({ data, fullyExpand }: { data?: VolumeBreakdown, fullyExpand: boolean }) => {
    if (!data || !fullyExpand) return null
    return (
        <div className="mt-2 p-3 rounded-md bg-primary/5 border border-primary/10 text-[11px] space-y-2 animate-in fade-in slide-in-from-top-1">
            <p className="font-semibold text-primary text-xs border-b border-primary/10 pb-1">Detailed Ink Volume Expansion:</p>

            <div className="space-y-1.5">
                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>Flasks ({data.flasks.count} count)</span>
                        <span className="font-mono text-[10px]">${data.flasks.unitPrice.toFixed(2)}/ea</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 pl-2">
                        <span className="text-muted-foreground">Cost per ink vol:</span>
                        <span className="text-right font-mono">${data.flasks.costInk.toFixed(2)}</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>DMEM</span>
                        <span className="font-mono text-[10px]">${data.dmem.unitPrice.toFixed(3)}/ml</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>FBS</span>
                        <span className="font-mono text-[10px]">${data.fbs.unitPrice.toFixed(3)}/ml</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>DMEM + FBS ({data.mixture.volume.toFixed(1)}ml)</span>
                        <span className="font-mono text-[10px]">${data.mixture.unitPrice.toFixed(3)}/ml</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 pl-2">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="text-right font-mono">${data.mixture.costInk.toFixed(2)}</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>Trypsin ({data.trypsin.volume.toFixed(1)}ml)</span>
                        <span className="font-mono text-[10px]">${data.trypsin.unitPrice.toFixed(3)}/ml</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 pl-2">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="text-right font-mono">${data.trypsin.costInk.toFixed(2)}</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>Well Plates ({data.plates.count.toFixed(1)} count)</span>
                        <span className="font-mono text-[10px]">${data.plates.unitPrice.toFixed(2)}/ea</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 pl-2">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="text-right font-mono">${data.plates.costInk.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div className="pt-1.5 border-t border-primary/10">
                <div className="grid grid-cols-2 gap-x-2">
                    <span className="font-medium text-primary uppercase text-[10px]">Total Setup:</span>
                    <span className="text-right font-bold font-mono text-primary">${data.totalInk.toFixed(2)}</span>
                    <span className="font-medium text-primary uppercase text-[10px]">Per Plate:</span>
                    <span className="text-right font-bold font-mono text-primary">${data.totalPlate.toFixed(2)}</span>
                </div>
            </div>
        </div>
    )
}

const AssayBreakdownDisplay = ({ data, fullyExpand }: { data?: AssayBreakdown, fullyExpand: boolean }) => {
    if (!data || !fullyExpand) return null
    return (
        <div className="mt-2 p-3 rounded-md bg-primary/5 border border-primary/10 text-[11px] space-y-2 animate-in fade-in slide-in-from-top-1">
            <p className="font-semibold text-primary text-xs border-b border-primary/10 pb-1">Detailed Assay Expansion:</p>

            <div className="space-y-1.5">
                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>Cell Viability ({data.cell_viability_assay.count} count)</span>
                        <span className="font-mono text-[10px]">${data.cell_viability_assay.unitPrice.toFixed(2)}/ea</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 pl-2">
                        <span className="text-muted-foreground">Cost per plate:</span>
                        <span className="text-right font-mono">${data.cell_viability_assay.costPlate.toFixed(2)}</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>Albumin ({data.albumin_assay.count} count)</span>
                        <span className="font-mono text-[10px]">${data.albumin_assay.unitPrice.toFixed(2)}/ea</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 pl-2">
                        <span className="text-muted-foreground">Cost per plate:</span>
                        <span className="text-right font-mono">${data.albumin_assay.costPlate.toFixed(2)}</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>Tryglicerides ({data.tryglicerides_assay.count} count)</span>
                        <span className="font-mono text-[10px]">${data.tryglicerides_assay.unitPrice.toFixed(2)}/ea</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 pl-2">
                        <span className="text-muted-foreground">Cost per plate:</span>
                        <span className="text-right font-mono">${data.tryglicerides_assay.costPlate.toFixed(2)}</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>ALT ({data.alt_assay.count.toFixed(1)} count)</span>
                        <span className="font-mono text-[10px]">${data.alt_assay.unitPrice.toFixed(2)}/ea</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 pl-2">
                        <span className="text-muted-foreground">Cost per plate:</span>
                        <span className="text-right font-mono">${data.alt_assay.costPlate.toFixed(2)}</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center opacity-70">
                        <span>Lactate ({data.lactate_assay.count.toFixed(1)} count)</span>
                        <span className="font-mono text-[10px]">${data.lactate_assay.unitPrice.toFixed(2)}/ea</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 pl-2">
                        <span className="text-muted-foreground">Cost per plate:</span>
                        <span className="text-right font-mono">${data.lactate_assay.costPlate.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div className="pt-1.5 border-t border-primary/10">
                <div className="grid grid-cols-2 gap-x-2">
                    <span className="font-medium text-primary uppercase text-[10px]">Total Per Plate:</span>
                    <span className="text-right font-bold font-mono text-primary">${data.totalPerPlate.toFixed(2)}</span>
                </div>
            </div>
        </div>
    )
}

const HumanHoursBreakdownDisplay = ({ data, fullyExpand }: { data?: HumanHoursBreakdown, fullyExpand: boolean }) => {
    if (!data || !fullyExpand) return null
    return (
        <div className="mt-4 p-3 rounded-md bg-primary/5 border border-primary/10 text-[11px] space-y-2 animate-in fade-in slide-in-from-top-1 w-full max-w-md mx-auto lg:mx-0">
            <p className="font-semibold text-primary text-xs border-b border-primary/10 pb-1">Human Hours Breakdown (${data.hourlyRate}/hr):</p>
            <div className="grid grid-cols-2 gap-y-1">
                <span className="text-muted-foreground">Ink Preparation:</span>
                <span className="text-right font-mono">{data.ink} hrs</span>
                <span className="text-muted-foreground">Cell Work:</span>
                <span className="text-right font-mono">{data.cell} hrs</span>
                <span className="text-muted-foreground">Printing:</span>
                <span className="text-right font-mono">{data.printing} hrs</span>
                <span className="text-muted-foreground">Post Processing:</span>
                <span className="text-right font-mono">{data.post} hrs</span>
                <div className="col-span-2 border-t border-primary/5 my-1" />
                <span className="font-medium text-primary uppercase text-[10px]">Total Hours:</span>
                <span className="text-right font-bold font-mono text-primary">{data.totalHours} hrs</span>
                <span className="font-medium text-primary uppercase text-[10px]">Total Cost:</span>
                <span className="text-right font-bold font-mono text-primary">${data.totalCost.toFixed(2)}</span>
            </div>
        </div>
    )
}

export function PriceConfigurator({ initialConfig, userId, priceMap, isReadOnly }: PriceConfiguratorProps) {
    const [config, setConfig] = useState<PriceConfig>(initialConfig)
    const [price, setPrice] = useState<number>(0)
    const [isSaving, setIsSaving] = useState(false)
    const [fullyExpand, setFullyExpand] = useState(false)
    const [breakdown, setBreakdown] = useState<Breakdown>({})

    const calculatePrice = () => {
        const inkVol = Number(typeof config.ink_vol === 'object' ? (config.ink_vol as ValueWithUnit).value : config.ink_vol)
        const volume96 = Number(typeof config.volume_96 === 'object' ? (config.volume_96 as ValueWithUnit).value : config.volume_96)
        const plates = inkVol / volume96

        const getStats = (name: string, val: number) => {
            const item = priceMap[name] || { price: 0, quantity: "1" }
            const quantityMatch = item.quantity.match(/\d*\.?\d+/)
            const unitQty = Number(quantityMatch?.[0]) || 1
            const unitMatch = item.quantity.replace(quantityMatch?.[0] || "", "").trim() || "unit"

            const unitPrice = item.price / unitQty
            const massNeeded = (val / 100) * inkVol
            const costInkVal = massNeeded * unitPrice

            return {
                unitPriceString: `$${item.price.toFixed(2)} / ${item.quantity}`,
                amount: massNeeded,
                amountUnit: unitMatch,
                costInk: costInkVal,
                costPlate: costInkVal / plates
            }
        }

        const gelmaStats = getStats("gelma", config.gelma)
        const lapStats = getStats("lap", config.lap)
        const dmsoStats = getStats("dmso", config.dmso)
        const raffinoseStats = getStats("raffinose", config.raffinose)

        const cellConcentration = config.cell_concentration == "12M"
            ? 12000000
            : (Number(config.cell_concentration.match(/\d+/g)?.[0]) || 0) * 10 ** (Number(config.cell_concentration.match(/\d+/g)?.[2]) || 0)

        const flaskAmount = Math.ceil((cellConcentration * inkVol) / 10000000) + 1

        const flaskItem = priceMap["T75_flask"] || { price: 0, quantity: "1" }
        const flaskUnitPrice = flaskItem.price / (Number(flaskItem.quantity.match(/\d*\.?\d+/)?.[0]) || 1)
        const flaskTotalCost = flaskAmount * flaskUnitPrice

        const dmemItem = priceMap["dmem"] || { price: 0, quantity: "500" }
        const fbsItem = priceMap["fbs"] || { price: 0, quantity: "50" }
        const dmemVolUnit = Number(dmemItem.quantity.match(/\d*\.?\d+/)?.[0]) || 500
        const fbsVolUnit = Number(fbsItem.quantity.match(/\d*\.?\d+/)?.[0]) || 50
        const dmemUnitPrice = dmemItem.price / dmemVolUnit
        const fbsUnitPrice = fbsItem.price / fbsVolUnit

        const mixtureVolPerFlask = 24
        const totalMixtureVol = flaskAmount * mixtureVolPerFlask
        const dmemTotalVolNeeded = dmemVolUnit// Mixture is base DMEM
        const fbsTotalVolNeeded = dmemVolUnit * 0.1 // 10% of DMEM volume

        const dmemTotalCost = dmemTotalVolNeeded * dmemUnitPrice
        const fbsTotalCost = fbsTotalVolNeeded * fbsUnitPrice
        const mixtureTotalCost = (dmemUnitPrice + fbsUnitPrice * 0.1) * totalMixtureVol / 1.1

        const trypsinItem = priceMap["trypsin"] || { price: 0, quantity: "100" }
        const trypsinVolPerFlask = 4
        const totalTrypsinVol = flaskAmount * trypsinVolPerFlask
        const trypsinUnitPrice = trypsinItem.price / (Number(trypsinItem.quantity.match(/\d*\.?\d+/)?.[0]) || 1)
        const trypsinTotalCost = totalTrypsinVol * trypsinUnitPrice

        const wellPlateItem = priceMap["96_wellPlate"] || { price: 0, quantity: "1" }
        const wellPlateUnitPrice = wellPlateItem.price / (Number(wellPlateItem.quantity.match(/\d*\.?\d+/)?.[0]) || 1)
        const platesTotalCost = plates * wellPlateUnitPrice

        const inkVolumeSetupCost = flaskTotalCost + mixtureTotalCost + trypsinTotalCost + platesTotalCost

        const totalHours = config.human_hours.ink + config.human_hours.cell + config.human_hours.printing + config.human_hours.post
        const hourlyRate = 23
        const humanHoursCost = totalHours * hourlyRate

        const assaysUnitPrice = { "cellViability": priceMap["cellViability"].price / (Number(priceMap["cellViability"].quantity.match(/\d*\.?\d+/)?.[0]) || 1), "alt": priceMap["alt"].price / (Number(priceMap["alt"].quantity.match(/\d*\.?\d+/)?.[0]) || 1), "tryglicerides": priceMap["tryglicerides"].price / (Number(priceMap["tryglicerides"].quantity.match(/\d*\.?\d+/)?.[0]) || 1), "albuminProduction": priceMap["albuminProduction"].price / (Number(priceMap["albuminProduction"].quantity.match(/\d*\.?\d+/)?.[0]) || 1), "lactateAssay": priceMap["lactateAssay"].price / (Number(priceMap["lactateAssay"].quantity.match(/\d*\.?\d+/)?.[0]) || 1) }

        const assaysPriceValue = assaysUnitPrice["cellViability"] * config.assays.cell_viability_assay + assaysUnitPrice["albuminProduction"] * config.assays.albumin_assay + assaysUnitPrice["tryglicerides"] * config.assays.tryglicerides_assay + assaysUnitPrice["alt"] * config.assays.alt_assay + assaysUnitPrice["lactateAssay"] * config.assays.lactate_assay

        const totalPriceValue = (gelmaStats.costInk + lapStats.costInk + dmsoStats.costInk + raffinoseStats.costInk + inkVolumeSetupCost) / plates + humanHoursCost + assaysPriceValue + config.consumables

        setPrice(Number(totalPriceValue.toFixed(2)))
        setBreakdown({
            gelma: gelmaStats,
            lap: lapStats,
            dmso: dmsoStats,
            raffinose: raffinoseStats,
            inkVol: {
                flasks: { count: flaskAmount, costInk: flaskTotalCost, costPlate: flaskTotalCost / plates, unitPrice: flaskUnitPrice },
                dmem: { volume: dmemTotalVolNeeded, costInk: dmemTotalCost, costPlate: dmemTotalCost / plates, unitPrice: dmemUnitPrice },
                fbs: { volume: fbsTotalVolNeeded, costInk: fbsTotalCost, costPlate: fbsTotalCost / plates, unitPrice: fbsUnitPrice },
                trypsin: { volume: totalTrypsinVol, costInk: trypsinTotalCost, costPlate: trypsinTotalCost / plates, unitPrice: trypsinUnitPrice },
                plates: { count: plates, costInk: platesTotalCost, costPlate: platesTotalCost / plates, unitPrice: wellPlateUnitPrice },
                totalInk: inkVolumeSetupCost,
                totalPlate: inkVolumeSetupCost / plates,
                mixture: { volume: totalMixtureVol, costInk: mixtureTotalCost, costPlate: mixtureTotalCost / plates, unitPrice: (dmemUnitPrice + fbsUnitPrice * 0.1) / 1.1 }
            },
            humanHours: {
                ink: config.human_hours.ink,
                cell: config.human_hours.cell,
                printing: config.human_hours.printing,
                post: config.human_hours.post,
                totalHours,
                hourlyRate,
                totalCost: humanHoursCost,
                costPerPlate: humanHoursCost / plates
            },
            assays: {
                cell_viability_assay: { count: config.assays.cell_viability_assay, unitPrice: assaysUnitPrice["cellViability"], costPlate: assaysUnitPrice["cellViability"] * config.assays.cell_viability_assay },
                albumin_assay: { count: config.assays.albumin_assay, unitPrice: assaysUnitPrice["albuminProduction"], costPlate: assaysUnitPrice["albuminProduction"] * config.assays.albumin_assay },
                tryglicerides_assay: { count: config.assays.tryglicerides_assay, unitPrice: assaysUnitPrice["tryglicerides"], costPlate: assaysUnitPrice["tryglicerides"] * config.assays.tryglicerides_assay },
                alt_assay: { count: config.assays.alt_assay, unitPrice: assaysUnitPrice["alt"], costPlate: assaysUnitPrice["alt"] * config.assays.alt_assay },
                lactate_assay: { count: config.assays.lactate_assay, unitPrice: assaysUnitPrice["lactateAssay"], costPlate: assaysUnitPrice["lactateAssay"] * config.assays.lactate_assay },
                totalPerPlate: assaysPriceValue
            }
        })
    }

    useEffect(() => {
        calculatePrice()
    }, [config])

    // Helper to get value and unit safely
    const getValue = (field: keyof PriceConfig): number | string => {
        const val = config[field]
        if (typeof val === 'object' && val !== null && 'value' in val) {
            return (val as ValueWithUnit).value
        }
        return Number(val) || 0
    }

    const getUnit = (field: keyof PriceConfig, defaultUnit: string): string => {
        const val = config[field]
        if (typeof val === 'object' && val !== null && 'unit' in val) {
            return (val as ValueWithUnit).unit
        }
        return defaultUnit
    }

    const updateValue = (field: keyof PriceConfig, newValue: number) => {
        setConfig((prev) => {
            const current = prev[field]
            if (typeof current === 'object' && current !== null && 'value' in current) {
                return { ...prev, [field]: { ...current, value: newValue } }
            }
            return { ...prev, [field]: newValue }
        })
    }

    const updateUnit = (field: keyof PriceConfig, newUnit: string) => {
        setConfig((prev) => {
            const current = prev[field]
            const val = (typeof current === 'object' && current !== null && 'value' in current)
                ? (current as ValueWithUnit).value
                : Number(current)

            return { ...prev, [field]: { value: val, unit: newUnit } }
        })
    }

    // Specific handler for simple fields (gelma, lap, etc)
    const handleSimpleChange = (field: keyof PriceConfig, value: string | number) => {
        setConfig((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const handleAssayChange = (field: keyof PriceConfig["assays"], value: string | number) => {
        setConfig((prev) => ({
            ...prev,
            assays: {
                ...prev.assays,
                [field]: value,
            },
        }))
    }

    const handleHumanHoursChange = (field: keyof HumanHours, value: number) => {
        setConfig((prev) => ({
            ...prev,
            human_hours: {
                ...prev.human_hours,
                [field]: value,
            },
        }))
    }

    // Parse cell_concentration for UI
    const getConcentrationParts = () => {
        const str = config.cell_concentration || ""
        let multiplier = 1
        let exponent = 6

        // Format: "1.2*10^6" or "10^6" or "12M"
        if (str.includes("M")) {
            // Legacy support: 12M -> 12 * 10^6
            multiplier = Number(str.replace("M", ""))
            exponent = 6
        } else if (str.includes("*10^")) {
            const parts = str.split("*10^")
            multiplier = Number(parts[0])
            exponent = Number(parts[1])
        } else if (str.includes("10^")) {
            // just 10^x -> 1 * 10^x
            const parts = str.split("10^")
            exponent = Number(parts[1])
        }

        return { multiplier, exponent }
    }

    const { multiplier: cellMultiplier, exponent: cellExponent } = getConcentrationParts()

    const updateConcentration = (newMult: number, newExp: number) => {
        setConfig(prev => ({ ...prev, cell_concentration: `${newMult}*10^${newExp}` }))
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from("price_configuration")
                .update({ configuration: config })
                .eq("user_id", userId)

            if (error) throw error

            toast.success("Configuration saved successfully")
        } catch (error) {
            console.error("Error saving configuration:", error)
            toast.error("Failed to save configuration")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle>Configuration</CardTitle>
                        <CardDescription>Adjust the parameters to calculate the wellplate price.</CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="fully-expand"
                            checked={fullyExpand}
                            onCheckedChange={(checked) => setFullyExpand(!!checked)}
                        />
                        <Label htmlFor="fully-expand" className="text-sm font-medium cursor-pointer">
                            Fully expand
                        </Label>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="volume_96">Volume / 96 Well Plate</Label>
                            <UnitInput
                                id="volume_96"
                                type="number"
                                min={0}
                                placeholder="0"
                                value={getValue("volume_96") == 0 ? "" : getValue("volume_96")}
                                onChange={(val) => updateValue("volume_96", Number(val))}
                                unit={getUnit("volume_96", "mL")}
                                onUnitChange={(u) => updateUnit("volume_96", u)}
                                allowUnitSelection
                                unitOptions={["mL", "uL", "L"]}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cell_concentration">Cell Concentration</Label>
                            <div className="flex h-10 w-full items-center gap-2">
                                <Input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={cellMultiplier == 0 ? "" : cellMultiplier}
                                    onChange={(e) => updateConcentration(Number(e.target.value), cellExponent)}
                                    className="flex-1 bg-background"
                                />
                                <span className="text-sm font-medium">x 10</span>
                                <sup className="flex items-center -top-2 relative">
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="0"
                                        className="w-12 h-6 text-sm border border-input rounded px-1 text-center outline-none focus:border-primary bg-background"
                                        value={cellExponent == 0 ? "" : cellExponent}
                                        onChange={(e) => updateConcentration(cellMultiplier, Number(e.target.value))}
                                    />
                                </sup>
                                <span className="text-sm text-muted-foreground whitespace-nowrap ml-1">Cells / mL</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Ink Type</Label>
                            <Select defaultValue={config.ink_type} onValueChange={(value) => handleSimpleChange("ink_type", value)}>
                                <SelectTrigger className="w-full bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gelma_based">Gelma Based</SelectItem>
                                    <SelectItem value="cell_based">Cell Based</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Model</Label>
                            <Select defaultValue={config.cell} onValueChange={(value) => handleSimpleChange("cell", value)}>
                                <SelectTrigger className="w-full bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="liver">Liver</SelectItem>
                                    <SelectItem value="pancreas">Pancreas</SelectItem>
                                    <SelectItem value="brain">Brain</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
                {!isReadOnly && (
                    <CardFooter className="flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </CardFooter>
                )}
            </Card>

            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-lg">Price / Well Plate</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{`$ ${price ? price : "--.--"}`}</div>
                    <p className="text-xs text-muted-foreground mt-1">Calculated based on current configuration</p>
                </CardContent>
            </Card>

            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="prices">
                    <AccordionTrigger>Expand prices (Secondary Configuration)</AccordionTrigger>
                    <AccordionContent>
                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="consumables">Consumables Cost</Label>
                                        <UnitInput
                                            id="consumables"
                                            type="number"
                                            min={0}
                                            placeholder="0"
                                            value={config.consumables == 0 ? "" : config.consumables}
                                            onChange={(val) => handleSimpleChange("consumables", Number(val))}
                                            unit="$"
                                            unitPosition="left"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="ink_vol">Ink Volume</Label>
                                        <UnitInput
                                            id="ink_vol"
                                            type="number"
                                            value={getValue("ink_vol") == 0 ? "" : getValue("ink_vol")}
                                            min={0}
                                            placeholder="0"
                                            onChange={(val) => updateValue("ink_vol", Number(val))}
                                            unit={getUnit("ink_vol", "mL")}
                                            onUnitChange={(u) => updateUnit("ink_vol", u)}
                                            allowUnitSelection
                                            unitOptions={["mL", "uL", "L"]}
                                        />
                                        <VolumeBreakdownDisplay data={breakdown.inkVol} fullyExpand={fullyExpand} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium leading-none">Ink Formulation</h4>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="gelma">GelMA</Label>
                                            <UnitInput
                                                id="gelma"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.gelma == 0 ? "" : config.gelma}
                                                onChange={(val) => handleSimpleChange("gelma", Number(val))}
                                                unit="%"
                                            />
                                            <BreakdownDisplay data={breakdown.gelma} label="GelMA" fullyExpand={fullyExpand} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lap">LAP</Label>
                                            <UnitInput
                                                id="lap"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.lap == 0 ? "" : config.lap}
                                                onChange={(val) => handleSimpleChange("lap", Number(val))}
                                                unit="%"
                                            />
                                            <BreakdownDisplay data={breakdown.lap} label="LAP" fullyExpand={fullyExpand} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="dmso">DMSO</Label>
                                            <UnitInput
                                                id="dmso"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.dmso == 0 ? "" : config.dmso}
                                                onChange={(val) => handleSimpleChange("dmso", Number(val))}
                                                unit="%"
                                            />
                                            <BreakdownDisplay data={breakdown.dmso} label="DMSO" fullyExpand={fullyExpand} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="raffinose">Raffinose</Label>
                                            <UnitInput
                                                id="raffinose"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.raffinose == 0 ? "" : config.raffinose}
                                                onChange={(val) => handleSimpleChange("raffinose", Number(val))}
                                                unit="%"
                                            />
                                            <BreakdownDisplay data={breakdown.raffinose} label="Raffinose" fullyExpand={fullyExpand} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium leading-none">Human Hours</h4>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="hh_ink">Ink</Label>
                                            <UnitInput
                                                id="hh_ink"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.human_hours.ink == 0 ? "" : config.human_hours.ink}
                                                onChange={(val) => handleHumanHoursChange("ink", Number(val))}
                                                unit="Hours"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="hh_cell">Cell</Label>
                                            <UnitInput
                                                id="hh_cell"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.human_hours.cell == 0 ? "" : config.human_hours.cell}
                                                onChange={(val) => handleHumanHoursChange("cell", Number(val))}
                                                unit="Hours"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="hh_printing">Printing</Label>
                                            <UnitInput
                                                id="hh_printing"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.human_hours.printing == 0 ? "" : config.human_hours.printing}
                                                onChange={(val) => handleHumanHoursChange("printing", Number(val))}
                                                unit="Hours"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="hh_post">Post</Label>
                                            <UnitInput
                                                id="hh_post"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.human_hours.post == 0 ? "" : config.human_hours.post}
                                                onChange={(val) => handleHumanHoursChange("post", Number(val))}
                                                unit="Hours"
                                            />
                                        </div>
                                    </div>
                                    <HumanHoursBreakdownDisplay data={breakdown.humanHours} fullyExpand={fullyExpand} />
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium leading-none">Assays</h4>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="cell_viability_assay">Cell Viability</Label>
                                            <UnitInput
                                                id="cell_viability_assay"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.assays.cell_viability_assay == 0 ? "" : config.assays.cell_viability_assay}
                                                onChange={(val) => handleAssayChange("cell_viability_assay", Number(val))}
                                                unit="per plate"
                                                unitPosition="right"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="albumin_assay">Albumin Production</Label>
                                            <UnitInput
                                                id="albumin_assay"
                                                type="number"
                                                value={config.assays.albumin_assay == 0 ? "" : config.assays.albumin_assay}
                                                min={0}
                                                placeholder="0"
                                                onChange={(val) => handleAssayChange("albumin_assay", Number(val))}
                                                unit="per plate"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="tryglicerides_assay">Tryglicerides</Label>
                                            <UnitInput
                                                id="tryglicerides_assay"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.assays.tryglicerides_assay == 0 ? "" : config.assays.tryglicerides_assay}
                                                onChange={(val) => handleAssayChange("tryglicerides_assay", Number(val))}
                                                unit="per plate"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="alt_assay">ALT</Label>
                                            <UnitInput
                                                id="alt_assay"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.assays.alt_assay == 0 ? "" : config.assays.alt_assay}
                                                onChange={(val) => handleAssayChange("alt_assay", Number(val))}
                                                unit="per plate"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lactate_assay">Lactate Assay</Label>
                                            <UnitInput
                                                id="lactate_assay"
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={config.assays.lactate_assay == 0 ? "" : config.assays.lactate_assay}
                                                onChange={(val) => handleAssayChange("lactate_assay", Number(val))}
                                                unit="per plate"
                                            />
                                        </div>
                                    </div>
                                    <AssayBreakdownDisplay data={breakdown.assays} fullyExpand={fullyExpand} />
                                </div>
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    )
}
