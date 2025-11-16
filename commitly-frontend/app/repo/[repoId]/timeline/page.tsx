"use client"

import { JSX, useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Star } from "lucide-react"

import { repoService, type RepoIdentity, type RepoTimelineStage, type RoadmapResponseBody, type UserRepoState } from "@/lib/services/repos"
import { githubService } from "@/lib/services/github"
import { cn } from "@/lib/utils"
import { useAuth } from "@clerk/nextjs"

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import TabSwitch from "@/components/navigation/tab-switch"

import { CheckCircle2, CircleDotDashed, Clock3, RefreshCcw } from "lucide-react"

export default function RepoTimelinePage() {
  const params = useParams<{ repoId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const auth = useAuth()
  const isSignedIn = Boolean(auth.isSignedIn)
  const getToken = auth.getToken
  const {
    getRepoBySlug,
    markPending,
    clearPending,
    syncRepo,
    desyncRepo,
    archiveRepo,
    refreshUserRepos,
    refreshCatalog,
  } = useRoadmapCatalog()
  const repoId = params.repoId
  const shouldGenerate = searchParams?.get("intent") === "generate"
  const catalogRecord = !shouldGenerate ? getRepoBySlug(repoId) : undefined
  const fullNameParam = searchParams?.get("fullName") ?? null
  const repoUrlParam = searchParams?.get("repoUrl") ?? null
  const queryIdentity = useMemo(
    () =>
      repoService.parseRepoInput(fullNameParam ?? "") ??
      repoService.parseRepoInput(repoUrlParam ?? ""),
    [fullNameParam, repoUrlParam]
  )
  const identity: RepoIdentity | null = useMemo(() => {
    if (shouldGenerate && queryIdentity) {
      return queryIdentity
    }
    if (catalogRecord && "repo" in catalogRecord) {
      const state = catalogRecord as UserRepoState
      return repoService.buildIdentityFromFullName(state.repo.repo.full_name)
    }
    return queryIdentity
  }, [catalogRecord, queryIdentity, shouldGenerate])

  const [roadmap, setRoadmap] = useState<RoadmapResponseBody | null>(null)
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "error">(
    roadmap ? "idle" : "loading"
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [githubConnected, setGithubConnected] = useState(false)
  const [ratingState, setRatingState] = useState<{ rating: number | null; average: number | null; count: number }>({
    rating: null,
    average: null,
    count: 0,
  })

  const repoState = useMemo<UserRepoState | null>(() => {
    if (!catalogRecord || "pending" in catalogRecord) return null
    return catalogRecord as UserRepoState
  }, [catalogRecord])
  const isPendingRecord = Boolean(catalogRecord && "pending" in catalogRecord)
  const status: "synced" | "unsynced" | "pending" = useMemo(() => {
    if (isPendingRecord) return "pending"
    if (repoState) return repoState.status
    return shouldGenerate ? "pending" : "unsynced"
  }, [isPendingRecord, repoState, shouldGenerate])

  const handlePendingCleanup = useCallback(() => {
    if (identity) {
      clearPending(identity.fullName)
    }
  }, [clearPending, identity])

  useEffect(() => {
    let cancelled = false
    async function checkGithub() {
      if (!isSignedIn) {
        setGithubConnected(false)
        return
      }
      try {
        const token = (await getToken?.()) ?? undefined
        const response = await githubService.status(token)
        if (!cancelled) {
          setGithubConnected(Boolean(response.data?.connected))
        }
      } catch {
        if (!cancelled) setGithubConnected(false)
      }
    }
    checkGithub()
    return () => {
      cancelled = true
    }
  }, [getToken, isSignedIn])

  useEffect(() => {
    if (shouldGenerate && identity) {
      markPending(identity)
    }
  }, [identity, markPending, shouldGenerate])

  useEffect(() => {
    if (!identity || roadmap || isGenerating || shouldGenerate) return
    let cancelled = false
    const fetchCached = async () => {
      setFetchState("loading")
      const response = await repoService.getCachedRoadmap(identity.owner, identity.repoName)
      if (cancelled) return
      if (response.ok && response.data) {
        setRoadmap(response.data)
        setError(null)
        setFetchState("idle")
        handlePendingCleanup()
      } else if (!response.ok) {
        setError(response.error ?? "Unable to load roadmap.")
        setFetchState("error")
      }
    }
    fetchCached()
    return () => {
      cancelled = true
    }
  }, [handlePendingCleanup, identity, isGenerating, roadmap, shouldGenerate])

  const retryLoad = useCallback(async () => {
    if (!identity) return
    setFetchState("loading")
    const response = await repoService.getCachedRoadmap(identity.owner, identity.repoName)
    if (response.ok && response.data) {
      setRoadmap(response.data)
      setError(null)
      setFetchState("idle")
      handlePendingCleanup()
    } else if (!response.ok) {
      setError(response.error ?? "Unable to load roadmap.")
      setFetchState("error")
    }
  }, [handlePendingCleanup, identity])

  useEffect(() => {
    let cancelled = false
    if (!shouldGenerate || !repoUrlParam || !identity || !isSignedIn) {
      return
    }

    const repoUrl = repoUrlParam

    async function runGeneration() {
      setIsGenerating(true)
      setError(null)
      const token = await getToken?.()
      const response = await repoService.generateRoadmap(repoUrl, token ?? undefined, {
        forceRefresh: true,
      })
      if (cancelled) return
      setIsGenerating(false)
      if (response.ok && response.data) {
        setRoadmap(response.data)
        setFetchState("idle")
        handlePendingCleanup()
        void refreshUserRepos()
        router.replace(`/repo/${repoId}/timeline`)
      } else {
        setError(response.error ?? "Unable to generate roadmap.")
        setFetchState("error")
      }
    }

    runGeneration()

    return () => {
      cancelled = true
    }
  }, [
    shouldGenerate,
    repoUrlParam,
    identity,
    isSignedIn,
    getToken,
    handlePendingCleanup,
    refreshUserRepos,
    repoId,
    router,
  ])

  const activeRoadmap = roadmap

  const timelineStages = useMemo(() => {
    if (!activeRoadmap) return []
    return activeRoadmap.timeline.map((stage) => ({
      ...stage,
      status: (isSignedIn ? stage.status : "not-started") as RepoTimelineStage["status"],
    }))
  }, [activeRoadmap, isSignedIn])

  const statusIcon = useMemo<Record<RepoTimelineStage["status"], JSX.Element>>(
    () => ({
      done: <CheckCircle2 className="h-4 w-4 text-primary" />,
      "in-progress": <Clock3 className="h-4 w-4 text-accent" />,
      "not-started": <CircleDotDashed className="h-4 w-4 text-muted-foreground" />,
    }),
    []
  )

  const headerTitle =
    activeRoadmap?.repo.full_name ?? identity?.fullName ?? "Repository timeline"

  const showLoadingState =
    (shouldGenerate && (!roadmap || isGenerating)) ||
    (!shouldGenerate && ((!activeRoadmap && fetchState === "loading") || isGenerating))

  const isSynced = repoState?.status === "synced"
  const canSync = isSignedIn && !isSynced && githubConnected && Boolean(activeRoadmap)
  const canDesync = isSignedIn && repoState?.status === "synced"
  const canArchive = isSignedIn && !!repoState
  const progressPercent = isSynced ? repoState?.progress_percent ?? 0 : 0

  useEffect(() => {
    let cancelled = false
    async function loadRating() {
      if (!isSynced || !identity || !isSignedIn) {
        setRatingState({ rating: null, average: null, count: 0 })
        return
      }
      const token = (await getToken?.()) ?? undefined
      const response = await repoService.getRating(identity.owner, identity.repoName, token)
      if (cancelled) return
      if (response.ok && response.data) {
        setRatingState({
          rating: response.data.rating,
          average: response.data.average_rating,
          count: response.data.rating_count,
        })
      }
    }
    loadRating()
    return () => {
      cancelled = true
    }
  }, [getToken, identity, isSignedIn, isSynced])

  const handleSync = useCallback(async () => {
    if (!identity || !isSignedIn) return
    const token = (await getToken?.()) ?? undefined
    await syncRepo(identity, token)
    await refreshUserRepos()
  }, [getToken, identity, isSignedIn, refreshUserRepos, syncRepo])

  const handleDesync = useCallback(async () => {
    if (!identity || !isSignedIn) return
    const confirmed = window.confirm("Desyncing clears your personal implementation state. Continue?")
    if (!confirmed) return
    const token = (await getToken?.()) ?? undefined
    await desyncRepo(identity, token)
    await refreshUserRepos()
  }, [desyncRepo, getToken, identity, isSignedIn, refreshUserRepos])

  const handleArchive = useCallback(async () => {
    if (!identity || !isSignedIn) return
    const confirmed = window.confirm(
      "Are you sure you want to archive this repo? It will disappear from Your Repositories until you unarchive it in Settings."
    )
    if (!confirmed) return
    const token = (await getToken?.()) ?? undefined
    await archiveRepo(identity, token)
    await Promise.all([refreshUserRepos(), refreshCatalog()])
    router.push("/search")
  }, [archiveRepo, getToken, identity, isSignedIn, refreshCatalog, refreshUserRepos, router])

  const handleRatingChange = useCallback(
    async (value: number) => {
      if (!identity || !isSignedIn) return
      const token = (await getToken?.()) ?? undefined
      const response = await repoService.setRating(identity.owner, identity.repoName, value, token)
      if (response.ok && response.data) {
        setRatingState({
          rating: response.data.rating,
          average: response.data.average_rating,
          count: response.data.rating_count,
        })
        void refreshCatalog()
      }
    },
    [getToken, identity, isSignedIn, refreshCatalog]
  )

  return (
    <div className="flex flex-1 flex-col gap-10 px-6 py-10 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <p className="text-sm text-muted-foreground">Timeline</p>
          <h1 className="text-2xl font-semibold">{headerTitle}</h1>
        </div>
        <TabSwitch repoId={repoId} />
      </div>

      {(showLoadingState || error) && (
        <section className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
          {showLoadingState && (
            <p className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 animate-spin" /> Generating timeline… this can take a few moments.
            </p>
          )}
          {error && (
            <div className="mt-3 flex items-center gap-3 text-destructive">
              <span>{error}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void retryLoad()
                }}
              >
                <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
        </section>
      )}

      {activeRoadmap && (
        <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl shadow-black/30">
          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="outline" className="text-xs uppercase">
              {activeRoadmap.repo.language ?? "Unknown language"}
            </Badge>
            <Badge variant="secondary" className="text-xs uppercase">
              {activeRoadmap.repo.stars} stars
            </Badge>
            {status === "synced" && (
              <Badge variant="accent" className="text-xs uppercase">
                Synced
              </Badge>
            )}
            {status === "unsynced" && (
              <Badge variant="outline" className="text-xs uppercase">
                Unsynced
              </Badge>
            )}
            {status === "pending" && (
              <Badge variant="secondary" className="text-xs uppercase">
                Syncing
              </Badge>
            )}
          </div>
          {activeRoadmap.repo.description && (
            <p className="mt-4 text-base text-muted-foreground">
              {activeRoadmap.repo.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <p>Generated {new Date(activeRoadmap.generated_at).toLocaleString()}</p>
            {ratingState.average !== null && (
              <span>
                {ratingState.average?.toFixed(1)} avg • {ratingState.count} ratings
              </span>
            )}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {canSync && (
              <Button onClick={() => void handleSync()}>Implement</Button>
            )}
            {canDesync && (
              <Button variant="destructive" onClick={() => void handleDesync()}>
                Desync
              </Button>
            )}
            {canArchive && (
              <Button variant="outline" onClick={() => void handleArchive()}>
                Archive
              </Button>
            )}
            {isSynced && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Your rating:</span>
                <RatingStars value={ratingState.rating} onChange={(value) => void handleRatingChange(value)} />
              </div>
            )}
          </div>
          {isSynced && (
            <div className="mt-6">
              <p className="text-xs uppercase text-muted-foreground">Implementation progress</p>
              <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{progressPercent}% complete</p>
            </div>
          )}
        </section>
      )}

      {activeRoadmap && (
        <TimelineCanvas
          stages={timelineStages}
          statusIcon={statusIcon}
          isSignedIn={isSignedIn}
        />
      )}

      {!activeRoadmap && fetchState === "idle" && !isGenerating && (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">
          No timeline available yet for this repository. Generate one from the home page to get started.
        </div>
      )}

      {!isSignedIn && (
        <p className="rounded-2xl border border-dashed border-border/60 bg-card/60 px-4 py-3 text-center text-sm text-muted-foreground">
          Signed-out view shows read-only tasks. Sign in to personalize progress and sync to the sidebar.
        </p>
      )}
    </div>
  )
}

function RatingStars({ value, onChange }: { value: number | null; onChange: (rating: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = typeof value === "number" && value >= star
        return (
          <button
            type="button"
            key={star}
            className={cn(
              "p-1",
              active ? "text-yellow-300" : "text-muted-foreground/60"
            )}
            onClick={() => onChange(star)}
          >
            <Star className={cn("h-4 w-4", active && "fill-current")}
            />
          </button>
        )
      })}
    </div>
  )
}

function TimelineCanvas({
  stages,
  statusIcon,
  isSignedIn,
}: {
  stages: RepoTimelineStage[]
  statusIcon: Record<RepoTimelineStage["status"], JSX.Element>
  isSignedIn: boolean
}) {
  return (
    <section className="relative mx-auto w-full max-w-5xl px-2">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-border/50 md:block" />
      <div className="grid gap-y-10 md:grid-cols-[1fr_40px_1fr] md:gap-x-8">
        {stages.map((stage, index) => {
          const align = index % 2 === 0 ? "left" : "right"
          const isCurrent = isSignedIn && stage.status === "in-progress"
          return (
            <div key={stage.id} className="grid md:contents">
              <div
                className={cn(
                  "md:col-start-1",
                  align === "right" && "md:col-start-3",
                  "col-span-1"
                )}
              >
                <TimelineNodeCard
                  stage={stage}
                  statusIcon={statusIcon[stage.status]}
                  isCurrent={isCurrent}
                />
              </div>
              <div className="relative hidden md:col-start-2 md:flex md:items-center md:justify-center">
                <div className="h-full w-px bg-border/50" />
                <span className="absolute h-4 w-4 rounded-full border border-border bg-background" />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TimelineNodeCard({
  stage,
  statusIcon,
  isCurrent,
}: {
  stage: RepoTimelineStage
  statusIcon: JSX.Element
  isCurrent: boolean
}) {
  return (
    <Card
      className={cn(
        "relative border border-border/60 bg-card/80 text-left shadow-lg",
        isCurrent && "border-primary/60"
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span>{statusIcon}</span>
          {stage.title}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {stage.summary}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">ETA {stage.eta}</div>
        <ul className="space-y-2 text-sm">
          {stage.tasks.map((task, index) => (
            <li key={index} className="rounded-lg bg-white/5 px-3 py-2">
              {task}
            </li>
          ))}
        </ul>
        {stage.resources.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="text-sm text-primary">
              Helpful resources
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {stage.resources.map((resource) => (
                  <li key={resource.href}>
                    <a
                      href={resource.href}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {resource.label}
                    </a>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}
