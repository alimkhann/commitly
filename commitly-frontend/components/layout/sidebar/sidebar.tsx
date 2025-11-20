"use client";

import { useAuth } from "@clerk/nextjs";
import {
  Archive,
  ChevronLeft,
  Hammer,
  Loader2,
  MoreHorizontal,
  Search,
  Unlink,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const {
    synced,
    pending,
    yourRepos,
    loading,
    desync,
    archive,
    refreshUserRepos,
  } = useRoadmapCatalog();
  const [collapsed, setCollapsed] = useState(false);
  const [desyncingRepo, setDesyncingRepo] = useState<string | null>(null);
  const [archivingRepo, setArchivingRepo] = useState<string | null>(null);
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

  const sidebarRows = useMemo<SidebarSourceRow[]>(
    () => (isSignedIn ? userReposToRender : synced),
    [isSignedIn, synced, userReposToRender]
  );

  const syncedMap = useMemo(
    () =>
      new Map<string, SyncedCatalogRecord>(
        synced.map((item) => [item.fullName, item])
      ),
    [synced]
  );

  const aggregatedRows = useMemo<AggregatedSidebarRow[]>(() => {
    const pendingRows = pending.map((record) =>
      mapPendingRecordToRow(record, syncedMap)
    );
    const syncedRows = sidebarRows.map((record) =>
      isUserRepoState(record)
        ? mapUserRepoToRow(record, syncedMap)
        : mapSyncedRecordToRow(record)
    );
    return [...pendingRows, ...syncedRows];
  }, [pending, sidebarRows, syncedMap]);

  const handleDesync = useCallback(
    async (fullName: string) => {
      if (!isSignedIn) {
        return;
      }
      setDesyncingRepo(fullName);
      await desync(fullName);
      setDesyncingRepo(null);
    },
    [desync, isSignedIn]
  );

  const handleArchive = useCallback(
    async (fullName: string) => {
      if (!isSignedIn) {
        return;
      }
      setArchivingRepo(fullName);
      await archive(fullName);
      setArchivingRepo(null);
    },
    [archive, isSignedIn]
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
                      archivingRepo={archivingRepo}
                      collapsed={collapsed}
                      desyncingRepo={desyncingRepo}
                      isActive={activeRepoId === row.slug}
                      isSignedIn={isSignedIn}
                      key={row.slug}
                      onArchive={handleArchive}
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

type SyncedCatalogRecord = RoadmapResponseBody & {
  fullName: string;
  slug: string;
  pending?: boolean;
};

type PendingSidebarRow = {
  fullName: string;
  slug: string;
  pending?: boolean;
};

type SidebarSourceRow = UserRepoState | SyncedCatalogRecord;

type SyncedMap = Map<string, SyncedCatalogRecord>;

const resolveLanguage = (summary?: RoadmapSummary | null) =>
  summary?.language ?? summary?.primary_language ?? null;

function mapUserRepoToRow(
  record: UserRepoState,
  syncedMap: SyncedMap
): AggregatedSidebarRow {
  const identity = repoService.buildIdentityFromFullName(record.repo_full_name);
  const syncedMatch = syncedMap.get(identity.fullName) ?? null;
  const summary =
    (record.repo as RoadmapSummary | null) ?? syncedMatch?.repo ?? null;
  const status = record.status ?? "synced";
  return {
    slug: identity.slug,
    fullName: identity.fullName,
    description: summary?.description ?? null,
    language: resolveLanguage(summary),
    generatedAt: syncedMatch?.generated_at ?? record.pinned_at ?? null,
    stageCount: syncedMatch?.timeline.length ?? 0,
    status,
    pending: status === "pending",
    repoFullName: identity.fullName,
  };
}

function mapSyncedRecordToRow(
  record: SyncedCatalogRecord
): AggregatedSidebarRow {
  const summary = record.repo;
  const status = record.pending ? "pending" : "synced";
  return {
    slug: record.slug,
    fullName: record.fullName,
    description: summary.description ?? null,
    language: resolveLanguage(summary),
    generatedAt: record.generated_at,
    stageCount: record.timeline.length,
    status,
    pending: Boolean(record.pending),
    repoFullName: summary.full_name,
  };
}

function mapPendingRecordToRow(
  record: PendingSidebarRow,
  syncedMap: SyncedMap
): AggregatedSidebarRow {
  const syncedMatch = syncedMap.get(record.fullName) ?? null;
  return {
    slug: record.slug,
    fullName: record.fullName,
    description: syncedMatch?.repo.description ?? null,
    language: resolveLanguage(syncedMatch?.repo ?? null),
    generatedAt: syncedMatch?.generated_at ?? null,
    stageCount: syncedMatch?.timeline.length ?? 0,
    status: "pending",
    pending: true,
    repoFullName: record.fullName,
  };
}

function isUserRepoState(value: SidebarSourceRow): value is UserRepoState {
  return "repo_full_name" in value;
}

function SidebarRepoRow({
  row,
  isActive,
  collapsed,
  onDesync,
  onArchive,
  desyncingRepo,
  archivingRepo,
  isSignedIn,
}: {
  row: AggregatedSidebarRow;
  isActive: boolean;
  collapsed: boolean;
  onDesync: (fullName: string) => void | Promise<void>;
  onArchive: (fullName: string) => void | Promise<void>;
  desyncingRepo: string | null;
  archivingRepo: string | null;
  isSignedIn: boolean;
}) {
  const { slug, fullName, pending, repoFullName } = row;
  const isDesyncing = desyncingRepo === repoFullName;
  const isArchiving = archivingRepo === repoFullName;
  const isLoading = isDesyncing || isArchiving;

  if (collapsed) {
    return (
      <div className="flex justify-center py-2">
        <Button
          asChild
          className={cn(
            "h-10 w-10 rounded-lg transition-all",
            isActive
              ? "bg-primary/20 text-primary"
              : "bg-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground"
          )}
          size="icon"
          variant="ghost"
        >
          <Link href={`/repo/${slug}/timeline`} title={fullName}>
            <span className="font-bold text-xs">
              {fullName.substring(0, 2).toUpperCase()}
            </span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Link
        className="flex-1 truncate pr-2"
        href={`/repo/${slug}/timeline`}
        title={fullName}
      >
        {fullName}
      </Link>

      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin opacity-50" />
      ) : (
        <div
          className={cn(
            "flex items-center opacity-0 transition-opacity group-hover:opacity-100",
            (isActive || isLoading) && "opacity-100"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-6 w-6 p-0 hover:bg-transparent"
                  size="icon"
                  variant="ghost"
                >
                  <MoreHorizontal className="h-3 w-3" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onArchive(repoFullName)}>
                  <Archive className="mr-2 h-3.5 w-3.5" />
                  Archive
                </DropdownMenuItem>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Unlink className="mr-2 h-3.5 w-3.5" />
                      Desync
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Desync this repository?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes your personal implementation state. The
                        public timeline will remain available.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDesync(repoFullName)}>
                        Confirm desync
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}
