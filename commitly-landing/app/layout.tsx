import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { GeistSans as GeistSans } from 'geist/font/sans'

export const metadata: Metadata = {
  title: 'Commitly - The AI Code Tutor',
  description: 'Paste a GitHub repo link, and let AI guide you to build the project you want. Join the waitlist for early access.',
  icons: [{ rel: 'icon', url: '/icon.png' }],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${GeistSans.className} antialiased bg-black text-white`}>
        {children}
      </body>
    </html>
  )
}
