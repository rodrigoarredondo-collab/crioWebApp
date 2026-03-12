import { getPrivateGoogleSheetData } from "@/lib/google-sheets"
import { Database, ArrowLeft } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { DetailedResultsTable, DetailedResultsData } from "@/components/dashboard/detailed-results-table"

export default async function DetailedDataPage({
    params,
    searchParams
}: {
    params: Promise<{ inkNumber: string, cellLine: string }>
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

    const resolvedSearchParams = await searchParams;
    let targetDrugs: any = null;
    if (resolvedSearchParams.drugs) {
        try {
            targetDrugs = JSON.parse(resolvedSearchParams.drugs as string);
        } catch (e) {
            console.error("Failed to parse drugs query param", e);
        }
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

        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i]
            const rInk = String(row[idxInkNumber] || "")
            const rCell = String(row[idxCellLine] || "")
            const rDrugsStr = String(row[idxDrugs] || "")

            // Match ink (handling "no-ink" case)
            const inkMatches = (rInk === inkNumberDecoded) || (inkNumberDecoded === "no-ink" && rInk === "")

            if (inkMatches && rCell === cellLineDecoded) {
                // Match drugs if provided
                let drugsMatch = true;
                if (targetDrugs) {
                    try {
                        const rowDrugs = JSON.parse(rDrugsStr);
                        // Simple deep comparison for stringified objects
                        drugsMatch = JSON.stringify(rowDrugs) === JSON.stringify(targetDrugs);
                    } catch (e) {
                        drugsMatch = false;
                    }
                } else {
                    // If no target drugs, the row should also have no drugs
                    drugsMatch = !rDrugsStr;
                }

                if (!drugsMatch) continue;

                if (!formulationObj) {
                    formulationObj = {
                        cpa1Name: row[idxCPA1Name] || "", cpa1Ptg: row[idxCPA1Ptg] || "",
                        cpa2Name: row[idxCPA2Name] || "", cpa2Ptg: row[idxCPA2Ptg] || "",
                        cpa3Name: row[idxCPA3Name] || "", cpa3Ptg: row[idxCPA3Ptg] || "",
                    }
                }
                mappedData.push({
                    date: row[idxDate] !== undefined ? String(row[idxDate]) : "",
                    storageTime: row[idxStorage] !== undefined ? String(row[idxStorage]) : "",
                    assayDay: row[idxAssay] !== undefined ? String(row[idxAssay]) : "",
                    format: row[idxFormat] !== undefined ? String(row[idxFormat]) : "",
                    process: row[idxProcess] !== undefined ? String(row[idxProcess]) : "",
                    result: row[idxResult] !== undefined ? String(row[idxResult]) : "",
                    wellNumber: row[idxWell] !== undefined ? String(row[idxWell]) : "",
                } as DetailedResultsData) // Casting temporarily until we update the interface
            }
        }

        const fParts = []
        if (formulationObj?.cpa1Name && parseFloat(formulationObj.cpa1Ptg) > 0) fParts.push(`${formulationObj.cpa1Name}: ${parseFloat(formulationObj.cpa1Ptg)}%`)
        if (formulationObj?.cpa2Name && parseFloat(formulationObj.cpa2Ptg) > 0) fParts.push(`${formulationObj.cpa2Name}: ${parseFloat(formulationObj.cpa2Ptg)}%`)
        if (formulationObj?.cpa3Name && parseFloat(formulationObj.cpa3Ptg) > 0) fParts.push(`${formulationObj.cpa3Name}: ${parseFloat(formulationObj.cpa3Ptg)}%`)

        if (fParts.length > 0) {
            formulationStr = fParts.join(", ")
        }
    }

    return (
        <DashboardShell user={user} profile={profile}>
            <div className="p-6 md:p-10 w-full space-y-6">
                <div>
                    <Link href="/dashboard/data" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-4 group font-medium">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Dataset
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Database className="h-8 w-8 text-primary" />
                        Results
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        View metrics for a specific formulation group.
                    </p>
                </div>

                {errorMsg ? (
                    <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive shadow-sm">
                        {errorMsg}
                    </div>
                ) : (
                    <DetailedResultsTable
                        inkNumber={inkNumberDecoded === "no-ink" ? "" : inkNumberDecoded}
                        cellLine={cellLineDecoded}
                        formulation={formulationStr}
                        drugs={targetDrugs}
                        data={mappedData}
                    />
                )}
            </div>
        </DashboardShell>
    )
}
