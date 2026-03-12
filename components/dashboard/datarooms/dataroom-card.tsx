"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, LinkIcon, ArrowRight } from "lucide-react"

interface DataroomCardProps {
    room: {
        id: string
        name: string
        description?: string | null
        file_count: number
        active_links: number
        created_at: string
    }
}

export function DataroomCard({ room }: DataroomCardProps) {
    return (
        <Link href={`/dashboard/datarooms/${room.id}`} className="group block">
            <Card className="transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer h-full">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-1">
                            {room.name}
                        </CardTitle>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                    </div>
                    {room.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {room.description}
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            <span>{room.file_count} {room.file_count === 1 ? "file" : "files"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <LinkIcon className="h-3.5 w-3.5" />
                            <span>{room.active_links} active {room.active_links === 1 ? "link" : "links"}</span>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-3">
                        Created {new Date(room.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                </CardContent>
            </Card>
        </Link>
    )
}
