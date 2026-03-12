"use client"

import type { User } from "@supabase/supabase-js"
import type { Profile } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Layout, Folder, MessageSquare, DollarSign, Settings, LogOut, ChevronDown, ChevronRight, ChevronLeft, Building2, TrendingUp, BarChart3, Database, Lock } from "lucide-react"
import Image from "next/image"
import { SnowEffect } from "@/components/ui/snow-effect"
import { useState, useEffect } from "react"

interface SidebarProps {
  user: User
  profile: Profile | null
  isMobile: boolean
}

export function Sidebar({ user, profile, isMobile }: SidebarProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const initials = profile?.full_name
    ? profile.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
    : user.email?.[0].toUpperCase() || "U"

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`
          fixed flex flex-col md:relative
          top-0 left-0 z-50
          h-full w-64
          border-r border-border bg-card overflow-hidden
          transform transition-transform duration-300 ease-in-out
          -translate-x-full md:translate-x-0
          ${isOpen ? "translate-x-0" : ""}
        `}
      >
        {/* <aside
        className={`
          flex h-full flex-col border-r border-border bg-card overflow-hidden
          ${isMobile
            ? `absolute top-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
            }`
            : 'relative sm:w-0 md:w-64'
          }
        `}
      > */}
        {/* Logo */}
        <div className="relative flex h-16 items-center border-b border-border px-4 bg-black">
          <SnowEffect />
          <Image src="/snowflake.png" className="z-[1]" height={55} width={55} alt="" />
          <span className="z-[1] font-bauhausm text-3xl text-white" style={{ letterSpacing: '7px' }}>criocore</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Folder className="h-4 w-4" />
              Projects
            </Button>
          </Link>
          <Link href="/dashboard/prospects">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Building2 className="h-4 w-4" />
              Prospect companies
            </Button>
          </Link>
          <Link href="/dashboard/investors">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <TrendingUp className="h-4 w-4" />
              Investors
            </Button>
          </Link>
          <Link href="/dashboard/figure-maker">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <BarChart3 className="h-4 w-4" />
              Figure Maker
            </Button>
          </Link>
          <Link href="/dashboard/data">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Database className="h-4 w-4" />
              Data
            </Button>
          </Link>
          <Link href="/dashboard/datarooms">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Lock className="h-4 w-4" />
              Datarooms
            </Button>
          </Link>
          {user.email?.endsWith("@criocore.com") && (
            <>
              <Link href="/dashboard/financial">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial
                </Button>
              </Link>
              <Link href="/dashboard/cria">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Cria
                </Button>
              </Link>
            </>
          )}
        </nav>

        {/* User menu */}
        <div className="border-t border-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="text-left overflow-hidden">
                    <p className="text-sm font-medium text-card-foreground">{profile?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[120px]">{user.email}</p>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Close button (mobile only) - positioned at the right edge inside sidebar */}
        {isMobile && (
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-1/2 -translate-y-1/2 right-2 bg-card border border-border rounded-full p-2 shadow-lg hover:bg-accent transition-colors z-10"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </aside>

      {/* Toggle button (mobile only) - stays visible when sidebar is closed */}
      <button
        className="
          fixed top-1/2 -translate-y-1/2 left-[-3%] z-40
          bg-card border border-border rounded-full p-2 shadow-lg
          hover:bg-accent transition-colors
          md:hidden
        "
        onClick={() => setIsOpen(true)}
        aria-label="Open sidebar"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      {/* {isMobile && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-1/2 -translate-y-1/2 left-[-3%] z-40 bg-card border border-border rounded-full p-2 shadow-lg hover:bg-accent transition-colors"
          aria-label="Open sidebar"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )} */}

      {/* Overlay (mobile only) - to close sidebar when clicking outside */}
      {isMobile && isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          aria-label="Close sidebar overlay"
        />
      )}
    </>
  )
}
