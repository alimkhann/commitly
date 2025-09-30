import './globals.css'
import "@fontsource/teachers"
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Sidebar from './components/Sidebar'

export const metadata: Metadata = {
  title: 'Commitly - The AI Code Tutor',
  description: 'Paste a GitHub repo link, and let AI guide you to build the project you want.',
  icons: [{ rel: 'icon', url: '/icons/icon_05x.png' }]
}

export const viewport = {
  width: 'device-width',
  initialScale: 0.9,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-black text-white" style={{ fontFamily: 'Teachers' }}>
        <div className="bg-black relative size-full min-h-screen">
          <div className="flex h-screen">
            <Sidebar />
            <div className="flex-1 h-full overflow-y-auto">
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
