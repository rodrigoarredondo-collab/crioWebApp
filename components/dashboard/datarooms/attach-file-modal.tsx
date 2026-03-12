"use client"

import { useCallback, useState, useRef, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Upload, FileText, Loader2, CheckCircle2, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { uploadGlobalFile } from "@/app/actions/upload-file"

interface AttachFileModalProps {
    dataroomId: string
    onFilesAttached: () => void
    attachedFileIds: string[]
}

export function AttachFileModal({ dataroomId, onFilesAttached, attachedFileIds }: AttachFileModalProps) {
    const [open, setOpen] = useState(false)
    const [globalFiles, setGlobalFiles] = useState<any[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [attaching, setAttaching] = useState(false)

    // Upload state
    const [isDragging, setIsDragging] = useState(false)
    const [uploading, setUploading] = useState<any[]>([])
    const inputRef = useRef<HTMLInputElement>(null)

    const fetchGlobalFiles = useCallback(async () => {
        setLoadingFiles(true)
        try {
            const res = await fetch("/api/files")
            if (res.ok) {
                const data = await res.json()
                setGlobalFiles(data)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingFiles(false)
        }
    }, [])

    useEffect(() => {
        if (open) {
            fetchGlobalFiles()
            setSelectedIds(new Set())
            setUploading([])
        }
    }, [open, fetchGlobalFiles])

    const handleAttachSelected = async () => {
        if (selectedIds.size === 0) return
        setAttaching(true)
        try {
            const res = await fetch(`/api/datarooms/${dataroomId}/files`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file_ids: Array.from(selectedIds) })
            })
            if (!res.ok) throw new Error("Failed to attach files")
            toast.success("Files attached to Data Room")
            onFilesAttached()
            setOpen(false)
        } catch (err) {
            toast.error("Failed to attach files")
        } finally {
            setAttaching(false)
        }
    }

    // Direct Upload Handler
    const uploadFile = async (file: File) => {
        const tempId = crypto.randomUUID()
        setUploading(prev => [...prev, { id: tempId, file, status: "uploading" }])

        try {
            const formData = new FormData()
            formData.append("file", file)

            const fileRecord = await uploadGlobalFile(formData)

            setUploading(prev => prev.map(u => u.id === tempId ? { ...u, status: "done" } : u))

            // Auto-attach it immediately
            await fetch(`/api/datarooms/${dataroomId}/files`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file_ids: [fileRecord.id] })
            })

            toast.success(`${file.name} uploaded and attached`)
            onFilesAttached()

            // Remove from ui after delay
            setTimeout(() => setUploading(prev => prev.filter(u => u.id !== tempId)), 2000)

            // Refresh list in background
            fetchGlobalFiles()

        } catch (err: any) {
            setUploading(prev => prev.map(u => u.id === tempId ? { ...u, status: "error" } : u))
            toast.error(`Failed to upload ${file.name}: ${err.message}`)
        }
    }

    const filteredFiles = globalFiles.filter(f =>
        !attachedFileIds.includes(f.id) &&
        f.file_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 shrink-0">
                    <Upload className="h-4 w-4" />
                    Add Files
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col overflow-hidden">
                <DialogHeader className="px-1 shrink-0 pb-2">
                    <DialogTitle>Add Files to Data Room</DialogTitle>
                    <DialogDescription>
                        Upload new files or attach previously uploaded files from your workspace pool.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
                    {/* Upload Dropzone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault()
                            setIsDragging(false)
                            Array.from(e.dataTransfer.files).forEach(uploadFile)
                        }}
                        onClick={() => inputRef.current?.click()}
                        className={`
                            shrink-0 relative flex flex-col items-center justify-center gap-2
                            border-2 border-dashed rounded-xl p-6 cursor-pointer
                            transition-all duration-200
                            ${isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"}
                        `}
                    >
                        <Upload className={`h-6 w-6 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                        <p className="text-sm font-medium">Click to upload new files or drag & drop</p>
                        <input
                            ref={inputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                Array.from(e.target.files || []).forEach(uploadFile)
                                if (inputRef.current) inputRef.current.value = ""
                            }}
                        />
                    </div>

                    {uploading.length > 0 && (
                        <div className="space-y-2 shrink-0 max-h-32 overflow-y-auto">
                            {uploading.map((u) => (
                                <div key={u.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                                    {u.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> :
                                        u.status === "done" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                                            <X className="h-4 w-4 text-destructive" />}
                                    <span className="text-sm truncate flex-1">{u.file.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search workspace files..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-lg bg-background">
                        {loadingFiles ? (
                            <div className="flex h-32 items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredFiles.length === 0 ? (
                            <div className="flex h-32 flex-col items-center justify-center text-muted-foreground text-sm p-4 text-center">
                                {searchQuery ? "No matching files found." : "No new files available in the workspace pool to attach."}
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filteredFiles.map((file) => (
                                    <label
                                        key={file.id}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                    >
                                        <Checkbox
                                            checked={selectedIds.has(file.id)}
                                            onCheckedChange={() => toggleSelect(file.id)}
                                        />
                                        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{file.file_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="shrink-0 pt-4 flex justify-end border-t border-border mt-auto">
                    <Button onClick={handleAttachSelected} disabled={selectedIds.size === 0 || attaching}>
                        {attaching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Attach {selectedIds.size > 0 ? `${selectedIds.size} file${selectedIds.size !== 1 ? 's' : ''}` : 'Files'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
