import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { Layout, AlertCircle } from "lucide-react"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {params?.error ? (
              <p className="text-sm text-muted-foreground">Error: {params.error}</p>
            ) : (
              <p className="text-sm text-muted-foreground">An unspecified error occurred during authentication.</p>
            )}
            <Link href="/">
              <Button className="mt-6 w-full">Try again</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
