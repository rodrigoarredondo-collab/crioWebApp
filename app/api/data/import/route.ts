import { NextRequest, NextResponse } from "next/server"
import { getPrivateGoogleSheetData, appendToGoogleSheet } from "@/lib/google-sheets"

const SHEET_ID = "1VmkS3dF_flpIerjjscJto8m-kE9z81LGAMtRmtVHl7c"

interface WellEntry {
    wellNumber: string
    inkNumber: string
    cellLine: string
    format: string
    result: number | string
    cpa1Name: string
    cpa1Ptg: string
    cpa2Name: string
    cpa2Ptg: string
    cpa3Name: string
    cpa3Ptg: string
    drugs: { name: string; concentration: string }[]
}

interface ImportPayload {
    date: string
    process: string
    storageTime: string
    assayDay: string
    plateNumber: string
    wells: WellEntry[]
}

export async function POST(req: NextRequest) {
    try {
        const body: ImportPayload = await req.json()
        const { date, process, storageTime, assayDay, plateNumber, wells } = body

        if (!wells || wells.length === 0) {
            return NextResponse.json({ error: "No well data provided" }, { status: 400 })
        }

        // 1. Read existing headers from the Google Sheet
        const existingData = await getPrivateGoogleSheetData(SHEET_ID, "Sheet1!1:1")
        if (!existingData || existingData.length === 0) {
            return NextResponse.json({ error: "Could not read spreadsheet headers" }, { status: 500 })
        }

        const headers = existingData[0].map(h => String(h).trim())

        // 2. Build a value map for each well, then output in header order
        const newRows: string[][] = wells.map((w) => {
            let drugsStr = ""
            if (w.drugs && w.drugs.length > 0) {
                const drugsObj: Record<string, any> = {}
                let count = 1
                w.drugs.forEach((d) => {
                    if (d.name || d.concentration) {
                        drugsObj[`drug${count}`] = {
                            name: d.name,
                            concentration: d.concentration
                        }
                        count++
                    }
                })
                if (Object.keys(drugsObj).length > 0) {
                    drugsStr = JSON.stringify(drugsObj)
                }
            }

            const valueMap: Record<string, string> = {
                "Ink_Number": String(w.inkNumber),
                "Date_Printed": String(date),
                "CPA1_name": String(w.cpa1Name || ""),
                "CPA1_ptg": String(w.cpa1Ptg || ""),
                "CPA2_name": String(w.cpa2Name || ""),
                "CPA2_ptg": String(w.cpa2Ptg || ""),
                "CPA3_name": String(w.cpa3Name || ""),
                "CPA3_ptg": String(w.cpa3Ptg || ""),
                "Storage_Time": String(storageTime),
                "Assay_Day": String(assayDay),
                "Format": String(w.format || ""),
                "Manufacturing_Process": String(process),
                "Result": String(w.result),
                "Cell_Line": String(w.cellLine || ""),
                "Well_Number": String(w.wellNumber),
                "Plate_Number": String(plateNumber),
                "Drugs": drugsStr,
            }

            // Build the row matching the exact column order of the sheet
            return headers.map(header => valueMap[header] ?? "")
        })

        // 3. Append using the native Sheets API (efficient, no file re-upload)
        const rowsAdded = await appendToGoogleSheet(SHEET_ID, newRows, "Sheet1")

        return NextResponse.json({ success: true, rowsAdded })
    } catch (error: any) {
        console.error("Import API Error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to import data" },
            { status: 500 }
        )
    }
}
