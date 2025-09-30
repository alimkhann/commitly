import './globals.css'
import "@fontsource/teachers"
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import SidebarWrapper from './components/SidebarWrapper'

export const metadata: Metadata = {
  title: 'commitly',
  description: 'commitly turns a GitHub repo into a structured learning path, with hands-on tasks and tiny hints so you learn by building.',
  icons: [{ rel: 'icon', url: '/icons/icon_05x.png' }]
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-black text-white" style={{ fontFamily: 'Teachers' }}>
        <div className="bg-black relative size-full min-h-screen">
          <div className="flex h-screen">
            <SidebarWrapper />
            <div className="flex-1">
              {children}
            </div>
          </div>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
