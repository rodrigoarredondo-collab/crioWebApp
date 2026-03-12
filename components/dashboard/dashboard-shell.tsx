"use client"

import type React from "react"
import type { User } from "@supabase/supabase-js"
import type { Profile } from "@/lib/types"
import { useEffect, useState } from "react"
import { Sidebar } from "./sidebar"

interface DashboardShellProps {
  children: React.ReactNode
  user: User
  profile: Profile | null
}

export function DashboardShell({ children, user, profile }: DashboardShellProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Check on mount
    checkMobile()

    // Listen for window resize to handle orientation changes
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} profile={profile} isMobile={isMobile} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
