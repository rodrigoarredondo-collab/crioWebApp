"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Loader2 } from "lucide-react"

interface CreateDataroomDialogProps {
    onCreated: (room: any) => void
}

export function CreateDataroomDialog({ onCreated }: CreateDataroomDialogProps) {
    const [open, setOpen] = useState(false)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        setLoading(true)
        try {
            const res = await fetch("/api/datarooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description }),
            })
            const room = await res.json()
            if (!res.ok) throw new Error(room.error || "Failed to create dataroom")
            onCreated(room)
            setOpen(false)
            setName("")
            setDescription("")
        } catch (err: any) {
            console.error(err)
            alert(err.message || "Failed to create dataroom (check server logs)")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Dataroom
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create a new Data Room</DialogTitle>
                        <DialogDescription>
                            Set up a secure space to share files and grant access to selected resources.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="dr-name">Name</Label>
                            <Input
                                id="dr-name"
                                placeholder="e.g. Series A Due Diligence"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="dr-desc">Description (optional)</Label>
                            <Textarea
                                id="dr-desc"
                                placeholder="Brief description of this data room..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !name.trim()}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
