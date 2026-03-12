"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { TaskCluster } from "@/lib/types"
import { createTaskCluster } from "@/lib/api/clusters"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const CLUSTER_COLORS = [
    "#ef4444", // red
    "#f97316", // orange
    "#f59e0b", // amber
    "#84cc16", // lime
    "#22c55e", // green
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#d946ef", // fuchsia
    "#ec4899", // pink
    "#64748b", // slate
]

interface ClusterSelectorProps {
    boardId: string
    clusters: TaskCluster[]
    selectedClusterId?: string | null
    onSelect: (clusterId: string | null) => void
    onClusterCreated?: (cluster: TaskCluster) => void
}

export function ClusterSelector({
    boardId,
    clusters,
    selectedClusterId,
    onSelect,
    onClusterCreated
}: ClusterSelectorProps) {
    const [open, setOpen] = useState(false)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [searchValue, setSearchValue] = useState("")
    const [newClusterName, setNewClusterName] = useState("")
    const [newClusterColor, setNewClusterColor] = useState(CLUSTER_COLORS[6]) // Default blue
    const [isCreating, setIsCreating] = useState(false)

    const selectedCluster = clusters.find((c) => c.id === selectedClusterId)

    const handleCreateCluster = async () => {
        if (!newClusterName.trim()) return

        setIsCreating(true)
        try {
            const newCluster = await createTaskCluster({
                board_id: boardId,
                name: newClusterName.trim(),
                color: newClusterColor
            })
            if (newCluster) {
                onClusterCreated?.(newCluster)
                onSelect(newCluster.id)
                setSearchValue("")
                setNewClusterName("")
                setOpen(false)
                setShowCreateDialog(false)
            }
        } catch (error) {
            console.error("Failed to create cluster", error)
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Cluster</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={newClusterName}
                                onChange={(e) => setNewClusterName(e.target.value)}
                                placeholder="Cluster name"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {CLUSTER_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        className={cn(
                                            "h-6 w-6 rounded-full transition-all hover:scale-110 focus:outline-none ring-2 ring-offset-2",
                                            newClusterColor === color ? "ring-primary" : "ring-transparent"
                                        )}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setNewClusterColor(color)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                        <Button onClick={handleCreateCluster} disabled={!newClusterName.trim() || isCreating}>
                            {isCreating ? "Creating..." : "Create Cluster"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        {selectedCluster ? (
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedCluster.color }} />
                                {selectedCluster.name}
                            </div>
                        ) : (
                            "Select cluster..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Search cluster..." value={searchValue} onValueChange={setSearchValue} />
                        <CommandList>
                            <CommandEmpty>
                                <div className="p-2">
                                    <p className="text-sm text-muted-foreground mb-2">No cluster found.</p>
                                    <Button
                                        size="sm"
                                        className="w-full justify-start gap-2"
                                        variant="secondary"
                                        onClick={handleCreateCluster}
                                        disabled={!searchValue.trim() || isCreating}
                                    >
                                        <Plus className="h-3 w-3" />
                                        Create "{searchValue}"
                                    </Button>
                                </div>
                            </CommandEmpty>
                            <CommandGroup heading="Clusters">
                                <CommandItem
                                    onSelect={() => {
                                        onSelect(null)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            !selectedClusterId ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    No Cluster
                                </CommandItem>
                                {clusters.map((cluster) => (
                                    <CommandItem
                                        key={cluster.id}
                                        value={cluster.name}
                                        onSelect={() => {
                                            onSelect(cluster.id)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedClusterId === cluster.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: cluster.color }} />
                                        {cluster.name}
                                    </CommandItem>
                                ))}
                                <CommandItem
                                    onSelect={() => {
                                        setNewClusterName(searchValue)
                                        setShowCreateDialog(true)
                                        setOpen(false)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create "{searchValue || "New Cluster"}"
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </>
    )
}
