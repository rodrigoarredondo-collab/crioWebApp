"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Layout } from "lucide-react"

export default function SignUpPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (email.split("@")[1] !== "criocore.com" && email.split("@")[1] !== "bwh.harvard.edu") {
      setError("Please use a valid CrioCore or BWH email.")
      setIsLoading(false)
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
          },
        },
      })
      if (error) throw error
      router.push("/auth/sign-up-success")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/" className="flex items-center">
            <Image src="/snowflake.png" width={55} height={55} alt="" />
            <span className="text-4xl font-bauhausm text-foreground" style={{letterSpacing: '7px'}}>criocore CRM</span>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create an account</CardTitle>
            <CardDescription>We're excited to work with you!</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp}>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@criocore.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/" className="text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
