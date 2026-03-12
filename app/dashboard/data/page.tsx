import { getPrivateGoogleSheetData } from "@/lib/google-sheets"
import { Database } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DynamicDataTable } from "@/components/dashboard/dynamic-data-table"
import { DataImportButton } from "@/components/dashboard/data-import-button"

export default async function DataDashboardPage() {
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

    const sheetId = "1VmkS3dF_flpIerjjscJto8m-kE9z81LGAMtRmtVHl7c"
    let data: string[][] | null = null
    let errorMsg = null

    try {
        data = await getPrivateGoogleSheetData(sheetId, "Sheet1")
    } catch (error: any) {
        errorMsg = error.message || "Failed to fetch Excel data from Drive"
    }

    // Extract existing ink formulations for the import dialog
    const existingInks: { inkNumber: string; cpa1Name: string; cpa1Ptg: string; cpa2Name: string; cpa2Ptg: string; cpa3Name: string; cpa3Ptg: string }[] = []
    if (data && data.length > 1) {
        const headers = data[0]
        const idxInk = headers.indexOf("Ink_Number")
        const idxCPA1Name = headers.indexOf("CPA1_name")
        const idxCPA1Ptg = headers.indexOf("CPA1_ptg")
        const idxCPA2Name = headers.indexOf("CPA2_name")
        const idxCPA2Ptg = headers.indexOf("CPA2_ptg")
        const idxCPA3Name = headers.indexOf("CPA3_name")
        const idxCPA3Ptg = headers.indexOf("CPA3_ptg")

        const seen = new Set<string>()
        for (let i = 1; i < data.length; i++) {
            const row = data[i]
            const inkNum = String(row[idxInk] || "")
            if (inkNum && !seen.has(inkNum)) {
                seen.add(inkNum)
                existingInks.push({
                    inkNumber: inkNum,
                    cpa1Name: String(row[idxCPA1Name] || ""),
                    cpa1Ptg: String(row[idxCPA1Ptg] || ""),
                    cpa2Name: String(row[idxCPA2Name] || ""),
                    cpa2Ptg: String(row[idxCPA2Ptg] || ""),
                    cpa3Name: String(row[idxCPA3Name] || ""),
                    cpa3Ptg: String(row[idxCPA3Ptg] || ""),
                })
            }
        }
    }

    return (
        <DashboardShell user={user} profile={profile}>
            <div className="p-6 md:p-10 w-full space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Database className="h-8 w-8 text-primary" />
                            Dataset
                        </h1>
                    </div>
                    <DataImportButton existingInks={existingInks} />
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card text-card-foreground shadow-sm overflow-hidden">
                    {errorMsg ? (
                        <div className="p-6">
                            <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                                {errorMsg}
                            </div>
                        </div>
                    ) : data && data.length > 0 ? (
                        <DynamicDataTable headers={data[0]} rows={data.slice(1)} />
                    ) : (
                        <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground">
                            <p>No data retrieved yet.</p>
                            <p className="text-sm mt-1">Configure your Google Sheets ID and range to fetch data.</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    )
}

