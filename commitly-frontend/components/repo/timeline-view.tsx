"use client";

import { useAuth } from "@clerk/nextjs";
import {
  CheckCircle2,
  ChevronDown,
  CircleDotDashed,
  Clock3,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type JSX, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import TabSwitch from "@/components/navigation/tab-switch";
import { usePreferences } from "@/components/providers/preferences-provider";
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
import type { CodeExample, RepoTimelineStage } from "@/data/repos";
import {
  type RoadmapGenerationJobStatus,
  type RepoIdentity,
  type RoadmapResponseBody,
  repoService,
} from "@/lib/services/repos";
import { normalizeTask } from "@/lib/roadmap/tasks";
import { cn } from "@/lib/utils";

type FetchState = "idle" | "loading" | "error";

/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: central page coordinator */
export default function TimelineView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const isSignedIn = Boolean(auth.isSignedIn);
  const getToken = auth.getToken;
  const {
    getBySlug,
    upsertRoadmap,
    yourRepos,
    desync,
    refreshUserRepos,
    unarchive,
  } = useRoadmapCatalog();
  const { t } = usePreferences();
  const repoId = params.repoId as string;
  const cachedRecord = getBySlug(repoId);
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
      repoService.parseRepoInput(repoUrlParam ?? "") ??
      // Fallback: try to parse slug as owner-repo
      // This is a heuristic and might fail for complex names but prevents hanging
      (() => {
        const parts = repoId.split("-");
        if (parts.length >= 2) {
          const owner = parts[0];
          const repoName = parts.slice(1).join("-");
          return {
            owner,
            repoName,
            fullName: `${owner}/${repoName}`,
            slug: repoId,
          };
        }
        return null;
      })()
    );
  }, [cachedRecord, fullNameParam, repoUrlParam, repoId]);
  const [roadmap, setRoadmap] = useState<RoadmapResponseBody | null>(
    cachedRecord && "repo" in cachedRecord
      ? (cachedRecord as RoadmapResponseBody)
      : null
  );
  const [fetchState, setFetchState] = useState<FetchState>(
    roadmap ? "idle" : "loading"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isRatingLoading, setIsRatingLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [handledGeneration, setHandledGeneration] = useState(false);
  const [generationStatus, setGenerationStatus] =
    useState<string>("Initializing...");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [progressiveJobId, setProgressiveJobId] = useState<string | null>(null);
  const [progressiveStatus, setProgressiveStatus] =
    useState<RoadmapGenerationJobStatus | null>(null);
  const [generatedStages, setGeneratedStages] = useState(0);
  const [totalPlannedStages, setTotalPlannedStages] = useState(0);
  const [isContinuingGeneration, setIsContinuingGeneration] = useState(false);

  const shouldGenerate = searchParams?.get("intent") === "generate";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDisplayProgress((prev) => {
        if (Math.abs(prev - generationProgress) <= 1) {
          return generationProgress;
        }
        return prev + (generationProgress > prev ? 1 : -1);
      });
    }, 25);
    return () => window.clearInterval(timer);
  }, [generationProgress]);

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

  // Record view when timeline is loaded
  useEffect(() => {
    if (!(identity && roadmap)) {
      return;
    }
    let cancelled = false;
    const recordView = async () => {
      const token = await getToken?.();
      await repoService.recordRoadmapView(
        identity.owner,
        identity.repoName,
        token ?? undefined
      );
    };
    if (!cancelled) {
      recordView();
    }
    return () => {
      cancelled = true;
    };
  }, [identity, roadmap, getToken]);

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
    if (
      !(
        shouldGenerate &&
        repoUrlParam &&
        identity &&
        isSignedIn &&
        !handledGeneration
      )
    ) {
      return;
    }

    const resolvedIdentity = identity;
    const repoUrl = repoUrlParam;

    async function runGeneration() {
      try {
        setIsGenerating(true);
        setError(null);
        setIsAuthError(false);
        setGenerationStatus(t("generation_preparing", "Preparing generation..."));
        setGenerationProgress(2);
        const token = await getToken?.();

        const startResponse = await repoService.generateRoadmapProgressive(
          repoUrl,
          token ?? undefined,
          { forceRefresh: true }
        );

        if (!(startResponse.ok && startResponse.data)) {
          throw new Error(
            startResponse.error ?? "Failed to start roadmap generation."
          );
        }

        if (cancelled) {
          return;
        }

        setProgressiveJobId(startResponse.data.job_id);
        const applyProgressSnapshot = (
          snapshot: {
            status: RoadmapGenerationJobStatus;
            generated_stages: number;
            total_planned_stages: number;
            progress_percent?: number;
            phase_message?: string | null;
            current_phase?: string | null;
            last_error?: string | null;
          }
        ) => {
          setProgressiveStatus(snapshot.status);
          setGeneratedStages(snapshot.generated_stages);
          setTotalPlannedStages(snapshot.total_planned_stages);
          setGenerationProgress(
            Math.max(
              0,
              Math.min(
                100,
                snapshot.progress_percent ??
                  Math.round(
                    (snapshot.generated_stages /
                      Math.max(1, snapshot.total_planned_stages)) *
                      100
                  )
              )
            )
          );
          setGenerationStatus(
            snapshot.phase_message?.trim() ||
              `Generated ${snapshot.generated_stages}/${snapshot.total_planned_stages} stages`
          );
        };

        applyProgressSnapshot(startResponse.data);

        let currentStatus = startResponse.data.status;
        let currentError =
          (startResponse.data as { last_error?: string | null }).last_error ??
          null;
        let pollCount = 0;
        while (
          !cancelled &&
          (currentStatus === "queued" || currentStatus === "running") &&
          pollCount < 40
        ) {
          await new Promise((resolve) => setTimeout(resolve, 900));
          const statusResponse = await repoService.getRoadmapJob(
            startResponse.data.job_id,
            token ?? undefined
          );
          if (!(statusResponse.ok && statusResponse.data)) {
            break;
          }
          applyProgressSnapshot(statusResponse.data);
          currentStatus = statusResponse.data.status;
          currentError = statusResponse.data.last_error ?? currentError;
          pollCount += 1;
        }

        if (currentStatus === "failed") {
          throw new Error(
            currentError ||
              "Roadmap generation failed quality checks. Please try again."
          );
        }

        if (currentStatus === "queued" || currentStatus === "running") {
          throw new Error(
            "Roadmap generation is taking longer than expected. Please retry in a moment."
          );
        }

        const cached = await repoService.getCachedRoadmap(
          resolvedIdentity.owner,
          resolvedIdentity.repoName
        );
        if (cached.ok && cached.data) {
          setRoadmap(cached.data);
          upsertRoadmap(cached.data, true);
          setFetchState("idle");
        }

        setHandledGeneration(true);
        setGenerationProgress(100);
        router.replace(
          `/repo/${repoId}?view=timeline&fullName=${encodeURIComponent(
            resolvedIdentity.fullName
          )}`
        );
      } catch (err) {
        if (cancelled) return;
        console.error("Generation error:", err);
        setHandledGeneration(true);
        if (err instanceof Error && err.message.includes("401")) {
          setIsAuthError(true);
          setError(
            "GitHub authentication failed. Please reconnect your account."
          );
        } else if (err instanceof Error && err.message.includes("Token budget")) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred during generation."
          );
        }
        setFetchState("error");
        router.replace(
          `/repo/${repoId}?view=timeline&fullName=${encodeURIComponent(
            resolvedIdentity.fullName
          )}`
        );
      } finally {
        if (!cancelled) {
          setIsGenerating(false);
        }
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
    handledGeneration,
    t,
  ]);

  const activeRoadmap = roadmap;

  useEffect(() => {
    if (!activeRoadmap) {
      return;
    }
    const roadmapStatus =
      (activeRoadmap.job_state as RoadmapGenerationJobStatus | undefined) ??
      "completed";
    setProgressiveStatus(roadmapStatus);
    if (!generatedStages) {
      setGeneratedStages(activeRoadmap.last_generated_stage ?? 0);
    }
    if (!totalPlannedStages) {
      setTotalPlannedStages(Math.max(activeRoadmap.timeline.length - 1, 0));
    }
  }, [activeRoadmap, generatedStages, totalPlannedStages]);

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

  const handleUnarchive = useCallback(async () => {
    if (!syncedState) {
      return;
    }
    await unarchive(syncedState.repo_full_name);
  }, [unarchive, syncedState]);

  const handleImplement = useCallback(async () => {
    if (!(identity && isSignedIn)) {
      setActionError("Sign in to save this roadmap to your library.");
      return;
    }
    setIsSyncing(true);
    setActionError(null);
    const token = await getToken?.();
    const response = await repoService.syncRepo(
      identity.owner,
      identity.repoName,
      token ?? undefined
    );
    if (response.ok) {
      await refreshUserRepos();
    } else {
      setActionError(response.error ?? "Unable to save roadmap to your library.");
    }
    setIsSyncing(false);
  }, [getToken, identity, isSignedIn, refreshUserRepos]);

  const handleContinueGeneration = useCallback(async () => {
    if (!(identity && isSignedIn)) {
      setActionError("Sign in to continue generation.");
      return;
    }

    setIsContinuingGeneration(true);
    setActionError(null);

    try {
      const token = await getToken?.();
      let jobId = progressiveJobId;

      if (!jobId) {
        const bootstrap = await repoService.generateRoadmapProgressive(
          `https://github.com/${identity.fullName}`,
          token ?? undefined,
          { forceRefresh: false }
        );
        if (!(bootstrap.ok && bootstrap.data)) {
          throw new Error(
            bootstrap.error ?? "Unable to resume generation job."
          );
        }
        jobId = bootstrap.data.job_id;
        setProgressiveJobId(jobId);
        setProgressiveStatus(bootstrap.data.status);
        setGenerationProgress(bootstrap.data.progress_percent ?? 0);
        if (bootstrap.data.phase_message) {
          setGenerationStatus(bootstrap.data.phase_message);
        }
      }

      const continued = await repoService.continueRoadmapJob(
        jobId,
        token ?? undefined
      );
      if (!(continued.ok && continued.data)) {
        throw new Error(continued.error ?? "Unable to continue generation.");
      }

      setProgressiveStatus(continued.data.status);
      setGeneratedStages(continued.data.generated_stages);
      setTotalPlannedStages(continued.data.total_planned_stages);
      setGenerationProgress(continued.data.progress_percent ?? 0);
      if (continued.data.phase_message) {
        setGenerationStatus(continued.data.phase_message);
      }

      const refreshed = await repoService.getCachedRoadmap(
        identity.owner,
        identity.repoName
      );
      if (refreshed.ok && refreshed.data) {
        setRoadmap(refreshed.data);
        upsertRoadmap(refreshed.data, true);
      }
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to continue roadmap generation."
      );
    } finally {
      setIsContinuingGeneration(false);
    }
  }, [
    getToken,
    identity,
    isSignedIn,
    progressiveJobId,
    upsertRoadmap,
  ]);

  // Fetch user rating when identity and auth are available
  useEffect(() => {
    if (!(identity && isSignedIn)) {
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
      if (!(identity && isSignedIn)) {
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
    return activeRoadmap.repo.rating_sum / activeRoadmap.repo.rating_count;
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
    "Repository timeline";

  const showLoadingState =
    (!activeRoadmap && fetchState === "loading") || isGenerating;

  const showFullScreenLoading =
    (isGenerating || (!handledGeneration && shouldGenerate && isSignedIn)) &&
    fetchState !== "error";

  const roadmapJobState =
    progressiveStatus ??
    ((activeRoadmap?.job_state as RoadmapGenerationJobStatus | undefined) ??
      "completed");
  const completedStages =
    generatedStages ||
    activeRoadmap?.last_generated_stage ||
    Math.max((activeRoadmap?.timeline.length ?? 1) - 1, 0);
  const plannedStages =
    totalPlannedStages || Math.max((activeRoadmap?.timeline.length ?? 1) - 1, 0);
  const canContinueGeneration =
    Boolean(activeRoadmap && identity && isSignedIn) &&
    roadmapJobState !== "completed" &&
    roadmapJobState !== "failed";

  if (showFullScreenLoading) {
    return (
      <GenerationLoadingCard
        progress={displayProgress}
        repoName={identity?.fullName ?? "Repository"}
        status={generationStatus}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-10 px-6 py-10 lg:px-12">
      <AlertDialog onOpenChange={setDesyncOpen} open={desyncOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from library?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the roadmap from your personal library. The public
              timeline will remain available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesync}>
              {t("confirm_remove", "Confirm remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <p className="text-muted-foreground text-sm">{t("timeline", "Timeline")}</p>
          <h1 className="font-semibold text-2xl">{headerTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canContinueGeneration && (
            <Button
              disabled={isContinuingGeneration}
              onClick={handleContinueGeneration}
              size="sm"
              variant="secondary"
            >
              {isContinuingGeneration
                ? t("continuing_generation", "Continuing…")
                : t("continue_generation", "Continue generation")}
            </Button>
          )}
          {!syncedState && identity && (
            <Button
              disabled={!isSignedIn || isSyncing}
              onClick={handleImplement}
              size="sm"
            >
              {isSyncing
                ? t("saving", "Saving...")
                : t("save_to_library", "Save to library")}
            </Button>
          )}
          {syncedState && !syncedState.is_archived && (
            <Button
              onClick={() => setDesyncOpen(true)}
              size="sm"
              variant="outline"
            >
              {t("remove_from_library", "Remove from library")}
            </Button>
          )}
          {syncedState && syncedState.is_archived && (
            <Button onClick={handleUnarchive} size="sm" variant="outline">
              Unarchive
            </Button>
          )}
          <TabSwitch repoId={repoId} />
        </div>
      </div>

      {actionError && (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          {actionError}
        </p>
      )}

      {(showLoadingState || error) && (
        <section className="rounded-2xl border border-border/70 border-dashed bg-card p-6 text-muted-foreground text-sm">
          {showLoadingState && (
            <p className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" /> Generating timeline…
              this can take a few moments.
            </p>
          )}
          {error && (
            <div className="mt-3 flex flex-col gap-3 text-destructive">
              <div className="flex items-center gap-2">
                <span>{error}</span>
              </div>
              {isAuthError && (
                <Button asChild className="w-fit" size="sm" variant="outline">
                  <Link href="/?settings=connections#connections">
                    Reconnect GitHub in Settings
                  </Link>
                </Button>
              )}
              {!isAuthError && (
                <Button
                  className="w-fit"
                  onClick={() => {
                    retryLoad();
                  }}
                  size="sm"
                  variant="secondary"
                >
                  <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {activeRoadmap && (
        <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
          <div className="flex flex-wrap items-center gap-4">
            <Badge className="text-xs uppercase" variant="outline">
              {activeRoadmap.repo.language ?? t("language_unknown", "Unknown")}
            </Badge>
            {activeRoadmap.repo.difficulty && (
              <Badge className="text-xs uppercase" variant="outline">
                {activeRoadmap.repo.difficulty}
              </Badge>
            )}
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
                {t("in_library", "In library")}
              </Badge>
            )}
            {roadmapJobState !== "completed" && (
              <Badge className="text-xs uppercase" variant="secondary">
                {completedStages}/{plannedStages || completedStages}{" "}
                {t("stages", "stages")}
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
                  <span className="text-muted-foreground text-xs">
                    Your rating:
                  </span>
                  <StarRating
                    onValueChange={handleRatingChange}
                    readonly={isRatingLoading}
                    size="sm"
                    value={userRating ?? 0}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Average Rating Display */}
          {averageRating !== null && (
            <div className="mt-3 flex items-center gap-2">
              <StarRating readonly showValue size="sm" value={averageRating} />
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
          repoSlug={repoId}
          stages={timelineStages}
          statusIcon={statusIcon}
          t={t}
        />
      )}

      {!activeRoadmap && fetchState === "idle" && !isGenerating && (
        <div className="rounded-2xl border border-border/70 bg-card p-6 text-muted-foreground text-sm">
          {t(
            "no_roadmap_available",
            "No timeline available yet for this repository. Generate one from the home page to get started."
          )}
        </div>
      )}

      {!isSignedIn && (
        <p className="rounded-2xl border border-border/70 border-dashed bg-card px-4 py-3 text-center text-muted-foreground text-sm">
          {t(
            "signed_out_readonly",
            "Signed-out view shows read-only roadmap details. Sign in to save this roadmap to your library."
          )}
        </p>
      )}
    </div>
  );
}

function TimelineCanvas({
  stages,
  statusIcon,
  isSignedIn,
  repoSlug,
  t,
}: {
  stages: RepoTimelineStage[];
  statusIcon: Record<RepoTimelineStage["status"], JSX.Element>;
  isSignedIn: boolean;
  repoSlug: string;
  t: (key: string, fallback?: string) => string;
}) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(
    stages[0]?.id ?? null
  );
  const resolvedSelectedStageId = useMemo(() => {
    if (stages.length === 0) {
      return null;
    }
    if (selectedStageId && stages.some((stage) => stage.id === selectedStageId)) {
      return selectedStageId;
    }
    return stages[0].id;
  }, [selectedStageId, stages]);

  const selectedStage = useMemo(
    () =>
      stages.find((stage) => stage.id === resolvedSelectedStageId) ??
      stages[0] ??
      null,
    [resolvedSelectedStageId, stages]
  );
  const selectedIndex = useMemo(
    () =>
      selectedStage
        ? Math.max(
            1,
            stages.findIndex((stage) => stage.id === selectedStage.id) + 1
          )
        : 1,
    [selectedStage, stages]
  );

  if (!selectedStage) {
    return null;
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-border/70 bg-card p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            {t("stage_rail_label", "Stage rail")}
          </p>
          <Badge className="text-[10px]" variant="outline">
            {stages.length} {t("stages", "stages")}
          </Badge>
        </div>
        <div className="space-y-1.5">
          {stages.map((stage, index) => {
            const isSelected = stage.id === selectedStage.id;
            return (
              <button
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                  isSelected
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/60 bg-background hover:border-border"
                )}
                key={stage.id}
                onClick={() => setSelectedStageId(stage.id)}
                type="button"
              >
                <span className="mt-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{stage.title}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    {stage.summary}
                  </p>
                </div>
                <span className="mt-0.5 shrink-0">{statusIcon[stage.status]}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <div>
        <TimelineNodeCard
          align="left"
          index={selectedIndex}
          isCurrent={isSignedIn && selectedStage.status === "in-progress"}
          isSignedIn={isSignedIn}
          repoSlug={repoSlug}
          stage={selectedStage}
          statusIcon={statusIcon[selectedStage.status]}
        />
      </div>
    </section>
  );
}

function TimelineNodeCard({
  stage,
  align,
  statusIcon,
  isCurrent,
  isSignedIn,
  repoSlug,
  index,
}: {
  stage: RepoTimelineStage;
  align: "left" | "right";
  statusIcon: JSX.Element;
  isCurrent: boolean;
  isSignedIn: boolean;
  repoSlug: string;
  index: number;
}) {
  const ctaLabel = useMemo(() => {
    if (!isSignedIn) return "Details";
    switch (stage.status) {
      case "not-started":
        return "Start this stage";
      case "in-progress":
        return "Continue";
      case "done":
        return "Review";
      default:
        return "Details";
    }
  }, [isSignedIn, stage.status]);

  const ctaVariant =
    isSignedIn && stage.status !== "done" ? "default" : "secondary";

  return (
    <div className="group relative">
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 hidden h-px w-10 bg-border/50 md:block",
          align === "left" ? "-right-10" : "-left-10"
        )}
      />
      <Collapsible>
        <Card
          className={cn(
            "border-border/70 bg-card shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-all hover:border-border",
            isCurrent && "ring-1 ring-primary/40"
          )}
        >
          <CardHeader className={cn("pb-3", align === "right" && "text-right")}>
            <div className="flex flex-col gap-1">
              <div
                className={cn(
                  "flex items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-wider",
                  align === "right" && "justify-end"
                )}
              >
                <span>Stage {index}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <CardTitle
                  className={cn("text-lg", align === "right" && "order-2")}
                >
                  {stage.title}
                </CardTitle>
                <Badge
                  className={cn(
                    "flex shrink-0 items-center gap-1 text-[10px]",
                    align === "right" && "order-1"
                  )}
                  variant="secondary"
                >
                  {statusIcon}
                  <span className="uppercase">
                    {stage.status === "not-started" && !isSignedIn
                      ? "not started"
                      : stage.status.replace("-", " ")}
                  </span>
                </Badge>
              </div>
            </div>
            <CardDescription className="mt-1.5 leading-relaxed">
              {stage.summary}
            </CardDescription>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-6 pt-1">
              {/* Goals Section */}
              {stage.goals && stage.goals.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[11px] text-muted-foreground uppercase tracking-widest">
                      Goals
                    </h4>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  <ul className="space-y-2">
                    {stage.goals.map((goal: string, idx: number) => (
                      <li
                        className="flex items-start gap-2.5 text-muted-foreground text-sm"
                        key={idx}
                      >
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Prerequisites Section */}
              {stage.prerequisites && stage.prerequisites.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[11px] text-muted-foreground uppercase tracking-widest">
                      Prerequisites
                    </h4>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  <ul className="space-y-2">
                    {stage.prerequisites.map((prereq: string, idx: number) => (
                      <li
                        className="flex items-start gap-2.5 text-muted-foreground text-sm"
                        key={idx}
                      >
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/70" />
                        <span>{prereq}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Checkpoints Section */}
              {stage.checkpoints && stage.checkpoints.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[11px] text-muted-foreground uppercase tracking-widest">
                      Checkpoints
                    </h4>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  <ul className="space-y-2">
                    {stage.checkpoints.map(
                      (checkpoint: string, idx: number) => (
                        <li
                          className="flex items-start gap-2.5 text-muted-foreground text-sm"
                          key={idx}
                        >
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
                          <span>{checkpoint}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {/* Tasks Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-[11px] text-muted-foreground uppercase tracking-widest">
                    {isSignedIn ? "Tasks" : "Tasks · Sign in to start"}
                  </h4>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <div className="space-y-3">
                  {stage.tasks.map((rawTask: unknown, idx: number) => {
                    const task = normalizeTask(rawTask, idx);
                    return (
                      <div
                        className="rounded-lg border border-border/70 bg-background p-3.5 transition-colors hover:bg-muted"
                        key={idx}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-foreground text-sm">
                            {task.label}
                          </p>
                        </div>
                        {task.steps.length > 0 && (
                          <ol className="mt-2 space-y-1.5 text-muted-foreground text-xs leading-relaxed">
                            {task.steps.map((step, stepIndex) => (
                              <li className="flex items-start gap-2" key={stepIndex}>
                                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                        {task.files.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground/80">
                              Files:
                            </span>
                            {task.files.map((file) => (
                              <code
                                className="rounded bg-muted/50 px-1 py-0.5 font-mono"
                                key={file}
                              >
                                {file}
                              </code>
                            ))}
                          </div>
                        )}
                        {task.commands.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground/80">
                              Commands:
                            </span>
                            {task.commands.map((command) => (
                              <code
                                className="rounded bg-muted/50 px-1 py-0.5 font-mono"
                                key={command}
                              >
                                {command}
                              </code>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Code Examples Section */}
              {stage.code_examples && stage.code_examples.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[11px] text-muted-foreground uppercase tracking-widest">
                      Code Examples
                    </h4>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  <div className="space-y-3">
                    {stage.code_examples.map((example: CodeExample, idx: number) => (
                      <Collapsible className="group/code" key={idx}>
                        <div className="rounded-lg border border-border/50 bg-muted/30">
                          <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium font-mono text-xs">
                                  {example.file}
                                </span>
                                <Badge
                                  className="h-4 px-1 text-[9px]"
                                  variant="outline"
                                >
                                  {example.language}
                                </Badge>
                              </div>
                              <p className="line-clamp-1 text-[11px] text-muted-foreground">
                                {example.description}
                              </p>
                            </div>
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]/code:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-border/50 border-t p-3 pt-0">
                              <p className="mb-2 text-[11px] text-muted-foreground">
                                {example.description}
                              </p>
                              <pre className="max-w-full overflow-x-auto rounded-md bg-background p-3 font-mono text-[10px] leading-relaxed">
                                <code>{example.snippet}</code>
                              </pre>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}

              {/* Resources Section */}
              {stage.resources.length > 0 && (
                <div className="pt-2">
                  <div className="flex flex-wrap gap-2">
                    {stage.resources.map(
                      (resource: { label: string; href: string }) => (
                        <a
                          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                          href={resource.href}
                          key={resource.label}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span>{resource.label}</span>
                          <span className="opacity-50">↗</span>
                        </a>
                      )
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>

          <div className="flex items-center justify-between border-border/60 border-t bg-muted/20 px-5 py-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Clock3 className="h-3.5 w-3.5" />
              <span>{stage.eta}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant={ctaVariant}>
                <Link href={`/repo/${repoSlug}?view=guide&stage=${stage.id}`}>
                  {ctaLabel}
                </Link>
              </Button>
              <CollapsibleTrigger asChild>
                <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  <span className="sr-only">Toggle details</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </Card>
      </Collapsible>
    </div>
  );
}

function GenerationLoadingCard({
  repoName,
  status,
  progress,
}: {
  repoName: string;
  status?: string;
  progress: number;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-2xl rounded-2xl border border-border/70 bg-card p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
          <Clock3 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-semibold text-2xl">
          <ShinyText>Generating roadmap for {repoName}</ShinyText>
        </h2>
        <p className="mt-2 text-muted-foreground">
          {status ||
            "Analyzing commit history, identifying key milestones, and structuring your learning path. This may take up to a minute."}
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/70 transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
        <p className="pt-3 text-muted-foreground text-xs">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

function ShinyText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("shiny-text animate-shiny-text", className)}>{children}</span>;
}
