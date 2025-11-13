import "@/styles/globals.css"

import type { Metadata, Viewport } from "next"
import { ReactNode } from "react"
import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Inter, JetBrains_Mono } from "next/font/google"

import SidebarWrapper from "@/components/layout/sidebar/sidebar-wrapper"
import HomeBackground from "@/components/layout/home-background"

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
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorBackground: "#050505",
          colorText: "#f4f4f5",
          borderRadius: "0.5rem",
        },
        elements: {
          card: "bg-[#050505] text-foreground shadow-2xl shadow-black/40",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton: "bg-muted/40 text-foreground border border-border",
          formButtonPrimary:
            "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
          footerActionLink: "text-primary hover:text-primary/80",
        },
      }}
    >
      <html lang="en" className="dark">
        <body
          className={`${inter.variable} ${jetBrainsMono.variable} bg-background text-foreground`}
        >
          <div className="relative flex h-screen bg-background">
            <HomeBackground />
            <SidebarWrapper />
            <main className="relative z-10 flex h-screen flex-1 flex-col overflow-x-hidden overflow-y-auto bg-transparent">
              {children}
            </main>
          </div>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  )
}
