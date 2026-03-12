"use client"

import React, { useState } from "react"
import { Upload } from "lucide-react"
import { CsvImportDialog } from "@/components/dashboard/csv-import-dialog"
import { useRouter } from "next/navigation"

interface ExistingInk {
    inkNumber: string
    cpa1Name: string
    cpa1Ptg: string
    cpa2Name: string
    cpa2Ptg: string
    cpa3Name: string
    cpa3Ptg: string
}

interface DataImportButtonProps {
    existingInks: ExistingInk[]
}

export function DataImportButton({ existingInks }: DataImportButtonProps) {
    const [open, setOpen] = useState(false)
    const router = useRouter()

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
                <Upload className="w-4 h-4" />
                Import Data
            </button>

            <CsvImportDialog
                open={open}
                onClose={() => setOpen(false)}
                existingInks={existingInks}
                onSuccess={() => router.refresh()}
            />
        </>
    )
}
