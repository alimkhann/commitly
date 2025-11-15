"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { ChevronLeft, Hammer, Search } from "lucide-react"
import { useAuth } from "@clerk/nextjs"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

import AccountSection from "./account-section"
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider"

export default function Sidebar() {
  const pathname = usePathname()
  const { isSignedIn } = useAuth()
  const { synced, pending, loading } = useRoadmapCatalog()
  const [collapsed, setCollapsed] = useState(false)
  const toggleCollapse = () => setCollapsed((prev) => !prev)

  const activeRepoId = useMemo(() => {
    if (!pathname) return null
    const segments = pathname.split("/")
    return segments[1] === "repo" ? segments[2] ?? null : null
  }, [pathname])

  return (
    <div
      className={cn(
        "flex h-screen flex-col overflow-y-auto border border-white/10 bg-card/25 backdrop-blur-2xl",
        collapsed ? "w-[96px]" : "w-[320px]"
      )}
    >
      <div className="flex flex-1 flex-col gap-6 p-4">
        <div
          className={cn(
            "flex items-center justify-between",
            collapsed && "flex-col gap-3"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              className="group relative flex h-14 w-14 items-center justify-center rounded-xl transition-colors hover:bg-muted/30"
              aria-label="Home"
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false)
                } else {
                  window.location.href = "/"
                }
              }}
            >
              <div className="relative h-16 w-16">
                <Image
                  src="/logos/logo_4x.png"
                  alt="commitly"
                  fill
                  className={cn(
                    "rounded-lg object-contain transition-opacity duration-150",
                    collapsed && "group-hover:opacity-0"
                  )}
                />
              </div>
              {collapsed && (
                <ChevronLeft className="absolute h-4 w-4 rotate-180 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              )}
            </button>
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={toggleCollapse}
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Button
            size="lg"
            className={cn(
              "h-14 w-full justify-start gap-3 rounded-xl border border-white/10 bg-white/10 text-base text-white transition-colors hover:bg-white/15",
              collapsed && "justify-center px-0"
            )}
            asChild
          >
            <Link href="/">
              <Hammer className={cn("h-5 w-5", collapsed && "h-6 w-6")} />
              {!collapsed && <span>New repo timeline</span>}
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className={cn(
              "h-14 w-full justify-start gap-3 rounded-xl border border-white/5 bg-white/5 text-base text-white/90 transition-colors hover:bg-white/10",
              collapsed && "justify-center px-0"
            )}
            asChild
          >
            <Link href="/search">
              <Search className={cn("h-5 w-5", collapsed && "h-6 w-6")} />
              {!collapsed && <span>Search repos</span>}
            </Link>
          </Button>
        </div>

        {!collapsed && isSignedIn && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Synced repos
              </p>
              {loading && (
                <Badge variant="outline" className="font-normal text-[11px]">
                  Loading…
                </Badge>
              )}
            </div>
            <ScrollArea className="h-full max-h-[45vh]">
              <div className="flex flex-col gap-2 pr-3">
                {pending.length + synced.length === 0 && !loading ? (
                  <div className="rounded-xl border border-border/50 bg-card/10 px-4 py-6 text-sm text-muted-foreground">
                    Generate a roadmap to pin it here.
                  </div>
                ) : (
                  [...pending, ...synced].map((repo) => {
                    const slug = repo.slug
                    const isActive = activeRepoId === slug
                    const href = `/repo/${slug}/timeline`
                    const isPending = Boolean((repo as { pending?: boolean }).pending)
                    const isSyncedRepo = "timeline" in repo
                    const language = isSyncedRepo ? repo.repo.language : null
                    const description = isSyncedRepo ? repo.repo.description : null
                    const generatedAt = isSyncedRepo ? repo.generated_at : null
                    const stageCount = isSyncedRepo ? repo.timeline.length : 0
                    return (
                      <Link
                        key={slug}
                        href={href}
                        className={cn(
                          "group rounded-xl border border-white/5 bg-card/15 px-3 py-3 transition-colors backdrop-blur-sm",
                          isActive
                            ? "border-primary/70 bg-primary/15"
                            : "hover:border-white/10 hover:bg-card/25"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium leading-tight">
                              {"repo" in repo ? repo.repo.full_name : repo.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isPending
                                ? "Generating timeline…"
                                : [language, generatedAt && new Date(generatedAt).toLocaleDateString()]
                                    .filter(Boolean)
                                    .join(" • ")}
                            </p>
                          </div>
                          <Badge
                            variant={isActive ? "accent" : "secondary"}
                            className="text-[11px] capitalize"
                          >
                            {isPending ? "Syncing" : `${stageCount} stages`}
                          </Badge>
                        </div>
                        {!isPending && description && (
                          <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                            {description}
                          </p>
                        )}
                      </Link>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
      <AccountSection isCollapsed={collapsed} />
    </div>
  )
}
