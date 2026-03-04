"use client";

import { Eye, Filter, GitBranch, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type RoadmapResponseBody, repoService } from "@/lib/services/repos";

export default function SearchPage() {
  const { t } = usePreferences();
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<
    "all" | "intro" | "easy" | "medium" | "hard"
  >("all");
  const [sortBy, setSortBy] = useState<
    "newest" | "most_viewed" | "most_synced" | "highest_rated" | "trending"
  >("newest");
  const { synced, yourRepos, loading } = useRoadmapCatalog();
  const [publicRepos, setPublicRepos] = useState<RoadmapResponseBody[]>([]);
  const [publicMeta, setPublicMeta] = useState<{
    total_count: number;
    page: number;
    total_pages: number;
  } | null>(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);

  const backendConfigured = repoService.isBackendConfigured();
  const normalizedQuery = query.trim().toLowerCase();
  const quickTestRepos = [
    "vercel/ms",
    "sindresorhus/ky",
    "upstash/redis-js",
    "umami-software/umami",
    "dubinc/dub",
    "calcom/cal.com",
  ];

  const matchesDifficulty = (
    candidate: string | null | undefined,
    selected: "all" | "intro" | "easy" | "medium" | "hard"
  ) => {
    if (selected === "all") {
      return true;
    }
    return String(candidate ?? "").toLowerCase() === selected;
  };

  useEffect(() => {
    if (!backendConfigured) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setPublicLoading(true);
      const response = await repoService.listCatalog({
        page: 1,
        page_size: 50,
        sort: sortBy,
        difficulty: difficulty !== "all" ? difficulty : undefined,
      });
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
  }, [backendConfigured, sortBy, difficulty]);

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
    return userRepoList.filter((repo) => {
      if (!repo.repo) {
        return false;
      }
      if (!matchesDifficulty(repo.repo.difficulty, difficulty)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const summary = repo.repo.description?.toLowerCase() ?? "";
      return (
        repo.repo.full_name.toLowerCase().includes(normalizedQuery) ||
        summary.includes(normalizedQuery)
      );
    });
  }, [userRepoList, difficulty, normalizedQuery]);

  const publicRepoList = useMemo(() => {
    if (!backendConfigured) {
      return [];
    }
    return publicRepos.filter((repo) => {
      if (!matchesDifficulty(repo.repo.difficulty, difficulty)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const fullName = repo.repo.full_name.toLowerCase();
      const description = (repo.repo.description ?? "").toLowerCase();
      return fullName.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }, [backendConfigured, difficulty, normalizedQuery, publicRepos]);

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-10 lg:px-16">
      <div className="space-y-2">
        <p className="font-medium text-primary text-sm uppercase tracking-[0.3em]">
          {t("roadmap_catalog", "Roadmap catalog")}
        </p>
        <h1 className="font-semibold text-3xl">{t("search_roadmaps_title", "Search roadmaps")}</h1>
        <p className="text-base text-muted-foreground">
          {t(
            "search_roadmaps_subtitle",
            "Filter by difficulty, language, or keywords to find a roadmap and start reading immediately."
          )}
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border/70 bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              className="border-0 bg-transparent text-base focus-visible:ring-0"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="deepseek, ncnn, microsoft/vscode..."
              value={query}
            />
          </div>
          <div className="flex gap-2">
            {(["all", "intro", "easy", "medium", "hard"] as const).map(
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Filter className="h-4 w-4" />
            {t("public_results", "Showing public roadmaps")}: {publicRepoList.length}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">{t("sort_by", "Sort by")}:</span>
            <Select
              onValueChange={(value: string) =>
                setSortBy(value as typeof sortBy)
              }
              value={sortBy}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="trending">Trending</SelectItem>
                <SelectItem value="most_viewed">Most viewed</SelectItem>
                <SelectItem value="most_synced">Most saved</SelectItem>
                <SelectItem value="highest_rated">Highest rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm">{t("quick_test_repos", "Quick test repos")}</p>
          <p className="text-muted-foreground text-xs">
            GitHub examples for generation QA
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickTestRepos.map((repo) => {
            const slug = repo.replace("/", "-");
            const repoUrl = `https://github.com/${repo}`;
            return (
              <Button
                asChild
                className="h-8 rounded-lg px-3 text-xs"
                key={repo}
                variant="outline"
              >
                <Link
                  href={`/repo/${slug}?view=timeline&fullName=${encodeURIComponent(repo)}&repoUrl=${encodeURIComponent(repoUrl)}&intent=generate`}
                >
                  {repo}
                </Link>
              </Button>
            );
          })}
        </div>
      </section>

      {!!syncedMatches.length && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">{t("your_library", "Your library")}</h2>
            {loading && (
              <p className="text-muted-foreground text-xs">{t("loading", "Loading…")}</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {syncedMatches.map((repo) => (
              <Card
                className="flex flex-col border-border/70 bg-card"
                key={repo.slug}
              >
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl">
                      {repo.repo?.full_name ?? repo.repo_full_name}
                    </CardTitle>
                    <Badge
                      className="text-xs uppercase tracking-wide"
                      variant="outline"
                    >
                      {syncedMap.get(repo.repo_full_name)?.timeline.length ?? 0}{" "}
                      stages
                    </Badge>
                  </div>
                  <CardDescription>
                    {repo.repo?.description ?? "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-4 text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                      <span>
                      {repo.repo?.language ?? t("language_unknown", "Unknown")} •{" "}
                      {new Date(
                        syncedMap.get(repo.repo_full_name)?.generated_at ??
                          nowIso
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild className="w-full" variant="secondary">
                      <Link
                        href={`/repo/${repo.slug}?view=timeline&fullName=${repo.repo?.full_name ?? repo.repo_full_name}`}
                      >
                        Read roadmap
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">{t("public_catalog", "Public catalog")}</h2>
          {publicLoading && (
            <p className="text-muted-foreground text-xs">{t("loading", "Loading…")}</p>
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
        {!publicLoading && !publicError && publicRepoList.length === 0 && (
          <div className="rounded-xl border border-border/70 bg-card p-5 text-muted-foreground text-sm">
            <p>{t("no_results", "No results for your current filters.")}</p>
            <Button
              className="mt-3"
              onClick={() => {
                setDifficulty("all");
                setQuery("");
              }}
              size="sm"
              variant="outline"
            >
              {t("clear_filters", "Clear filters")}
            </Button>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {publicRepoList.map((repo) => {
            const identity = repoService.buildIdentityFromFullName(
              repo.repo.full_name
            );
            return (
              <Card
                className="flex flex-col border-border/70 bg-card"
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
                  <div className="flex flex-col gap-2">
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
                    <div className="flex items-center gap-4">
                      {repo.repo?.view_count !== undefined &&
                        repo.repo.view_count !== null &&
                        repo.repo.view_count > 0 && (
                          <div className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            <span className="text-xs">
                              {repo.repo.view_count}
                            </span>
                          </div>
                        )}
                      {repo.repo?.sync_count !== undefined &&
                        repo.repo.sync_count !== null &&
                        repo.repo.sync_count > 0 && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            <span className="text-xs">
                              {repo.repo.sync_count}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild className="w-full" variant="secondary">
                      <Link
                        href={`/repo/${identity.slug}?view=timeline&fullName=${repo.repo.full_name}`}
                      >
                        Read roadmap
                      </Link>
                    </Button>
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
