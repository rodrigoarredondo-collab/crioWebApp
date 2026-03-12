"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, AlertCircle } from "lucide-react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { InteractiveSpreadsheet } from "./interactive-spreadsheet"

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface FilePreviewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    token: string
    fileId: string | null
    fileName: string | null
}

export function FilePreviewModal({ open, onOpenChange, token, fileId, fileName }: FilePreviewModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [content, setContent] = useState<{ type: "html" | "url" | "unsupported" | "fortune-sheet", data: string, mimeType?: string } | null>(null)
    const [numPages, setNumPages] = useState<number>()

    const [containerRef, setContainerRef] = useState<HTMLElement | null>(null)
    const [containerWidth, setContainerWidth] = useState<number>()

    useEffect(() => {
        if (!open || !fileId || !token) return

        let mounted = true
        setLoading(true)
        setError(null)
        setContent(null)

        async function fetchPreview() {
            try {
                const res = await fetch(`/api/share/${token}/preview?fileId=${fileId}`)
                const data = await res.json()

                if (!res.ok) {
                    throw new Error(data.error || "Failed to load preview")
                }

                if (!mounted) return

                if (data.type === "url") {
                    setContent({ type: "url", data: data.url, mimeType: data.mimeType })
                } else if (data.type === "html") {
                    setContent({ type: "html", data: data.html })
                } else if (data.type === "fortune-sheet") {
                    setContent({ type: "fortune-sheet", data: data.url, mimeType: data.mimeType })
                } else {
                    setContent({ type: "unsupported", data: data.error || "Unsupported file format" })
                }

            } catch (err: any) {
                console.error("Preview fetch error:", err)
                if (mounted) setError(err.message)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        fetchPreview()

        return () => {
            mounted = false
            setNumPages(undefined)
        }
    }, [open, fileId, token])

    useEffect(() => {
        if (!containerRef) return

        const observer = new ResizeObserver((entries) => {
            const [entry] = entries
            if (entry) {
                setContainerWidth(entry.contentRect.width)
            }
        })

        observer.observe(containerRef)
        return () => observer.disconnect()
    }, [containerRef])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="text-xl">Preview: {fileName || "Document"}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 bg-muted/20 relative overflow-hidden min-h-[500px]">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
                            <p className="text-sm text-muted-foreground animate-pulse">Rendering secure document preview...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                            <h3 className="text-lg font-medium">Preview Failed</h3>
                            <p className="text-muted-foreground mt-2 max-w-sm">{error}</p>
                        </div>
                    )}

                    {!loading && !error && content && (
                        <div className="absolute inset-0 overflow-y-auto bg-white">
                            {content.type === "unsupported" ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-background">
                                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-medium">Preview Unavailable</h3>
                                    <p className="text-muted-foreground mt-2 max-w-sm">{content.data}</p>
                                </div>
                            ) : content.type === "url" && content.mimeType === "application/pdf" ? (
                                <div
                                    className="flex w-full justify-center p-2 sm:p-6 bg-muted/30 min-h-full"
                                    onContextMenu={(e) => e.preventDefault()}
                                >
                                    <div
                                        className="w-full max-w-[800px] flex flex-col items-center"
                                        ref={setContainerRef}
                                    >
                                        <Document
                                            file={content.data}
                                            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                            loading={<Loader2 className="h-10 w-10 animate-spin text-primary my-10 mx-auto" />}
                                            className="flex flex-col gap-4 sm:gap-6 items-center w-full"
                                        >
                                            {containerWidth && Array.from(new Array(numPages || 0), (el, index) => (
                                                <div key={`page_${index + 1}`} className="shadow-xl bg-white select-none w-full max-w-full flex justify-center overflow-hidden">
                                                    <Page
                                                        pageNumber={index + 1}
                                                        renderTextLayer={false}
                                                        renderAnnotationLayer={false}
                                                        className="max-w-full"
                                                        width={containerWidth ? Math.min(containerWidth, 800) : 800}
                                                    />
                                                </div>
                                            ))}
                                        </Document>
                                    </div>
                                </div>
                            ) : content.type === "url" && content.mimeType?.startsWith("image/") ? (
                                <div
                                    className="flex flex-col items-center justify-center p-6 min-h-[500px]"
                                    onContextMenu={(e) => e.preventDefault()}
                                >
                                    <img
                                        src={content.data}
                                        alt={`Preview of ${fileName}`}
                                        className="max-w-full h-auto object-contain max-h-[80vh] shadow-lg pointer-events-none select-none"
                                        draggable={false}
                                        onContextMenu={(e) => e.preventDefault()}
                                    />
                                </div>
                            ) : content.type === "fortune-sheet" ? (
                                <InteractiveSpreadsheet url={content.data} fileName={fileName || "spreadsheet.xlsx"} />
                            ) : content.type === "url" ? (
                                <iframe
                                    src={content.data}
                                    className="w-full h-[80vh] border-0"
                                    title={`Preview of ${fileName}`}
                                />
                            ) : (
                                <div
                                    className="prose prose-sm md:prose-base max-w-none p-8 dark:prose-invert"
                                    dangerouslySetInnerHTML={{ __html: content.data }}
                                />
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
