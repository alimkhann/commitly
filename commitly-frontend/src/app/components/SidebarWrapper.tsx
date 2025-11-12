"use client"

import { usePathname } from "next/navigation"

import Sidebar from "./Sidebar"

const HIDE_SIDEBAR_PREFIXES = [
  "/help-center",
  "/release-notes",
  "/policies",
  "/plans",
]

export default function SidebarWrapper() {
  const pathname = usePathname() || "/"
  const shouldHide = HIDE_SIDEBAR_PREFIXES.some((p) => pathname.startsWith(p))

  if (shouldHide) return null

  return (
    <aside className="sticky top-0 flex h-screen shrink-0 border-r border-border bg-card/40 backdrop-blur">
      <Sidebar />
    </aside>
  )
}
