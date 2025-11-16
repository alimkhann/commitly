"use client";

import { useAuth } from "@clerk/nextjs";
import { Filter, GitBranch, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  AlertDialogTrigger,
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
import { Input } from "@/components/ui/input";
import type { RepoRecord } from "@/data/repos";
import { githubService } from "@/lib/services/github";
import { type RoadmapResponseBody, repoService } from "@/lib/services/repos";

const mapStaticRecordToRoadmap = (record: RepoRecord): RoadmapResponseBody => {
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
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<
    "all" | "beginner" | "intermediate" | "advanced"
  >("all");
  const repoList = useMemo(() => repoService.list(), []);
  const { synced, yourRepos, loading, refreshUserRepos, desync } =
    useRoadmapCatalog();
  const { isSignedIn, getToken } = useAuth();
  const [publicRepos, setPublicRepos] = useState<RoadmapResponseBody[]>([]);
  const [publicMeta, setPublicMeta] = useState<{
    total_count: number;
    page: number;
    total_pages: number;
  } | null>(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [isCheckingGithub, setIsCheckingGithub] = useState(false);
  const [syncingRepo, setSyncingRepo] = useState<string | null>(null);
  const [desyncingRepo, setDesyncingRepo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const checkStatus = async () => {
      if (!(isSignedIn && getToken)) {
        setGithubConnected(false);
        return;
      }
      setIsCheckingGithub(true);
      const token = await getToken();
      const response = await githubService.status(token ?? undefined);
      if (!cancelled) {
        setGithubConnected(Boolean(response.ok && response.data?.connected));
        setIsCheckingGithub(false);
      }
    };
    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  const backendConfigured = repoService.isBackendConfigured();

  useEffect(() => {
    if (!backendConfigured) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setPublicLoading(true);
      const response = await repoService.listCatalog(1, 50);
      if (cancelled) {
        return;
      }
      if (response.ok && response.data) {
        setPublicRepos(response.data.items);
        setPublicMeta({
          total_count: response.data.total_count,
          page: response.data.page,
          total_pages: response.data.total_pages,
        });
        setPublicError(null);
      } else {
        setPublicError(response.error ?? "Unable to load public catalog.");
      }
      setPublicLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [backendConfigured]);

  const syncedMap = useMemo(
    () => new Map(synced.map((repo) => [repo.repo.full_name, repo])),
    [synced]
  );

  const nowIso = useMemo(() => new Date().toISOString(), []);

  const userRepoList = useMemo(
    () =>
      yourRepos
        .filter((repo) => !repo.is_archived && repo.repo)
        .map((repo) => {
          const identity = repoService.buildIdentityFromFullName(
            repo.repo_full_name
          );
          return { ...repo, repo: repo.repo, slug: identity.slug };
        }),
    [yourRepos]
  );

  const syncedMatches = useMemo(() => {
    if (!query.trim()) {
      return userRepoList;
    }
    const lower = query.toLowerCase();
    return userRepoList.filter((repo) => {
      const summary = repo.repo.description?.toLowerCase() ?? "";
      return (
        repo.repo.full_name.toLowerCase().includes(lower) ||
        summary.includes(lower)
      );
    });
  }, [userRepoList, query]);

  const filteredRepos = useMemo(
    () =>
      repoList.filter((repo) => {
        const matchesQuery =
          repo.name.toLowerCase().includes(query.toLowerCase()) ||
          repo.description.toLowerCase().includes(query.toLowerCase());
        const matchesDifficulty =
          difficulty === "all" || repo.difficulty === difficulty;
        return matchesQuery && matchesDifficulty;
      }),
    [query, difficulty, repoList]
  );

  const publicRepoList = useMemo(() => {
    if (!backendConfigured) {
      return filteredRepos.map(mapStaticRecordToRoadmap);
    }
    return publicRepos;
  }, [backendConfigured, filteredRepos, publicRepos]);

  const handleImplement = async (fullName: string) => {
    if (!(isSignedIn && githubConnected)) {
      return;
    }
    const identity = repoService.buildIdentityFromFullName(fullName);
    setSyncingRepo(identity.slug);
    const token = await getToken?.();
    const response = await repoService.syncRepo(
      identity.owner,
      identity.repoName,
      token ?? undefined
    );
    if (response.ok) {
      await refreshUserRepos();
    } else {
      setPublicError(response.error ?? "Unable to sync repository.");
    }
    setSyncingRepo(null);
  };

  const handleDesync = async (fullName: string) => {
    if (!isSignedIn) {
      return;
    }
    setDesyncingRepo(fullName);
    const success = await desync(fullName);
    if (success) {
      await refreshUserRepos();
    }
    setDesyncingRepo(null);
  };

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-10 lg:px-16">
      <div className="space-y-2">
        <p className="font-medium text-primary text-sm uppercase tracking-[0.3em]">
          Repo directory
        </p>
        <h1 className="font-semibold text-3xl">Search repositories</h1>
        <p className="text-base text-muted-foreground">
          Filter by difficulty, language, or keywords to jump into an existing
          timeline.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-black/25 shadow-xl backdrop-blur-lg">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              className="border-0 bg-transparent text-base focus-visible:ring-0"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="deepseek, ncnn, microsoft/vscode..."
              value={query}
            />
          </div>
          <div className="flex gap-2">
            {(["all", "beginner", "intermediate", "advanced"] as const).map(
              (level) => (
                <Button
                  className="capitalize"
                  key={level}
                  onClick={() => setDifficulty(level)}
                  variant={difficulty === level ? "secondary" : "ghost"}
                >
                  {level}
                </Button>
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Filter className="h-4 w-4" />
          Showing {filteredRepos.length} public repositories
        </div>
      </div>

      {!!syncedMatches.length && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Your repositories</h2>
            {loading && (
              <p className="text-muted-foreground text-xs">Refreshing…</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {syncedMatches.map((repo) => (
              <Card
                className="flex flex-col border-border/60 bg-card/70 shadow-black/20 shadow-lg"
                key={repo.slug}
              >
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl">
                      {repo.repo.full_name}
                    </CardTitle>
                    <Badge
                      className="text-xs uppercase tracking-wide"
                      variant="outline"
                    >
                      {syncedMap.get(repo.repo_full_name)?.timeline.length ?? 0}{" "}
                      stages
                    </Badge>
                  </div>
                  <CardDescription>{repo.repo.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-4 text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    <span>
                      {repo.repo.language ?? "Unknown"} •{" "}
                      {new Date(
                        syncedMap.get(repo.repo_full_name)?.generated_at ??
                          nowIso
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild className="flex-1" variant="secondary">
                      <Link href={`/repo/${repo.slug}/timeline`}>
                        Open timeline
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          className="flex-1"
                          disabled={desyncingRepo === repo.repo_full_name}
                          variant="outline"
                        >
                          {desyncingRepo === repo.repo_full_name
                            ? "Desyncing…"
                            : "Desync"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Desync this repository?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to desync? This removes your
                            personal implementation state. The public timeline
                            will remain available.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={desyncingRepo === repo.repo_full_name}
                            onClick={() => handleDesync(repo.repo_full_name)}
                          >
                            Confirm desync
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Public repositories</h2>
          {publicLoading && (
            <p className="text-muted-foreground text-xs">Loading…</p>
          )}
          {publicMeta && (
            <p className="text-muted-foreground text-xs">
              Page {publicMeta.page} of {publicMeta.total_pages} •{" "}
              {publicMeta.total_count} total
            </p>
          )}
        </div>
        {publicError && (
          <p className="text-destructive text-sm">{publicError}</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {publicRepoList.map((repo) => {
            const identity = repoService.buildIdentityFromFullName(
              repo.repo.full_name
            );
            const isSynced = yourRepos.some(
              (item) => item.repo_full_name === repo.repo.full_name
            );
            return (
              <Card
                className="flex flex-col border-border/60 bg-card/70 shadow-black/20 shadow-lg"
                key={identity.slug}
              >
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl">
                      {repo.repo.full_name}
                    </CardTitle>
                    <Badge
                      className="text-xs uppercase tracking-wide"
                      variant="outline"
                    >
                      {repo.timeline.length} stages
                    </Badge>
                  </div>
                  <CardDescription>{repo.repo.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-4 text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    <span>
                      {repo.repo.language ??
                        repo.repo.primary_language ??
                        "Unknown"}
                      {repo.repo.star_count
                        ? ` • ${repo.repo.star_count}★`
                        : ""}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild className="flex-1" variant="secondary">
                      <Link href={`/repo/${identity.slug}/timeline`}>
                        Open timeline
                      </Link>
                    </Button>
                    {isSignedIn && githubConnected && !isSynced && (
                      <Button
                        className="flex-1"
                        disabled={
                          syncingRepo === identity.slug || isCheckingGithub
                        }
                        onClick={() => handleImplement(repo.repo.full_name)}
                      >
                        {syncingRepo === identity.slug
                          ? "Syncing…"
                          : "Implement"}
                      </Button>
                    )}
                    {isSignedIn && isSynced && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            className="flex-1"
                            disabled={desyncingRepo === repo.repo.full_name}
                            variant="outline"
                          >
                            {desyncingRepo === repo.repo.full_name
                              ? "Desyncing…"
                              : "Desync"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Desync this repository?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to desync? This removes your
                              personal implementation state. The public timeline
                              will remain available.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={desyncingRepo === repo.repo.full_name}
                              onClick={() => handleDesync(repo.repo.full_name)}
                            >
                              Confirm desync
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
