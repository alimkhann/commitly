import "@/styles/globals.css"

import type { Metadata, Viewport } from "next"
import { ReactNode } from "react"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Inter, JetBrains_Mono } from "next/font/google"

import SidebarWrapper from "./components/SidebarWrapper"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "commitly",
    template: "%s · commitly",
  },
  description:
    "commitly turns a GitHub repo into a structured learning path with hands-on tasks, pragmatic hints, and context-aware guidance.",
  icons: [{ rel: "icon", url: "/icons/icon_05x.png" }],
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} bg-background text-foreground`}
      >
        <div className="relative flex h-screen bg-background">
          <SidebarWrapper />
          <main className="relative flex h-screen flex-1 flex-col overflow-x-hidden overflow-y-auto bg-gradient-to-b from-background to-[hsl(240,9%,6%)]">
            {children}
          </main>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
