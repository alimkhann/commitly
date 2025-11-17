"use client";

import { useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  ChevronLeft,
  GitBranch,
  Hammer,
  Loader2,
  Search,
  Unlink,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  type RoadmapResponseBody,
  type RoadmapSummary,
  repoService,
  type UserRepoState,
} from "@/lib/services/repos";
import { cn } from "@/lib/utils";
import AccountSection from "./account-section";

export default function Sidebar() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const { synced, pending, yourRepos, loading, desync, refreshUserRepos } =
    useRoadmapCatalog();
  const [collapsed, setCollapsed] = useState(false);
  const [desyncingRepo, setDesyncingRepo] = useState<string | null>(null);
  const toggleCollapse = () => setCollapsed((prev) => !prev);

  const activeRepoId = useMemo(() => {
    if (!pathname) {
      return null;
    }
    const segments = pathname.split("/");
    return segments[1] === "repo" ? (segments[2] ?? null) : null;
  }, [pathname]);

  const userReposToRender = useMemo(
    () => yourRepos.filter((repo) => !repo.is_archived),
    [yourRepos]
  );

  const sidebarRows = useMemo(
    () => (userReposToRender.length > 0 ? userReposToRender : synced),
    [synced, userReposToRender]
  );

  const syncedMap = useMemo(
    () => new Map(synced.map((item) => [item.fullName, item])),
    [synced]
  );

  const aggregatedRows = useMemo<AggregatedSidebarRow[]>(() => {
    const rows = [...pending, ...sidebarRows];
    return rows.map((item) => {
      if ("repo_full_name" in item) {
        const identity = repoService.buildIdentityFromFullName(
          item.repo_full_name
        );
        const syncedMatch = syncedMap.get(identity.fullName) ?? null;
        const summary =
          (item.repo as RoadmapSummary | null) ?? syncedMatch?.repo ?? null;
        const pendingStatus = (item.status ?? "synced") === "pending";
        return {
          slug: identity.slug,
          fullName: identity.fullName,
          description:
            summary?.description ?? syncedMatch?.repo.description ?? null,
          language:
            summary?.language ??
            summary?.primary_language ??
            syncedMatch?.repo.language ??
            null,
          generatedAt:
            syncedMatch?.generated_at ??
            ((item as UserRepoState).pinned_at ?? null),
          stageCount: syncedMatch?.timeline.length ?? 0,
          status: item.status ?? "synced",
          pending: pendingStatus,
          repoFullName: identity.fullName,
        } satisfies AggregatedSidebarRow;
      }
      const identity = {
        slug: item.slug,
        fullName: item.fullName,
      };
      const syncedMatch = syncedMap.get(identity.fullName) ?? null;
      const pendingFlag = Boolean((item as { pending?: boolean }).pending);
      return {
        slug: identity.slug,
        fullName: identity.fullName,
        description: syncedMatch?.repo.description ?? null,
        language: syncedMatch?.repo.language ?? null,
        generatedAt: syncedMatch?.generated_at ?? null,
        stageCount: syncedMatch?.timeline.length ?? 0,
        status: pendingFlag ? "pending" : "synced",
        pending: pendingFlag,
        repoFullName: identity.fullName,
      } satisfies AggregatedSidebarRow;
    });
  }, [pending, sidebarRows, syncedMap]);

  const handleDesync = useCallback(
    async (fullName: string) => {
      if (!isSignedIn) {
        return;
      }
      setDesyncingRepo(fullName);
      const success = await desync(fullName);
      if (success) {
        await refreshUserRepos();
      }
      setDesyncingRepo(null);
    },
    [desync, isSignedIn, refreshUserRepos]
  );

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
          <div className="flex w-full items-center justify-between">
            <button
              aria-label="Home"
              className="group relative flex h-14 w-14 items-center justify-center rounded-xl transition-colors hover:bg-muted/30"
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false);
                } else {
                  window.location.href = "/";
                }
              }}
              type="button"
            >
              <div className="relative h-16 w-16">
                <Image
                  alt="commitly"
                  className={cn(
                    "rounded-lg object-contain transition-opacity duration-150",
                    collapsed && "group-hover:opacity-0"
                  )}
                  fill
                  src="/logos/logo_4x.png"
                />
              </div>
              {collapsed && (
                <ChevronLeft className="absolute h-4 w-4 rotate-180 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              )}
            </button>
            {!collapsed && (
              <Button
                aria-label="Collapse sidebar"
                className="h-9 w-9"
                onClick={toggleCollapse}
                size="icon"
                variant="ghost"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Button
            asChild
            className={cn(
              "h-14 w-full justify-start gap-3 rounded-xl border border-white/10 bg-white/10 text-base text-white transition-colors hover:bg-white/15",
              collapsed && "justify-center px-0"
            )}
            size="lg"
          >
            <Link href="/">
              <Hammer className={cn("h-5 w-5", collapsed && "h-6 w-6")} />
              {!collapsed && <span>New repo timeline</span>}
            </Link>
          </Button>
          <Button
            asChild
            className={cn(
              "h-14 w-full justify-start gap-3 rounded-xl border border-white/5 bg-white/5 text-base text-white/90 transition-colors hover:bg-white/10",
              collapsed && "justify-center px-0"
            )}
            size="lg"
            variant="secondary"
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
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Your repositories
              </p>
              {loading && (
                <Badge className="font-normal text-[11px]" variant="outline">
                  Loading…
                </Badge>
              )}
            </div>
            <ScrollArea className="h-full max-h-[45vh]">
              <div className="flex flex-col gap-2 pr-3">
                {aggregatedRows.length === 0 && !loading ? (
                  <div className="rounded-xl border border-border/50 bg-card/10 px-4 py-6 text-muted-foreground text-sm">
                    Generate a roadmap to pin it here.
                  </div>
                ) : (
                  aggregatedRows.map((row) => (
                    <SidebarRepoRow
                      collapsed={collapsed}
                      desyncingRepo={desyncingRepo}
                      isActive={activeRepoId === row.slug}
                      isSignedIn={isSignedIn}
                      key={row.slug}
                      onDesync={handleDesync}
                      row={row}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
      <AccountSection isCollapsed={collapsed} />
    </div>
  );
}

type AggregatedSidebarRow = {
  slug: string;
  fullName: string;
  description: string | null;
  language: string | null;
  generatedAt: string | null;
  stageCount: number;
  status: string;
  pending: boolean;
  repoFullName: string;
};

function SidebarRepoRow({
  row,
  isActive,
  collapsed,
  onDesync,
  desyncingRepo,
  isSignedIn,
}: {
  row: AggregatedSidebarRow;
  isActive: boolean;
  collapsed: boolean;
  onDesync: (fullName: string) => void | Promise<void>;
  desyncingRepo: string | null;
  isSignedIn: boolean;
}) {
  const { slug, fullName, description, language, generatedAt, stageCount, status, pending, repoFullName } =
    row;
  const desyncDisabled = desyncingRepo === repoFullName;

  return (
    <div
      className={cn(
        "group rounded-xl border border-white/5 bg-card/15 px-3 py-3 backdrop-blur-sm transition-colors",
        isActive
          ? "border-primary/70 bg-primary/15"
          : "hover:border-white/10 hover:bg-card/25"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <Link href={`/repo/${slug}/timeline`}>
            <p className="font-medium text-sm leading-tight">{fullName}</p>
          </Link>
          <p className="text-muted-foreground text-xs">
            {pending
              ? "Generating timeline…"
              : [
                  language,
                  generatedAt &&
                    new Date(generatedAt).toLocaleDateString(),
                ]
                  .filter(Boolean)
                  .join(" • ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className="text-[11px] capitalize"
            variant={status === "synced" ? "accent" : "secondary"}
          >
            {status}
          </Badge>
          {!pending && (
            <Badge
              className="text-[11px] capitalize"
              variant={isActive ? "accent" : "outline"}
            >
              {stageCount} stages
            </Badge>
          )}
        </div>
      </div>
      {!pending && description && (
        <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
          {description}
        </p>
      )}
      {!collapsed && (
        <div className="mt-3 flex items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link aria-label="Open timeline" href={`/repo/${slug}/timeline`}>
              <GitBranch className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="icon" variant="ghost">
            <Link aria-label="Open guide" href={`/repo/${slug}/guide`}>
              <BookOpen className="h-4 w-4" />
            </Link>
          </Button>
          {isSignedIn && !pending && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  aria-label="Desync repository"
                  disabled={desyncDisabled}
                  size="icon"
                  variant="ghost"
                >
                  {desyncDisabled ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desync this repository?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes your personal implementation state. The public
                    timeline will remain available.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={desyncDisabled}
                    onClick={() => onDesync(repoFullName)}
                  >
                    Confirm desync
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  );
}
