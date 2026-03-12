"use client"

import { useEffect, useState, useCallback } from "react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { CreateDataroomDialog } from "@/components/dashboard/datarooms/create-dataroom-dialog"
import { DataroomCard } from "@/components/dashboard/datarooms/dataroom-card"
import { Lock, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type Room = {
    id: string
    name: string
    description: string | null
    file_count: number
    active_links: number
    created_at: string
}

export default function DataroomsPage() {
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        async function init() {
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error || !user) {
                router.push("/auth/login")
                return
            }
            setUser(user)

            const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single()
            setProfile(prof)

            await fetchRooms()
        }
        init()
    }, [])

    const fetchRooms = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/datarooms")
            if (res.ok) {
                const data = await res.json()
                setRooms(data)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [])

    const handleCreated = (room: any) => {
        setRooms((prev) => [{ ...room, file_count: 0, active_links: 0 }, ...prev])
    }

    if (!user) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <DashboardShell user={user} profile={profile}>
            <div className="p-6 md:p-10 w-full space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                            <Lock className="h-8 w-8 text-primary" />
                            Data Rooms
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Securely share files and grant access to selected resources.
                        </p>
                    </div>
                    <CreateDataroomDialog onCreated={handleCreated} />
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <Lock className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No data rooms yet</h3>
                        <p className="text-muted-foreground mt-1 max-w-sm">
                            Create your first data room to start sharing files and granting access to your resources.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {rooms.map((room) => (
                            <DataroomCard key={room.id} room={room} />
                        ))}
                    </div>
                )}
            </div>
        </DashboardShell>
    )
}
