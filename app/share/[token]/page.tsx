"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
    FileText,
    Download,
    DollarSign,
    Folder,
    Database,
    Lock,
    Loader2,
    AlertTriangle,
    Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { PriceConfigurator } from "@/components/financial/price-configurator"
import { WorkspaceList } from "@/components/dashboard/workspace-list"
import { InteractiveSpreadsheet } from "@/components/dashboard/datarooms/interactive-spreadsheet"
import dynamic from "next/dynamic"

const FilePreviewModal = dynamic(
    () => import("@/components/dashboard/datarooms/file-preview-modal").then(mod => mod.FilePreviewModal),
    { ssr: false }
)

type ShareData = {
    dataroom_name: string
    dataroom_description: string | null
    files: {
        id: string
        file_name: string
        file_size: number
        mime_type: string | null
        download_url: string | null
        created_at: string
    }[]
    access: {
        finance: boolean
        projects: boolean
        data: boolean
    }
    payloads?: {
        finance: any
        projects: any
        data: any
    }
}

export default function PublicSharePage() {
    const { token } = useParams<{ token: string }>()
    const [data, setData] = useState<ShareData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewFile, setPreviewFile] = useState<{ id: string, name: string } | null>(null)

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/share/${token}`)
                if (!res.ok) {
                    const err = await res.json()
                    setError(err.error || "Link not found or expired")
                    return
                }
                setData(await res.json())
            } catch {
                setError("An unexpected error occurred")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [token])

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-6">
                <div className="rounded-full bg-destructive/10 p-4 mb-4">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold">Link Unavailable</h1>
                <p className="text-muted-foreground mt-2 max-w-md">
                    {error || "This share link has expired or been revoked by the owner."}
                </p>
            </div>
        )
    }

    // Determine which tabs to show
    const tabs: { value: string; label: string; icon: React.ReactNode }[] = [
        { value: "files", label: "Files", icon: <FileText className="h-4 w-4" /> },
    ]
    if (data.access.finance) tabs.push({ value: "finance", label: "Finance", icon: <DollarSign className="h-4 w-4" /> })
    if (data.access.projects) tabs.push({ value: "projects", label: "Projects", icon: <Folder className="h-4 w-4" /> })
    if (data.access.data) tabs.push({ value: "data", label: "Data", icon: <Database className="h-4 w-4" /> })

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card">
                <div className="max-w-5xl mx-auto px-6 py-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="rounded-lg bg-primary/10 p-2">
                            <Lock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Shared Data Room</p>
                            <h1 className="text-2xl font-bold">{data.dataroom_name}</h1>
                        </div>
                    </div>
                    {data.dataroom_description && (
                        <p className="text-muted-foreground mt-1 ml-12">{data.dataroom_description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3 ml-12">
                        {data.access.finance && <Badge variant="secondary" className="text-xs gap-1"><DollarSign className="h-3 w-3" /> Finance</Badge>}
                        {data.access.projects && <Badge variant="secondary" className="text-xs gap-1"><Folder className="h-3 w-3" /> Projects</Badge>}
                        {data.access.data && <Badge variant="secondary" className="text-xs gap-1"><Database className="h-3 w-3" /> Data</Badge>}
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-6 py-8">
                <Tabs defaultValue="files" className="w-full">
                    <TabsList>
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                                {tab.icon}
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* Files tab — always present */}
                    <TabsContent value="files" className="mt-6">
                        {data.files.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground/60" />
                                <p>No files have been shared in this data room yet.</p>
                            </div>
                        ) : (
                            <div className="rounded-xl border bg-card divide-y">
                                {data.files.map((file) => (
                                    <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                                        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{file.file_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        {file.download_url && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => {
                                                    setPreviewFile({ id: file.id, name: file.file_name })
                                                    setPreviewOpen(true)
                                                }}
                                            >
                                                <Eye className="h-4 w-4" />
                                                View
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Resource tabs — Real read-only views */}
                    {data.access.finance && (
                        <TabsContent value="finance" className="mt-6">
                            {data.payloads?.finance ? (
                                <PriceConfigurator
                                    initialConfig={data.payloads.finance.config}
                                    priceMap={data.payloads.finance.priceMap}
                                    userId="shared-read-only"
                                    isReadOnly={true}
                                />
                            ) : (
                                <div className="rounded-xl border bg-card p-8 text-center">
                                    <DollarSign className="h-10 w-10 text-primary mx-auto mb-3" />
                                    <h3 className="text-lg font-semibold">Finance</h3>
                                    <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                                        No financial configuration found for this dataroom.
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                    )}
                    {data.access.projects && (
                        <TabsContent value="projects" className="mt-6">
                            {data.payloads?.projects ? (
                                <WorkspaceList
                                    workspaces={data.payloads.projects}
                                    userId="shared-read-only"
                                    isReadOnly={true}
                                />
                            ) : (
                                <div className="rounded-xl border bg-card p-8 text-center">
                                    <Folder className="h-10 w-10 text-primary mx-auto mb-3" />
                                    <h3 className="text-lg font-semibold">Projects</h3>
                                    <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                                        No project workspaces found for this dataroom.
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                    )}
                    {data.access.data && (
                        <TabsContent value="data" className="mt-6">
                            {data.payloads?.data?.url ? (
                                <InteractiveSpreadsheet
                                    url={data.payloads.data.url}
                                    fileName="Master_Data_Sheet.xlsx"
                                />
                            ) : (
                                <div className="rounded-xl border bg-card p-8 text-center">
                                    <Database className="h-10 w-10 text-primary mx-auto mb-3" />
                                    <h3 className="text-lg font-semibold">Data</h3>
                                    <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                                        No table data is available via Google Sheets.
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                    )}
                </Tabs>
            </main>

            {/* File Preview Modal */}
            <FilePreviewModal
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                token={token}
                fileId={previewFile?.id || null}
                fileName={previewFile?.name || null}
            />
        </div>
    )
}
