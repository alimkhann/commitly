"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Eye, Filter, GitBranch, Search, Star, Users } from "lucide-react"
import { useAuth } from "@clerk/nextjs"

import { githubService } from "@/lib/services/github"
import { repoService } from "@/lib/services/repos"
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const slugFromFullName = (fullName: string) => fullName.replace("/", "-")

type DisplayUserRepo = {
  slug: string
  fullName: string
  description?: string | null
  language?: string | null
  status: "synced" | "unsynced" | "pending"
  progressPercent?: number
}

export default function SearchPage() {
  const {
    catalog,
    catalogLoading,
    catalogParams,
    refreshCatalog,
    refreshUserRepos,
    yourRepos,
    pending,
    syncRepo,
    clearPending,
  } = useRoadmapCatalog()
  const { isSignedIn, getToken } = useAuth()

  const [githubConnected, setGithubConnected] = useState(false)
  const [checkingGithub, setCheckingGithub] = useState(false)
  const [implementingRepo, setImplementingRepo] = useState<string | null>(null)

  const [query, setQuery] = useState(catalogParams.search ?? "")
  const [difficulty, setDifficulty] = useState<string>(catalogParams.difficulty ?? "")
  const [sort, setSort] = useState<string>(catalogParams.sort ?? "trending")
  const [languageFilter, setLanguageFilter] = useState((catalogParams.languages ?? []).join(", "))
  const [topicFilter, setTopicFilter] = useState((catalogParams.topics ?? []).join(", "))
  const [minRating, setMinRating] = useState(catalogParams.minRating ? String(catalogParams.minRating) : "")
  const [minViews, setMinViews] = useState(catalogParams.minViews ? String(catalogParams.minViews) : "")
  const [minSyncs, setMinSyncs] = useState(catalogParams.minSyncs ? String(catalogParams.minSyncs) : "")

  const showCatalog = catalog?.items ?? []
  const totalPublicCount = catalog?.total_count ?? showCatalog.length
  const currentPage = catalogParams.page ?? 1
  const totalPages = catalog?.total_pages ?? 1

  const yourRepoCards: DisplayUserRepo[] = useMemo(() => {
    const pendingCards: DisplayUserRepo[] = pending.map((entry) => ({
      slug: entry.slug,
      fullName: entry.fullName,
      status: "pending",
    }))
    const stateCards: DisplayUserRepo[] = yourRepos.map((repo) => ({
      slug: slugFromFullName(repo.repo.repo.full_name),
      fullName: repo.repo.repo.full_name,
      description: repo.repo.repo.description,
      language: repo.repo.repo.language,
      status: repo.status,
      progressPercent: repo.progress_percent,
    }))
    const merged = [...pendingCards, ...stateCards]
    const seen = new Set<string>()
    return merged.filter((item) => {
      if (seen.has(item.slug)) return false
      seen.add(item.slug)
      return true
    })
  }, [pending, yourRepos])

  const canImplement = isSignedIn && githubConnected && !checkingGithub

  useEffect(() => {
    let cancelled = false
    async function loadGithubStatus() {
      if (!isSignedIn) {
        setGithubConnected(false)
        return
      }
      setCheckingGithub(true)
      try {
        const token = (await getToken?.()) ?? undefined
        const response = await githubService.status(token)
        if (!cancelled) {
          setGithubConnected(Boolean(response.data?.connected))
        }
      } catch {
        if (!cancelled) {
          setGithubConnected(false)
        }
      } finally {
        if (!cancelled) {
          setCheckingGithub(false)
        }
      }
    }
    loadGithubStatus()
    return () => {
      cancelled = true
    }
  }, [getToken, isSignedIn])

  const parseNumber = (value: string) => {
    if (!value.trim()) return undefined
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  const handleApplyFilters = async () => {
    const languages = languageFilter
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
    const topics = topicFilter
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
    const ratingValue = parseNumber(minRating)
    const normalizedRating = ratingValue !== undefined ? Math.min(Math.max(ratingValue, 0), 5) : undefined
    const viewsValue = parseNumber(minViews)
    const syncsValue = parseNumber(minSyncs)

    await refreshCatalog({
      page: 1,
      search: query || undefined,
      difficulty: difficulty || undefined,
      sort,
      languages: languages.length ? languages : [],
      topics: topics.length ? topics : [],
      minRating: normalizedRating,
      minViews: viewsValue,
      minSyncs: syncsValue,
    })
  }

  const handleImplement = async (fullName: string) => {
    if (!canImplement) return
    setImplementingRepo(fullName)
    try {
      const identity = repoService.buildIdentityFromFullName(fullName)
      const token = (await getToken?.()) ?? undefined
      await syncRepo(identity, token)
      clearPending(fullName)
      await Promise.all([refreshUserRepos(), refreshCatalog()])
    } finally {
      setImplementingRepo(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-10 lg:px-16">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">
          Repo directory
        </p>
        <h1 className="text-3xl font-semibold">Search repositories</h1>
        <p className="text-base text-muted-foreground">
          Filter by difficulty, language, or keywords to jump into an existing timeline.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-xl shadow-black/25 backdrop-blur-lg">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="deepseek, ncnn, microsoft/vscode..."
              className="border-0 bg-transparent text-base focus-visible:ring-0"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["", "intro", "easy", "medium", "hard"] as const).map((level) => (
              <Button
                key={level || "all"}
                variant={difficulty === level ? "secondary" : "ghost"}
                className="capitalize"
                onClick={() => setDifficulty(level)}
              >
                {level || "all"}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="trending">Trending</option>
              <option value="most_viewed">Most viewed</option>
              <option value="most_synced">Most synced</option>
              <option value="highest_rated">Highest rated</option>
              <option value="newest">Newest</option>
            </select>
            <Button onClick={() => void handleApplyFilters()}>Apply</Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Languages</p>
            <Input
              value={languageFilter}
              placeholder="ts, rust"
              onChange={(event) => setLanguageFilter(event.target.value)}
            />
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Topics</p>
            <Input
              value={topicFilter}
              placeholder="ai, nextjs, langchain"
              onChange={(event) => setTopicFilter(event.target.value)}
            />
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Minimum rating</p>
            <Input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={minRating}
              onChange={(event) => setMinRating(event.target.value)}
              placeholder="e.g. 4"
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Minimum views</p>
            <Input
              type="number"
              min={0}
              value={minViews}
              onChange={(event) => setMinViews(event.target.value)}
              placeholder="100"
            />
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Minimum syncs</p>
            <Input
              type="number"
              min={0}
              value={minSyncs}
              onChange={(event) => setMinSyncs(event.target.value)}
              placeholder="5"
            />
          </div>
          <div className="flex items-end">
            {isSignedIn ? (
              checkingGithub ? (
                <p className="text-xs text-muted-foreground">Checking GitHub connection…</p>
              ) : !githubConnected ? (
                <p className="text-xs text-muted-foreground">
                  Connect GitHub in Settings → Connections to enable Implement buttons.
                </p>
              ) : null
            ) : (
              <p className="text-xs text-muted-foreground">Sign in to sync repositories you discover.</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Showing {totalPublicCount} public repositories
          {catalogLoading && <span className="text-xs">Refreshing…</span>}
        </div>
      </div>

      {!!yourRepoCards.length && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your repositories</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {yourRepoCards.map((repo) => (
              <Card
                key={repo.slug}
                className="flex flex-col border-border/60 bg-card/70 shadow-lg shadow-black/20"
              >
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl">{repo.fullName}</CardTitle>
                    <Badge
                      variant={repo.status === "synced" ? "accent" : repo.status === "pending" ? "secondary" : "outline"}
                      className="text-xs uppercase tracking-wide"
                    >
                      {repo.status === "pending" ? "Syncing" : repo.status === "synced" ? "Synced" : "Unsynced"}
                    </Badge>
                  </div>
                  {repo.description && <CardDescription>{repo.description}</CardDescription>}
                </CardHeader>
                <CardContent className="mt-auto space-y-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    <span>{repo.language ?? "Unknown"}</span>
                  </div>
                  {repo.status === "synced" && (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Progress</span>
                        <span>{repo.progressPercent ?? 0}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${repo.progressPercent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {repo.status === "pending" && (
                    <p className="text-xs text-muted-foreground">Generating timeline…</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button className="flex-1" variant="secondary" asChild>
                      <Link href={`/repo/${repo.slug}/timeline`}>Open timeline</Link>
                    </Button>
                    {repo.status === "unsynced" && canImplement && (
                      <Button
                        className="flex-1"
                        disabled={implementingRepo === repo.fullName}
                        onClick={() => void handleImplement(repo.fullName)}
                      >
                        {implementingRepo === repo.fullName ? "Syncing…" : "Implement"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Public repositories</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => void refreshCatalog({ page: currentPage - 1 })}
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={Boolean(totalPages === 0 || currentPage >= totalPages)}
                onClick={() => void refreshCatalog({ page: currentPage + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {showCatalog.map((repo) => (
            <Card
              key={repo.repo.full_name}
              className="flex flex-col border-border/60 bg-card/70 shadow-lg shadow-black/20"
            >
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xl">{repo.repo.full_name}</CardTitle>
                  <Badge variant="outline" className="text-xs uppercase tracking-wide">
                    {repo.stats.difficulty ?? "unknown"}
                  </Badge>
                </div>
                {repo.repo.description && <CardDescription>{repo.repo.description}</CardDescription>}
              </CardHeader>
              <CardContent className="mt-auto space-y-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  <span>
                    {repo.repo.language ?? repo.stats.primary_language ?? "Unknown"} • {repo.stats.star_count} stars
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(repo.stats.languages.length ? repo.stats.languages : repo.repo.language ? [repo.repo.language] : [])
                    .slice(0, 3)
                    .map((lang) => (
                      <span
                        key={lang}
                        className="rounded-full bg-muted/40 px-3 py-1 text-muted-foreground"
                      >
                        {lang}
                      </span>
                    ))}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {repo.stats.average_rating !== null && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" />
                      {repo.stats.average_rating?.toFixed(1)} ({repo.stats.rating_count})
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {repo.stats.view_count.toLocaleString()} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {repo.stats.sync_count.toLocaleString()} syncs
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {canImplement && (
                    <Button
                      disabled={implementingRepo === repo.repo.full_name}
                      onClick={() => void handleImplement(repo.repo.full_name)}
                    >
                      {implementingRepo === repo.repo.full_name ? "Syncing…" : "Implement"}
                    </Button>
                  )}
                  <Button className="w-full" variant="secondary" asChild>
                    <Link href={repoService.buildTimelinePath(repo.repo.full_name)}>Open timeline</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
