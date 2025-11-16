"use client";

import { useAuth } from "@clerk/nextjs";
import {
  CheckCircle2,
  ChevronDown,
  CircleDotDashed,
  Clock3,
  RefreshCcw,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import TabSwitch from "@/components/navigation/tab-switch";
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StarRating } from "@/components/ui/star-rating";
import type { RepoRecord, RepoTimelineStage } from "@/data/repos";
import {
  type RepoIdentity,
  type RoadmapResponseBody,
  repoService,
} from "@/lib/services/repos";
import { cn } from "@/lib/utils";

type FetchState = "idle" | "loading" | "error";

/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: central page coordinator */
export default function RepoTimelinePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const isSignedIn = Boolean(auth.isSignedIn);
  const getToken = auth.getToken;
  const { getBySlug, upsertRoadmap, yourRepos, desync } = useRoadmapCatalog();
  const repoId = params.repoId as string;
  const cachedRecord = getBySlug(repoId);
  const fallbackRecord = repoService.findById(repoId);
  const fullNameParam = searchParams?.get("fullName") ?? null;
  const repoUrlParam = searchParams?.get("repoUrl") ?? null;
  const identity: RepoIdentity | null = useMemo(() => {
    if (cachedRecord && "owner" in cachedRecord) {
      return {
        owner: cachedRecord.owner,
        repoName: cachedRecord.repoName,
        fullName: cachedRecord.fullName,
        slug: cachedRecord.slug,
      };
    }
    return (
      repoService.parseRepoInput(fullNameParam ?? "") ??
      repoService.parseRepoInput(repoUrlParam ?? "")
    );
  }, [cachedRecord, fullNameParam, repoUrlParam]);
  const [roadmap, setRoadmap] = useState<RoadmapResponseBody | null>(
    cachedRecord && "repo" in cachedRecord
      ? (cachedRecord as RoadmapResponseBody)
      : null
  );
  const [fetchState, setFetchState] = useState<FetchState>(
    roadmap || fallbackRecord ? "idle" : "loading"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isRatingLoading, setIsRatingLoading] = useState(false);

  const shouldGenerate = searchParams?.get("intent") === "generate";

  useEffect(() => {
    if (!identity || roadmap || isGenerating) {
      return;
    }
    let cancelled = false;
    const fetchCached = async () => {
      setFetchState("loading");
      const response = await repoService.getCachedRoadmap(
        identity.owner,
        identity.repoName
      );
      if (cancelled) {
        return;
      }
      if (response.ok && response.data) {
        setRoadmap(response.data);
        upsertRoadmap(response.data);
        setError(null);
        setFetchState("idle");
      } else if (response.status === 404 && repoUrlParam) {
        setFetchState("idle");
      } else if (!response.ok) {
        setError(response.error ?? "Unable to load roadmap.");
        setFetchState("error");
      }
    };
    fetchCached();
    return () => {
      cancelled = true;
    };
  }, [identity, roadmap, isGenerating, repoUrlParam, upsertRoadmap]);

  const retryLoad = useCallback(async () => {
    if (!identity) {
      return;
    }
    setFetchState("loading");
    const response = await repoService.getCachedRoadmap(
      identity.owner,
      identity.repoName
    );
    if (response.ok && response.data) {
      setRoadmap(response.data);
      upsertRoadmap(response.data);
      setError(null);
      setFetchState("idle");
    } else if (response.status === 404 && repoUrlParam) {
      setFetchState("idle");
    } else if (!response.ok) {
      setError(response.error ?? "Unable to load roadmap.");
      setFetchState("error");
    }
  }, [identity, repoUrlParam, upsertRoadmap]);

  useEffect(() => {
    let cancelled = false;
    if (!(shouldGenerate && repoUrlParam && identity && isSignedIn)) {
      return;
    }

    const repoUrl = repoUrlParam;

    async function runGeneration() {
      setIsGenerating(true);
      setError(null);
      const token = await getToken?.();
      const response = await repoService.generateRoadmap(
        repoUrl,
        token ?? undefined
      );
      if (cancelled) {
        return;
      }
      setIsGenerating(false);
      if (response.ok && response.data) {
        setRoadmap(response.data);
        upsertRoadmap(response.data);
        setFetchState("idle");
        router.replace(`/repo/${repoId}/timeline`);
      } else {
        setError(response.error ?? "Unable to generate roadmap.");
        setFetchState("error");
      }
    }

    runGeneration();

    return () => {
      cancelled = true;
    };
  }, [
    shouldGenerate,
    repoUrlParam,
    identity,
    isSignedIn,
    getToken,
    upsertRoadmap,
    repoId,
    router,
  ]);

  const fallbackRoadmap = useMemo(
    () => (fallbackRecord ? mapStaticRecordToRoadmap(fallbackRecord) : null),
    [fallbackRecord]
  );

  const activeRoadmap = roadmap ?? fallbackRoadmap;

  const [desyncOpen, setDesyncOpen] = useState(false);

  const syncedState = useMemo(() => {
    if (!identity) {
      return null;
    }
    return (
      yourRepos.find((repo) => repo.repo_full_name === identity.fullName) ??
      null
    );
  }, [identity, yourRepos]);

  const handleDesync = useCallback(async () => {
    if (!syncedState) {
      return;
    }
    const success = await desync(syncedState.repo_full_name);
    if (success) {
      setDesyncOpen(false);
    }
  }, [desync, syncedState]);

  // Fetch user rating when identity and auth are available
  useEffect(() => {
    if (!identity || !isSignedIn) {
      setUserRating(null);
      return;
    }
    let cancelled = false;
    const fetchRating = async () => {
      setIsRatingLoading(true);
      const token = await getToken?.();
      const response = await repoService.getUserRating(
        identity.owner,
        identity.repoName,
        token ?? undefined
      );
      if (cancelled) {
        return;
      }
      if (response.ok && response.data) {
        setUserRating(response.data.rating);
      } else {
        setUserRating(null);
      }
      setIsRatingLoading(false);
    };
    fetchRating();
    return () => {
      cancelled = true;
    };
  }, [identity, isSignedIn, getToken]);

  const handleRatingChange = useCallback(
    async (newRating: number) => {
      if (!identity || !isSignedIn) {
        return;
      }
      setIsRatingLoading(true);
      const token = await getToken?.();
      const response = await repoService.setRating(
        identity.owner,
        identity.repoName,
        newRating,
        token ?? undefined
      );
      if (response.ok && response.data) {
        setUserRating(response.data.rating);
        // Refresh roadmap to get updated rating stats
        if (roadmap) {
          const cachedResponse = await repoService.getCachedRoadmap(
            identity.owner,
            identity.repoName
          );
          if (cachedResponse.ok && cachedResponse.data) {
            setRoadmap(cachedResponse.data);
            upsertRoadmap(cachedResponse.data);
          }
        }
      }
      setIsRatingLoading(false);
    },
    [identity, isSignedIn, getToken, roadmap, upsertRoadmap]
  );

  // Calculate average rating
  const averageRating = useMemo(() => {
    if (
      !activeRoadmap?.repo.rating_count ||
      activeRoadmap.repo.rating_count === 0 ||
      !activeRoadmap.repo.rating_sum
    ) {
      return null;
    }
    return (
      activeRoadmap.repo.rating_sum / activeRoadmap.repo.rating_count
    );
  }, [activeRoadmap]);

  const timelineStages = useMemo(() => {
    if (!activeRoadmap) {
      return [];
    }
    return activeRoadmap.timeline.map((stage) => ({
      ...stage,
      status: (isSignedIn
        ? stage.status
        : "not-started") as RepoTimelineStage["status"],
    }));
  }, [activeRoadmap, isSignedIn]);

  const statusIcon = useMemo<Record<RepoTimelineStage["status"], JSX.Element>>(
    () => ({
      done: <CheckCircle2 className="h-4 w-4 text-primary" />,
      "in-progress": <Clock3 className="h-4 w-4 text-accent" />,
      "not-started": (
        <CircleDotDashed className="h-4 w-4 text-muted-foreground" />
      ),
    }),
    []
  );

  const headerTitle =
    activeRoadmap?.repo.full_name ??
    identity?.fullName ??
    fallbackRecord?.name ??
    "Repository timeline";

  const showLoadingState =
    (!activeRoadmap && fetchState === "loading") || isGenerating;

  return (
    <div className="flex flex-1 flex-col gap-10 px-6 py-10 lg:px-12">
      <AlertDialog onOpenChange={setDesyncOpen} open={desyncOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desync this repository?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to desync? This removes your personal
              implementation state. The public timeline will remain available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesync}>
              Confirm desync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <p className="text-muted-foreground text-sm">Timeline</p>
          <h1 className="font-semibold text-2xl">{headerTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          {syncedState && (
            <Button
              onClick={() => setDesyncOpen(true)}
              size="sm"
              variant="outline"
            >
              Desync
            </Button>
          )}
          <TabSwitch repoId={repoId} />
        </div>
      </div>

      {(showLoadingState || error) && (
        <section className="rounded-2xl border border-border/60 border-dashed bg-card/60 p-6 text-muted-foreground text-sm">
          {showLoadingState && (
            <p className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 animate-spin" /> Generating timeline…
              this can take a few moments.
            </p>
          )}
          {error && (
            <div className="mt-3 flex items-center gap-3 text-destructive">
              <span>{error}</span>
              <Button
                onClick={() => {
                  retryLoad();
                }}
                size="sm"
                variant="secondary"
              >
                <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
        </section>
      )}

      {activeRoadmap && (
        <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-black/30 shadow-xl">
          <div className="flex flex-wrap items-center gap-4">
            <Badge className="text-xs uppercase" variant="outline">
              {activeRoadmap.repo.language ?? "Unknown language"}
            </Badge>
            <Badge className="text-xs uppercase" variant="secondary">
              {activeRoadmap.repo.stars} stars
            </Badge>
            {activeRoadmap.cached && (
              <Badge className="text-xs uppercase" variant="accent">
                Cached hit
              </Badge>
            )}
            {syncedState && (
              <Badge className="text-xs uppercase" variant="accent">
                Synced
              </Badge>
            )}
          </div>
          {activeRoadmap.repo.description && (
            <p className="mt-4 text-base text-muted-foreground">
              {activeRoadmap.repo.description}
            </p>
          )}
          <p className="mt-4 text-muted-foreground text-sm">
            Generated {new Date(activeRoadmap.generated_at).toLocaleString()}
          </p>
          
          {/* Rating Section */}
          {syncedState && isSignedIn && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">Your rating:</span>
                  <StarRating
                    value={userRating ?? 0}
                    onValueChange={handleRatingChange}
                    readonly={isRatingLoading}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Average Rating Display */}
          {averageRating !== null && (
            <div className="mt-3 flex items-center gap-2">
              <StarRating
                value={averageRating}
                readonly
                size="sm"
                showValue
              />
              <span className="text-muted-foreground text-xs">
                ({activeRoadmap.repo.rating_count}{" "}
                {activeRoadmap.repo.rating_count === 1 ? "rating" : "ratings"})
              </span>
            </div>
          )}

          {syncedState && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Progress</span>
                <span>{syncedState.progress_percent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-border/50">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, Math.max(0, syncedState.progress_percent))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {activeRoadmap && (
        <TimelineCanvas
          isSignedIn={isSignedIn}
          stages={timelineStages}
          statusIcon={statusIcon}
        />
      )}

      {!activeRoadmap && fetchState === "idle" && !isGenerating && (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 text-muted-foreground text-sm">
          No timeline available yet for this repository. Generate one from the
          home page to get started.
        </div>
      )}

      {!isSignedIn && (
        <p className="rounded-2xl border border-border/60 border-dashed bg-card/60 px-4 py-3 text-center text-muted-foreground text-sm">
          Signed-out view shows read-only tasks. Sign in to personalize progress
          and sync to the sidebar.
        </p>
      )}
    </div>
  );
}

function TimelineCanvas({
  stages,
  statusIcon,
  isSignedIn,
}: {
  stages: RepoTimelineStage[];
  statusIcon: Record<RepoTimelineStage["status"], JSX.Element>;
  isSignedIn: boolean;
}) {
  return (
    <section className="relative mx-auto w-full max-w-5xl px-2">
      <div className="-translate-x-1/2 pointer-events-none absolute inset-y-0 left-1/2 hidden w-px bg-border/50 md:block" />
      <div className="grid gap-y-10 md:grid-cols-[1fr_40px_1fr] md:gap-x-8">
        {stages.map((stage, index) => {
          const align = index % 2 === 0 ? "left" : "right";
          const isCurrent = isSignedIn && stage.status === "in-progress";
          return (
            <div className="grid md:contents" key={stage.id}>
              <div
                className={cn(
                  "md:col-start-1",
                  align === "right" && "md:col-start-3",
                  "col-span-1"
                )}
              >
                <TimelineNodeCard
                  align={align}
                  isCurrent={isCurrent}
                  isSignedIn={isSignedIn}
                  stage={stage}
                  statusIcon={statusIcon[stage.status]}
                />
              </div>
              <div className="relative hidden md:col-start-2 md:flex md:items-center md:justify-center">
                <div className="h-full w-px bg-border/50" />
                <span className="absolute h-4 w-4 rounded-full border border-border bg-background" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function mapStaticRecordToRoadmap(record: RepoRecord): RoadmapResponseBody {
  const numericStars = Number.parseInt(record.stars.replace(/[^0-9]/g, ""), 10);
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
  };
}

function TimelineNodeCard({
  stage,
  align,
  statusIcon,
  isCurrent,
  isSignedIn,
}: {
  stage: RepoTimelineStage;
  align: "left" | "right";
  statusIcon: JSX.Element;
  isCurrent: boolean;
  isSignedIn: boolean;
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
            "border-border/60 bg-card/70 shadow-black/25 shadow-lg",
            isCurrent && "ring-1 ring-primary/40"
          )}
        >
          <CardHeader className={cn("pb-2", align === "right" && "text-right")}>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">{stage.title}</CardTitle>
              <Badge
                className="flex items-center gap-1 text-xs"
                variant="secondary"
              >
                {statusIcon}
                {stage.status === "not-started" && !isSignedIn
                  ? "not started"
                  : stage.status.replace("-", " ")}
              </Badge>
            </div>
            <CardDescription>{stage.summary}</CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-2">
              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  {isSignedIn ? "Tasks" : "Tasks · Sign in to start"}
                </p>
                <ul className="mt-3 space-y-2 text-muted-foreground text-sm">
                  {stage.tasks.map((task) => (
                    <li className="flex items-start gap-2" key={task}>
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {stage.resources.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Resources
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {stage.resources.map((resource) => (
                      <Button
                        asChild
                        className="border border-border/60"
                        key={resource.label}
                        size="sm"
                        variant="ghost"
                      >
                        <a
                          href={resource.href}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {resource.label}
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
          <div className="flex items-center justify-between border-border/60 border-t px-6 py-3 text-muted-foreground text-xs">
            <span>ETA: {stage.eta}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost">
                Open guide
              </Button>
              <CollapsibleTrigger asChild>
                <Button
                  className="gap-1 rounded-xl"
                  size="sm"
                  variant="secondary"
                >
                  Details
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </Card>
      </div>
    </Collapsible>
  );
}
