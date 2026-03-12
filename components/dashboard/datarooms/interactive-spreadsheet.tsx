"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Workbook } from "@fortune-sheet/react"
import "@fortune-sheet/react/dist/index.css"
import { transformExcelToFortune } from "@zenmrp/fortune-sheet-excel"

interface InteractiveSpreadsheetProps {
    url: string
    fileName?: string
}

export function InteractiveSpreadsheet({ url, fileName }: InteractiveSpreadsheetProps) {
    const [sheetConfig, setSheetConfig] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        setLoading(true)
        setError(null)

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch spreadsheet.")
                return res.blob()
            })
            .then(blob => {
                const file = new File([blob], fileName || "workbook.xlsx")
                transformExcelToFortune(file).then((exportJson: any) => {
                    console.log("FortuneSheet parsed JSON:", exportJson)
                    if (exportJson.sheets && exportJson.sheets.length > 0) {
                        if (mounted) {
                            // Ensure fortune sheet has celldata properly initialized
                            const formattedSheets = exportJson.sheets.map((sheet: any) => {
                                // If parser only generated celldata (1D array), we must delete the 'data'
                                // array so FortuneSheet's internal auto-initialization perfectly rebuilds the 2D matrix.
                                // The parser often sets data = [null, null...] which suppresses FortuneSheet's reconstruct logic.
                                if (sheet.celldata && Array.isArray(sheet.celldata) && sheet.celldata.length > 0) {
                                    delete sheet.data
                                }
                                return sheet
                            })
                            setSheetConfig(formattedSheets)
                            setLoading(false)
                        }
                    } else {
                        if (mounted) {
                            setError("Failed to parse the spreadsheet. It may be empty or an unsupported format.")
                            setLoading(false)
                        }
                    }
                }).catch((err: any) => {
                    console.error("transformExcelToFortune error:", err)
                    if (mounted) {
                        setError("Failed to parse the spreadsheet.")
                        setLoading(false)
                    }
                })
            })
            .catch(err => {
                console.error("InteractiveSpreadsheet error:", err)
                if (mounted) {
                    setError("Failed to load spreadsheet data.")
                    setLoading(false)
                }
            })

        return () => {
            mounted = false
        }
    }, [url, fileName])

    if (loading) {
        return (
            <div className="flex h-full min-h-[500px] w-full flex-col items-center justify-center bg-muted/20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Parsing spreadsheet cells and styles...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-full min-h-[500px] w-full flex-col items-center justify-center bg-muted/20 p-8 text-center">
                <AlertCircle className="h-10 w-10 text-destructive mb-4" />
                <h3 className="text-lg font-medium">Spreadsheet Unavailable</h3>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </div>
        )
    }

    return (
        <div className="w-full h-full min-h-[600px] bg-white relative rounded-xl border flex flex-col" style={{ height: "calc(100vh - 200px)" }}>
            {sheetConfig.length > 0 && (
                <Workbook data={sheetConfig} />
            )}
        </div>
    )
}
