import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { bauhausm } from '@/components/ui/fonts';
import { SnowEffect } from "@/components/ui/snow-effect"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CrioCore",
  description: "High-Throughput Drug-Testing Platform",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/snowflake.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/snowflake.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/snowflake.png",
        type: "image/svg+xml",
      },
    ],
    apple: "/snowflake.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${bauhausm.variable}`}>
      <body className={`font-sans antialiased`}>
        {/* <SnowEffect /> */}
        {children}
        <Analytics />
      </body>
    </html>
  )
}
