"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Filter, GitBranch, Search } from "lucide-react"

import { repoService, type RoadmapResponseBody } from "@/lib/services/repos"
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
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider"

const mapStaticRecordToRoadmap = (record: RepoRecord): RoadmapResponseBody => {
  const numericStars = Number.parseInt(record.stars.replace(/[^0-9]/g, ""), 10)
  return {
    repo: {
      full_name: record.name,
      description: record.description,
      language: record.language,
      stars: Number.isNaN(numericStars) ? 0 : numericStars,
      default_branch: "main",
      html_url: undefined,
      owner_avatar_url: undefined,
    },
    timeline: record.timeline,
    cached: true,
    generated_at: new Date().toISOString(),
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [difficulty, setDifficulty] = useState<"all" | "beginner" | "intermediate" | "advanced">("all")
  const repoList = useMemo(() => repoService.list(), [])
  const { synced, yourRepos, loading } = useRoadmapCatalog()
  const [publicRepos, setPublicRepos] = useState<RoadmapResponseBody[]>([])
  const [publicMeta, setPublicMeta] = useState<{ total_count: number; page: number; total_pages: number } | null>(null)
  const [publicLoading, setPublicLoading] = useState(false)
  const [publicError, setPublicError] = useState<string | null>(null)

  const backendConfigured = repoService.isBackendConfigured()

  useEffect(() => {
    if (!backendConfigured) return
    let cancelled = false
    const load = async () => {
      setPublicLoading(true)
      const response = await repoService.listCatalog(1, 50)
      if (cancelled) return
      if (response.ok && response.data) {
        setPublicRepos(response.data.items)
        setPublicMeta({
          total_count: response.data.total_count,
          page: response.data.page,
          total_pages: response.data.total_pages,
        })
        setPublicError(null)
      } else {
        setPublicError(response.error ?? "Unable to load public catalog.")
      }
      setPublicLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [backendConfigured])

  const syncedMap = useMemo(() => new Map(synced.map((repo) => [repo.repo.full_name, repo])), [synced])

  const nowIso = useMemo(() => new Date().toISOString(), [])

  const userRepoList = useMemo(
    () =>
      yourRepos
        .filter((repo) => !repo.is_archived && repo.repo)
        .map((repo) => {
          const identity = repoService.buildIdentityFromFullName(repo.repo_full_name)
          return { ...repo, repo: repo.repo!, slug: identity.slug }
        }),
    [yourRepos]
  )

  const syncedMatches = useMemo(() => {
    if (!query.trim()) return userRepoList
    const lower = query.toLowerCase()
    return userRepoList.filter((repo) => {
      const summary = repo.repo.description?.toLowerCase() ?? ""
      return (
        repo.repo.full_name.toLowerCase().includes(lower) ||
        summary.includes(lower)
      )
    })
  }, [userRepoList, query])

  const filteredRepos = useMemo(() => {
    return repoList.filter((repo) => {
      const matchesQuery =
        repo.name.toLowerCase().includes(query.toLowerCase()) ||
        repo.description.toLowerCase().includes(query.toLowerCase())
      const matchesDifficulty =
        difficulty === "all" || repo.difficulty === difficulty
      return matchesQuery && matchesDifficulty
    })
  }, [query, difficulty, repoList])

  const publicRepoList = useMemo(() => {
    if (!backendConfigured) {
      return filteredRepos.map(mapStaticRecordToRoadmap)
    }
    return publicRepos
  }, [backendConfigured, filteredRepos, publicRepos])

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

      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-xl shadow-black/25 backdrop-blur-lg">
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
          <div className="flex gap-2">
            {(["all", "beginner", "intermediate", "advanced"] as const).map(
              (level) => (
                <Button
                  key={level}
                  variant={difficulty === level ? "secondary" : "ghost"}
                  className="capitalize"
                  onClick={() => setDifficulty(level)}
                >
                  {level}
                </Button>
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Showing {filteredRepos.length} public repositories
        </div>
      </div>

      {!!syncedMatches.length && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your repositories</h2>
            {loading && <p className="text-xs text-muted-foreground">Refreshing…</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {syncedMatches.map((repo) => (
              <Card
                key={repo.slug}
                className="flex flex-col border-border/60 bg-card/70 shadow-lg shadow-black/20"
              >
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl">{repo.repo.full_name}</CardTitle>
                    <Badge variant="outline" className="text-xs uppercase tracking-wide">
                      {(syncedMap.get(repo.repo_full_name)?.timeline.length ?? 0)} stages
                    </Badge>
                  </div>
                  <CardDescription>{repo.repo.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    <span>
                      {repo.repo.language ?? "Unknown"} •
                      {" "}
                      {new Date(
                        syncedMap.get(repo.repo_full_name)?.generated_at ?? nowIso
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <Button className="w-full" variant="secondary" asChild>
                    <Link href={`/repo/${repo.slug}/timeline`}>Open timeline</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Public repositories</h2>
          {publicLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {publicMeta && (
            <p className="text-xs text-muted-foreground">
              Page {publicMeta.page} of {publicMeta.total_pages} • {publicMeta.total_count} total
            </p>
          )}
        </div>
        {publicError && (
          <p className="text-sm text-destructive">{publicError}</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {publicRepoList.map((repo) => {
            const identity = repoService.buildIdentityFromFullName(repo.repo.full_name)
            return (
              <Card
                key={identity.slug}
                className="flex flex-col border-border/60 bg-card/70 shadow-lg shadow-black/20"
              >
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl">{repo.repo.full_name}</CardTitle>
                    <Badge variant="outline" className="text-xs uppercase tracking-wide">
                      {repo.timeline.length} stages
                    </Badge>
                  </div>
                  <CardDescription>{repo.repo.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    <span>
                      {repo.repo.language ?? repo.repo.primary_language ?? "Unknown"}
                      {repo.repo.star_count ? ` • ${repo.repo.star_count}★` : ""}
                    </span>
                  </div>
                  <Button className="w-full" variant="secondary" asChild>
                    <Link href={`/repo/${identity.slug}/timeline`}>Open timeline</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
