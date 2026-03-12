import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Layout, Mail } from "lucide-react"
import Image from "next/image"

export default function SignUpSuccessPage() {
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
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>We&apos;ve sent you a confirmation link</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Please check your email and click the confirmation link to activate your account. Then you can sign in and
              start using CrioCore.
            </p>
            <Link href="/">
              <Button variant="outline" className="mt-6 w-full bg-transparent">
                Back to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
