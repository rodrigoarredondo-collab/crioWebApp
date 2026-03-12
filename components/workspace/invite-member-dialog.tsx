"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus, Loader2, CheckCircle2, XCircle, Trash2, User } from "lucide-react"
import { type WorkspaceMember } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface InviteMemberDialogProps {
  workspaceId: string
  onMemberAdded?: () => void
  currentMembers?: WorkspaceMember[]
}

export function InviteMemberDialog({ workspaceId, onMemberAdded, currentMembers = [] }: InviteMemberDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleInvite = async () => {
    if (!email.trim()) return

    setIsLoading(true)
    setResult(null)

    const supabase = createClient()

    try {
      // First, find the user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("email", email.trim().toLowerCase())
        .single()

      if (profileError || !profile) {
        setResult({
          success: false,
          message: "User not found. They must sign up first before being added to a workspace.",
        })
        setIsLoading(false)
        return
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", profile.id)
        .single()

      if (existingMember) {
        setResult({
          success: false,
          message: "This user is already a member of this workspace.",
        })
        setIsLoading(false)
        return
      }

      // Add user to workspace
      const { error: memberError } = await supabase.from("workspace_members").insert({
        workspace_id: workspaceId,
        user_id: profile.id,
        role,
      })

      if (memberError) {
        throw memberError
      }

      setResult({
        success: true,
        message: `${profile.full_name || profile.email} has been added to the workspace as ${role}.`,
      })
      setEmail("")
      setRole("member")
      onMemberAdded?.()

      // Close dialog after 2 seconds on success
      setTimeout(() => {
        setResult(null)
      }, 2000)
    } catch (error) {
      console.error("Error inviting member:", error)
      setResult({
        success: false,
        message: "Failed to add member. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return

    const supabase = createClient()
    try {
      const { error } = await supabase.from("workspace_members").delete().eq("id", memberId)
      if (error) throw error
      onMemberAdded?.() // Refresh list
    } catch (error) {
      console.error("Error removing member:", error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <UserPlus className="h-4 w-4" />
          Manage Members
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Team</DialogTitle>
          <DialogDescription>
            Invite new members or manage existing ones.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Invite New Member</h3>
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInvite()
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <div className="flex gap-2">
                <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInvite} disabled={isLoading || !email.trim()} className="flex-1">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
                </Button>
              </div>
            </div>

            {result && (
              <div
                className={`flex items-start gap-2 p-3 rounded-lg ${result.success ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
                  }`}
              >
                {result.success ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <XCircle className="h-4 w-4 mt-0.5" />}
                <span className="text-sm">{result.message}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Current Members ({currentMembers.length})</h3>
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
              {currentMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No members found.</p>
              ) : (
                currentMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-lg border bg-card/50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profiles?.avatar_url || ""} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {member.profiles?.full_name || member.profiles?.email || "Unknown User"}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                      </div>
                    </div>
                    {member.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
