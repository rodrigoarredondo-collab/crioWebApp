"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AttachFileModal } from "@/components/dashboard/datarooms/attach-file-modal"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    ArrowLeft,
    FileText,
    Download,
    Copy,
    Check,
    XCircle,
    Loader2,
    Settings,
    Lock,
    LinkIcon
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type DataroomFile = {
    file: {
        id: string
        file_name: string
        file_size: number
        mime_type: string | null
        storage_path: string
        created_at: string
    }
}

type ShareLink = {
    id: string
    token: string
    label: string | null
    access_finance: boolean
    access_projects: boolean
    access_data: boolean
    is_active: boolean
    expires_at: string | null
}

type Dataroom = {
    id: string
    name: string
    description: string | null
    created_at: string
    updated_at: string
    attached_files: DataroomFile[]
    dataroom_share_links: ShareLink[]
}

export default function DataroomDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const supabase = createClient()

    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [room, setRoom] = useState<Dataroom | null>(null)
    const [loading, setLoading] = useState(true)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [creatingLink, setCreatingLink] = useState(false)

    // Settings state
    const [editName, setEditName] = useState("")
    const [editDesc, setEditDesc] = useState("")
    const [accessFinance, setAccessFinance] = useState(false)
    const [accessProjects, setAccessProjects] = useState(false)
    const [accessData, setAccessData] = useState(false)
    const [expiresAt, setExpiresAt] = useState("")
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        async function init() {
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error || !user) { router.push("/auth/login"); return }
            setUser(user)
            const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single()
            setProfile(prof)
            await fetchRoom()
        }
        init()
    }, [id])

    const fetchRoom = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true)
        try {
            const res = await fetch(`/api/datarooms/${id}`)
            if (!res.ok) { router.push("/dashboard/datarooms"); return }
            const data = await res.json()
            setRoom(data)

            // Populate form
            setEditName(data.name)
            setEditDesc(data.description || "")
            if (data.dataroom_share_links && data.dataroom_share_links.length > 0) {
                const link = data.dataroom_share_links[0]
                setAccessFinance(link.access_finance)
                setAccessProjects(link.access_projects)
                setAccessData(link.access_data)

                if (link.expires_at) {
                    const d = new Date(link.expires_at)
                    const tzOffset = d.getTimezoneOffset() * 60000
                    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16)
                    setExpiresAt(localISOTime)
                } else {
                    setExpiresAt("")
                }
            }
        } catch { router.push("/dashboard/datarooms") }
        finally { if (showLoading) setLoading(false) }
    }, [id, router])

    const handleDeleteFile = async (fileId: string) => {
        const res = await fetch(`/api/datarooms/${id}/files?fileId=${fileId}`, { method: "DELETE" })
        if (res.ok) {
            setRoom((prev) => prev ? { ...prev, attached_files: prev.attached_files.filter((f) => f.file?.id !== fileId) } : prev)
            toast.success("File removed from data room")
        } else {
            toast.error("Failed to remove file")
        }
    }

    const handleCreateLink = async () => {
        setCreatingLink(true)
        try {
            const res = await fetch(`/api/datarooms/${id}/share`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label: "Default Access Link" })
            })
            if (res.ok) {
                toast.success("Share link generated")
                fetchRoom(false)
            } else {
                toast.error("Failed to generate link")
            }
        } catch {
            toast.error("Failed to generate link")
        } finally {
            setCreatingLink(false)
        }
    }

    const handleCopyLink = async (token: string) => {
        const url = `${window.location.origin}/share/${token}`
        await navigator.clipboard.writeText(url)
        setCopiedId(token)
        toast.success("Link copied")
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleDownloadFile = async (filePath: string, fileName: string) => {
        const { data } = await supabase.storage.from("dataroom-files").createSignedUrl(filePath, 60)
        if (data?.signedUrl) {
            const a = document.createElement("a")
            a.href = data.signedUrl
            a.download = fileName
            a.click()
        }
    }

    const handleSaveSettings = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/datarooms/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName,
                    description: editDesc,
                    access_finance: accessFinance,
                    access_projects: accessProjects,
                    access_data: accessData,
                    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
                }),
            })
            if (res.ok) {
                const updated = await res.json()
                setRoom((prev) => prev ? { ...prev, name: updated.name, description: updated.description } : prev)
                toast.success("Settings saved")
                fetchRoom(false)
            }
        } catch { toast.error("Failed to save") }
        finally { setSaving(false) }
    }

    const handleDeleteRoom = async () => {
        const res = await fetch(`/api/datarooms/${id}`, { method: "DELETE" })
        if (res.ok) {
            toast.success("Data room deleted")
            router.push("/dashboard/datarooms")
        } else {
            toast.error("Failed to delete data room")
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    if (!user || loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!room) return null

    const defaultLink = room.dataroom_share_links?.[0]

    return (
        <DashboardShell user={user} profile={profile}>
            <div className="p-6 md:p-10 w-full space-y-6 max-w-5xl">
                {/* Back + title */}
                <div>
                    <Link
                        href="/dashboard/datarooms"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Data Rooms
                    </Link>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                                <Lock className="h-7 w-7 text-primary" />
                                {room.name}
                            </h1>
                            {room.description && (
                                <p className="text-muted-foreground mt-1">{room.description}</p>
                            )}
                        </div>

                        {defaultLink ? (
                            <Button className="gap-2" onClick={() => handleCopyLink(defaultLink.token)}>
                                {copiedId === defaultLink.token ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                                Copy Share Link
                            </Button>
                        ) : (
                            <Button className="gap-2" onClick={handleCreateLink} disabled={creatingLink}>
                                {creatingLink && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                <LinkIcon className="h-4 w-4" /> Generate Link
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="files" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
                        <TabsTrigger value="files" className="gap-2 text-sm">
                            <FileText className="h-4 w-4" />
                            Files ({(room.attached_files || []).length})
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="gap-2 text-sm">
                            <Settings className="h-4 w-4" />
                            Settings
                        </TabsTrigger>
                    </TabsList>

                    {/* ========== FILES TAB ========== */}
                    <TabsContent value="files" className="space-y-6 mt-6">
                        <AttachFileModal
                            dataroomId={id}
                            onFilesAttached={() => fetchRoom(false)}
                            attachedFileIds={(room.attached_files || []).map(f => f.file?.id).filter(Boolean)}
                        />

                        {(room.attached_files || []).length > 0 && (
                            <div className="rounded-xl border bg-card">
                                <div className="px-4 py-3 border-b">
                                    <h3 className="font-semibold text-sm">Attached Files</h3>
                                </div>
                                <div className="divide-y">
                                    {room.attached_files.map((attached) => {
                                        const file = attached.file
                                        if (!file) return null
                                        return (
                                            <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                                                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{file.file_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDownloadFile(file.storage_path, file.file_name)}
                                                    title="Download"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteFile(file.id)}
                                                    title="Remove"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* ========== SETTINGS TAB ========== */}
                    <TabsContent value="settings" className="space-y-6 mt-6 max-w-2xl">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm border-b pb-2">Room Details</h3>
                                <div className="grid gap-2">
                                    <Label htmlFor="s-name">Name</Label>
                                    <Input
                                        id="s-name"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="s-desc">Description</Label>
                                    <Textarea
                                        id="s-desc"
                                        value={editDesc}
                                        onChange={(e) => setEditDesc(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm border-b pb-2">Link Access Rules</h3>
                                <div className="grid gap-2">
                                    <Label htmlFor="sl-expires">Expiration Date (optional)</Label>
                                    <Input
                                        id="sl-expires"
                                        type="datetime-local"
                                        value={expiresAt}
                                        onChange={(e) => setExpiresAt(e.target.value)}
                                        min={new Date().toISOString().slice(0, 16)}
                                    />
                                </div>

                                <div className="space-y-3 pt-2">
                                    <Label className="text-sm font-medium">Resource Permissions</Label>
                                    <div className="space-y-3 rounded-lg border p-4">
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="acc-finance"
                                                checked={accessFinance}
                                                onCheckedChange={(v) => setAccessFinance(!!v)}
                                            />
                                            <Label htmlFor="acc-finance" className="text-sm font-normal cursor-pointer">
                                                Finance
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="acc-projects"
                                                checked={accessProjects}
                                                onCheckedChange={(v) => setAccessProjects(!!v)}
                                            />
                                            <Label htmlFor="acc-projects" className="text-sm font-normal cursor-pointer">
                                                Projects
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="acc-data"
                                                checked={accessData}
                                                onCheckedChange={(v) => setAccessData(!!v)}
                                            />
                                            <Label htmlFor="acc-data" className="text-sm font-normal cursor-pointer">
                                                Data
                                            </Label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleSaveSettings} disabled={saving} className="w-full sm:w-auto">
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>

                        <div className="border-t pt-6 mt-8">
                            <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
                            <p className="text-sm text-muted-foreground mt-1 mb-4">
                                Permanently delete this data room and all its share links.
                            </p>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">Delete Data Room</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete &quot;{room.name}&quot; and revoke its share link. Attached global files will remain in your workspace. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteRoom} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardShell>
    )
}
