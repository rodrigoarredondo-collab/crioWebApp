"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface AddItemDialogProps {
    type: 'investor' | 'prospect'
    onAdd: (data: { name: string; website: string; description: string; location: string }) => Promise<void>
}

export function AddItemDialog({ type, onAdd }: AddItemDialogProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        website: "",
        description: "",
        location: ""
    })

    const title = type === 'investor' ? "Add Venture" : "Add Company"
    const description = type === 'investor'
        ? "Add a new venture capital firm to your list."
        : "Add a new prospect company to your list."

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name || !formData.website || !formData.description || !formData.location) {
            toast.error("All fields are required")
            return
        }

        try {
            setIsLoading(true)
            await onAdd(formData)
            toast.success(`${type === 'investor' ? 'Investor' : 'Prospect'} added successfully`)
            setOpen(false)
            setFormData({ name: "", website: "", description: "", location: "" })
        } catch (error) {
            console.error(error)
            toast.error("Failed to add item")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    {title}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            {description}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder={type === 'investor' ? "e.g. Example Capital" : "e.g. Example Corp"}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="website">Website</Label>
                            <Input
                                id="website"
                                value={formData.website}
                                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                placeholder="https://example.com"
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                placeholder="e.g. San Francisco, CA"
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description..."
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add {type === 'investor' ? 'Investor' : 'Prospect'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
