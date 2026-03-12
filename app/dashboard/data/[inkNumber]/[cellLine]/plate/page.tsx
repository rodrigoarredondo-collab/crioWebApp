import { getPrivateGoogleSheetData } from "@/lib/google-sheets"
import { Database, ArrowLeft } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { DetailedResultsData } from "@/components/dashboard/detailed-results-table"
import { WellPlateViewer } from "@/components/dashboard/well-plate-viewer"

export default async function WellPlateDataPage({
    params,
    searchParams
}: {
    params: Promise<{ inkNumber: string, cellLine: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const supabase = await createClient()

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect("/auth/login")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

    const resolvedParams = await params;
    let inkNumberDecoded = resolvedParams.inkNumber;
    let cellLineDecoded = resolvedParams.cellLine;

    try {
        inkNumberDecoded = decodeURIComponent(resolvedParams.inkNumber);
    } catch (e) { }

    try {
        cellLineDecoded = decodeURIComponent(resolvedParams.cellLine);
    } catch (e) { }

    // Await search params in next 15+
    const resolvedSearchParams = await searchParams;
    const targetDate = resolvedSearchParams.date as string || ""
    const targetStorageTime = resolvedSearchParams.storageTime as string || ""
    const targetAssayDay = resolvedSearchParams.assayDay as string || ""
    const targetFormat = resolvedSearchParams.format as string || ""
    const targetProcess = resolvedSearchParams.process as string || ""
    let targetDrugs: any = null;
    if (resolvedSearchParams.drugs) {
        try {
            targetDrugs = JSON.parse(resolvedSearchParams.drugs as string);
        } catch (e) {
            console.error("Failed to parse drugs query param", e);
        }
    }

    // Comparison params
    const cInk = resolvedSearchParams.compareInk as string || ""
    const cCell = resolvedSearchParams.compareCell as string || ""
    const cDate = resolvedSearchParams.compareDate as string || ""
    const cStorage = resolvedSearchParams.compareStorage as string || ""
    const cAssay = resolvedSearchParams.compareAssay as string || ""
    const cFormat = resolvedSearchParams.compareFormat as string || ""
    const cProcess = resolvedSearchParams.compareProcess as string || ""
    let cDrugs: any = null;
    if (resolvedSearchParams.compareDrugs) {
        try {
            cDrugs = JSON.parse(resolvedSearchParams.compareDrugs as string);
        } catch (e) { }
    }

    const sheetId = "1VmkS3dF_flpIerjjscJto8m-kE9z81LGAMtRmtVHl7c"
    let rawData: string[][] | null = null
    let errorMsg = null

    try {
        rawData = await getPrivateGoogleSheetData(sheetId, "Sheet1")
    } catch (error: any) {
        errorMsg = error.message || "Failed to fetch Excel data from Drive"
    }

    let mappedData: DetailedResultsData[] = []
    let formulationStr = "No formulation data available"

    let finalAvailableBatches: any[] = []
    let finalCompareData: DetailedResultsData[] = []
    let finalCompareConditions: any = undefined

    if (rawData && rawData.length > 1) {
        const headers = rawData[0]
        const idxCellLine = headers.indexOf("Cell_Line")
        const idxInkNumber = headers.indexOf("Ink_Number")

        const idxCPA1Name = headers.indexOf("CPA1_name")
        const idxCPA1Ptg = headers.indexOf("CPA1_ptg")
        const idxCPA2Name = headers.indexOf("CPA2_name")
        const idxCPA2Ptg = headers.indexOf("CPA2_ptg")
        const idxCPA3Name = headers.indexOf("CPA3_name")
        const idxCPA3Ptg = headers.indexOf("CPA3_ptg")

        const idxDate = headers.indexOf("Date_Printed")
        const idxStorage = headers.indexOf("Storage_Time")
        const idxAssay = headers.indexOf("Assay_Day")
        const idxFormat = headers.indexOf("Format")
        const idxProcess = headers.indexOf("Manufacturing_Process")
        const idxResult = headers.indexOf("Result")
        const idxDrugs = headers.indexOf("Drugs")
        const idxWell = headers.indexOf("Well_Number")

        let formulationObj: any = null
        let compareFormulationObj: any = null

        const batchesSet = new Set<string>();
        const availableBatches: any[] = [];
        let compareMappedData: DetailedResultsData[] = []

        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i]
            const rInk = String(row[idxInkNumber] || "")
            const rCell = String(row[idxCellLine] || "")
            const rDrugsStr = String(row[idxDrugs] || "")
            const rDate = row[idxDate] !== undefined ? String(row[idxDate]) : ""
            const rStorage = row[idxStorage] !== undefined ? String(row[idxStorage]) : ""
            const rAssay = row[idxAssay] !== undefined ? String(row[idxAssay]) : ""
            const rFormat = row[idxFormat] !== undefined ? String(row[idxFormat]) : ""
            const rProcess = row[idxProcess] !== undefined ? String(row[idxProcess]) : ""
            const rResult = row[idxResult] !== undefined ? String(row[idxResult]) : ""
            const rWell = row[idxWell] !== undefined ? String(row[idxWell]) : ""

            // Build available batches
            const batchKey = `${rInk}|${rCell}|${rDate}|${rStorage}|${rAssay}|${rFormat}|${rProcess}|${rDrugsStr}`
            if (!batchesSet.has(batchKey) && rResult !== "") {
                batchesSet.add(batchKey)
                availableBatches.push({
                    inkNumber: rInk,
                    cellLine: rCell,
                    date: rDate,
                    storageTime: rStorage,
                    assayDay: rAssay,
                    format: rFormat,
                    process: rProcess,
                    drugs: rDrugsStr ? JSON.parse(rDrugsStr) : null,
                    formulation: {
                        cpa1Name: row[idxCPA1Name] || "", cpa1Ptg: row[idxCPA1Ptg] || "",
                        cpa2Name: row[idxCPA2Name] || "", cpa2Ptg: row[idxCPA2Ptg] || "",
                        cpa3Name: row[idxCPA3Name] || "", cpa3Ptg: row[idxCPA3Ptg] || ""
                    }
                })
            }

            // Primary batch logic
            const inkMatches = (rInk === inkNumberDecoded) || (inkNumberDecoded === "no-ink" && rInk === "")
            if (inkMatches && rCell === cellLineDecoded) {
                let drugsMatch = true;
                if (targetDrugs) {
                    try {
                        const rowDrugs = JSON.parse(rDrugsStr);
                        drugsMatch = JSON.stringify(rowDrugs) === JSON.stringify(targetDrugs);
                    } catch (e) { drugsMatch = false; }
                } else {
                    drugsMatch = !rDrugsStr;
                }

                if (drugsMatch) {
                    if (!formulationObj) {
                        formulationObj = {
                            cpa1Name: row[idxCPA1Name] || "", cpa1Ptg: row[idxCPA1Ptg] || "",
                            cpa2Name: row[idxCPA2Name] || "", cpa2Ptg: row[idxCPA2Ptg] || "",
                            cpa3Name: row[idxCPA3Name] || "", cpa3Ptg: row[idxCPA3Ptg] || "",
                        }
                    }

                    if (rDate === targetDate && rStorage === targetStorageTime && rAssay === targetAssayDay && rFormat === targetFormat && rProcess === targetProcess) {
                        mappedData.push({
                            date: rDate, storageTime: rStorage, assayDay: rAssay,
                            format: rFormat, process: rProcess, result: rResult, wellNumber: rWell
                        })
                    }
                }
            }

            // Comparison batch logic
            if (cInk !== "" || cCell !== "" || cDate !== "") {
                const cInkMatches = (rInk === cInk) || (cInk === "no-ink" && rInk === "")
                if (cInkMatches && rCell === cCell) {
                    let cDrugsMatch = true;
                    if (cDrugs) {
                        try {
                            const rowDrugs = JSON.parse(rDrugsStr);
                            cDrugsMatch = JSON.stringify(rowDrugs) === JSON.stringify(cDrugs);
                        } catch (e) { cDrugsMatch = false; }
                    } else {
                        cDrugsMatch = !rDrugsStr;
                    }

                    if (cDrugsMatch) {
                        if (!compareFormulationObj) {
                            compareFormulationObj = {
                                cpa1Name: row[idxCPA1Name] || "", cpa1Ptg: row[idxCPA1Ptg] || "",
                                cpa2Name: row[idxCPA2Name] || "", cpa2Ptg: row[idxCPA2Ptg] || "",
                                cpa3Name: row[idxCPA3Name] || "", cpa3Ptg: row[idxCPA3Ptg] || "",
                            }
                        }

                        if (rDate === cDate && rStorage === cStorage && rAssay === cAssay && rFormat === cFormat && rProcess === cProcess) {
                            compareMappedData.push({
                                date: rDate, storageTime: rStorage, assayDay: rAssay,
                                format: rFormat, process: rProcess, result: rResult, wellNumber: rWell
                            })
                        }
                    }
                }
            }
        }

        const fParts = []
        if (formulationObj?.cpa1Name && parseFloat(formulationObj.cpa1Ptg) > 0) fParts.push(`${formulationObj.cpa1Name}: ${parseFloat(formulationObj.cpa1Ptg)}%`)
        if (formulationObj?.cpa2Name && parseFloat(formulationObj.cpa2Ptg) > 0) fParts.push(`${formulationObj.cpa2Name}: ${parseFloat(formulationObj.cpa2Ptg)}%`)
        if (formulationObj?.cpa3Name && parseFloat(formulationObj.cpa3Ptg) > 0) fParts.push(`${formulationObj.cpa3Name}: ${parseFloat(formulationObj.cpa3Ptg)}%`)

        if (fParts.length > 0) {
            formulationStr = fParts.join(", ")
        }

        let cFormulationStr = "No formulation data available";
        const cfParts = []
        if (compareFormulationObj?.cpa1Name && parseFloat(compareFormulationObj.cpa1Ptg) > 0) cfParts.push(`${compareFormulationObj.cpa1Name}: ${parseFloat(compareFormulationObj.cpa1Ptg)}%`)
        if (compareFormulationObj?.cpa2Name && parseFloat(compareFormulationObj.cpa2Ptg) > 0) cfParts.push(`${compareFormulationObj.cpa2Name}: ${parseFloat(compareFormulationObj.cpa2Ptg)}%`)
        if (compareFormulationObj?.cpa3Name && parseFloat(compareFormulationObj.cpa3Ptg) > 0) cfParts.push(`${compareFormulationObj.cpa3Name}: ${parseFloat(compareFormulationObj.cpa3Ptg)}%`)

        if (cfParts.length > 0) {
            cFormulationStr = cfParts.join(", ")
        }

        // Pass this down
        finalAvailableBatches = availableBatches;
        finalCompareData = compareMappedData;
        finalCompareConditions = {
            inkNumber: cInk,
            cellLine: cCell,
            formulation: cFormulationStr,
            drugs: cDrugs,
            date: cDate,
            storageTime: cStorage,
            assayDay: cAssay,
            format: cFormat,
            process: cProcess
        }
    }

    const backHref = targetDrugs
        ? `/dashboard/data/${encodeURIComponent(resolvedParams.inkNumber)}/${encodeURIComponent(resolvedParams.cellLine)}?drugs=${encodeURIComponent(JSON.stringify(targetDrugs))}`
        : `/dashboard/data/${encodeURIComponent(resolvedParams.inkNumber)}/${encodeURIComponent(resolvedParams.cellLine)}`

    return (
        <DashboardShell user={user} profile={profile}>
            <div className="p-4 md:p-6 w-full space-y-3">
                <div>
                    <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-2 group font-medium">
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                        Back to Results
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Well Plate Batch Visualization
                    </h1>
                </div>

                {errorMsg ? (
                    <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive shadow-sm">
                        {errorMsg}
                    </div>
                ) : (
                    <WellPlateViewer
                        inkNumber={inkNumberDecoded === "no-ink" ? "" : inkNumberDecoded}
                        cellLine={cellLineDecoded}
                        formulation={formulationStr}
                        drugs={targetDrugs}
                        data={mappedData}
                        conditions={{
                            date: targetDate,
                            storageTime: targetStorageTime,
                            assayDay: targetAssayDay,
                            format: targetFormat,
                            process: targetProcess
                        }}
                        availableBatches={finalAvailableBatches || []}
                        compareData={finalCompareData || []}
                        compareConditions={cDate !== "" ? finalCompareConditions : undefined}
                    />
                )}
            </div>
        </DashboardShell>
    )
}
