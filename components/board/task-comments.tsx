"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, Send, Loader2 } from "lucide-react"
import type { TaskComment, Profile } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"

interface TaskCommentsProps {
    taskId: string
    currentUserId: string
}

export function TaskComments({ taskId, currentUserId }: TaskCommentsProps) {
    const [comments, setComments] = useState<(TaskComment & { profile: Profile })[]>([])
    const [newComment, setNewComment] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [isSending, setIsSending] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        fetchComments()
    }, [taskId])

    const fetchComments = async () => {
        setIsLoading(true)
        const { data, error } = await supabase
            .from("task_comments")
            .select("*, profile:profiles(*)")
            .eq("task_id", taskId)
            .order("created_at", { ascending: true })

        if (error) {
            console.error("Error fetching comments:", error)
            setComments([])
        } else {
            setComments(data || [])
        }
        setIsLoading(false)
    }

    const handleAddComment = async () => {
        if (!newComment.trim()) return

        setIsSending(true)
        const { data, error } = await supabase
            .from("task_comments")
            .insert({
                task_id: taskId,
                user_id: currentUserId,
                content: newComment.trim(),
            })
            .select("*, profile:profiles(*)")
            .single()

        if (error) {
            console.error("Error adding comment:", error)
        } else {
            setComments([...comments, data])
            setNewComment("")
        }
        setIsSending(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleAddComment()
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments.length})
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                    {comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No comments yet. Be the first to add one!
                        </p>
                    ) : (
                        comments.map((comment) => {
                            const initials = comment.profile?.full_name
                                ? comment.profile.full_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                : comment.profile?.email?.[0].toUpperCase() || "U"

                            return (
                                <div key={comment.id} className="flex gap-3 group">
                                    <Avatar className="h-8 w-8 shrink-0">
                                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">
                                                {comment.profile?.full_name || comment.profile?.email || "Unknown"}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        {comment.link ? (
                                            <a
                                                href={comment.content.startsWith('http') ? comment.content : `https://${comment.content}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-primary hover:underline break-all"
                                            >
                                                {comment.content}
                                            </a>
                                        ) : (
                                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                                                {comment.content}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}

            {/* Add comment */}
            <div className="flex gap-2">
                <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[60px] resize-none"
                    disabled={isSending}
                />
                <Button
                    size="icon"
                    onClick={handleAddComment}
                    disabled={isSending || !newComment.trim()}
                    className="shrink-0"
                >
                    {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </div>
    )
}
