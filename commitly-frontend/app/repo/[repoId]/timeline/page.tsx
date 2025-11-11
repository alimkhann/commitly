"use client"

import { useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleDotDashed,
  Clock3,
} from "lucide-react"

import { getRepoById, type RepoTimelineStage } from "@/data/repos"
import { cn } from "@/lib/utils"
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
import TabSwitch from "../../../components/TabSwitch"

export default function RepoTimelinePage() {
  const params = useParams()
  const router = useRouter()
  const repoId = params.repoId as string
  const repo = getRepoById(repoId)

  const statusIcon = useMemo<Record<RepoTimelineStage["status"], JSX.Element>>(
    () => ({
      done: <CheckCircle2 className="h-4 w-4 text-primary" />,
      "in-progress": <Clock3 className="h-4 w-4 text-accent" />,
      "not-started": (
        <CircleDotDashed className="h-4 w-4 text-muted-foreground" />
      ),
    }),
    []
  )

  if (!repo) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-xl font-semibold">Repo not found</p>
        <Button variant="secondary" onClick={() => router.push("/")}>
          Go home
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-10 px-6 py-10 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <p className="text-sm text-muted-foreground">Timeline</p>
          <h1 className="text-2xl font-semibold">{repo.name}</h1>
        </div>
        <TabSwitch repoId={repoId} />
      </div>

      <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl shadow-black/30">
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="outline" className="text-xs uppercase">
            {repo.language}
          </Badge>
          <Badge variant="secondary" className="text-xs uppercase">
            {repo.stars} stars
          </Badge>
          <Badge variant="accent" className="text-xs uppercase">
            {repo.difficulty}
          </Badge>
        </div>
        <p className="mt-4 text-base text-muted-foreground">{repo.description}</p>
        <div className="mt-4">
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${repo.progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {repo.progress}% of tasks completed · Updated {repo.updatedAt}
          </p>
        </div>
      </section>

      <TimelineCanvas stages={repo.timeline} statusIcon={statusIcon} />
    </div>
  )
}

function TimelineCanvas({
  stages,
  statusIcon,
}: {
  stages: RepoTimelineStage[]
  statusIcon: Record<RepoTimelineStage["status"], JSX.Element>
}) {
  return (
    <section className="relative mx-auto w-full max-w-5xl px-2">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-border/50 md:block" />
      <div className="grid gap-y-10 md:grid-cols-[1fr_40px_1fr] md:gap-x-8">
        {stages.map((stage, index) => {
          const align = index % 2 === 0 ? "left" : "right"
          const isCurrent = stage.status === "in-progress"
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
                  align={align}
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
  align,
  statusIcon,
  isCurrent,
}: {
  stage: RepoTimelineStage
  align: "left" | "right"
  statusIcon: JSX.Element
  isCurrent: boolean
}) {
  return (
    <Collapsible className="group">
      <div className="relative">
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 hidden h-px w-10 bg-border/50 md:block",
            align === "left" ? "-right-10" : "-left-10"
          )}
        />
        <Card
          className={cn(
            "border-border/60 bg-card/70 shadow-lg shadow-black/25",
            isCurrent && "ring-1 ring-primary/40"
          )}
        >
          <CardHeader className={cn("pb-2", align === "right" && "text-right")}
          >
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">{stage.title}</CardTitle>
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                {statusIcon}
                {stage.status.replace("-", " ")}
              </Badge>
            </div>
            <CardDescription>{stage.summary}</CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-2">
              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tasks
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {stage.tasks.map((task) => (
                    <li key={task} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {stage.resources.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Resources
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {stage.resources.map((resource) => (
                      <Button
                        key={resource.label}
                        variant="ghost"
                        size="sm"
                        className="border border-border/60"
                        asChild
                      >
                        <a href={resource.href}>{resource.label}</a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
          <div className="flex items-center justify-between border-t border-border/60 px-6 py-3 text-xs text-muted-foreground">
            <span>ETA: {stage.eta}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                Open guide
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1 rounded-xl">
                  Details
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </Card>
      </div>
    </Collapsible>
  )
}
