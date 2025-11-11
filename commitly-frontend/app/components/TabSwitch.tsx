"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

type TabSwitchProps = {
  repoId: string
}

export default function TabSwitch({ repoId }: TabSwitchProps) {
  const pathname = usePathname() || ""

  const tabs = [
    { label: "Timeline", href: `/repo/${repoId}/timeline` },
    { label: "Guide", href: `/repo/${repoId}/guide` },
  ]

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card/60 p-1 text-sm shadow-lg shadow-black/20 backdrop-blur">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-full px-6 py-2 font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
