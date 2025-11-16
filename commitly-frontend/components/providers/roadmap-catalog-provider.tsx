"use client";

import { useAuth } from "@clerk/nextjs";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type RepoIdentity,
  type RoadmapResponseBody,
  repoService,
  type UserRepoState,
} from "@/lib/services/repos";

type SyncedRepoRecord = RoadmapResponseBody &
  RepoIdentity & { pending?: false };
type PendingRepoRecord = RepoIdentity & { pending: true };

type CatalogContextValue = {
  synced: SyncedRepoRecord[];
  pending: PendingRepoRecord[];
  yourRepos: UserRepoState[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshUserRepos: () => Promise<void>;
  upsertRoadmap: (roadmap: RoadmapResponseBody) => void;
  markPending: (identity: RepoIdentity) => void;
  getBySlug: (slug: string) => SyncedRepoRecord | PendingRepoRecord | undefined;
  desync: (fullName: string) => Promise<boolean>;
};

const RoadmapCatalogContext = createContext<CatalogContextValue | undefined>(
  undefined
);

const toSyncedRecord = (roadmap: RoadmapResponseBody): SyncedRepoRecord => {
  const identity = repoService.buildIdentityFromFullName(
    roadmap.repo.full_name
  );
  return {
    ...identity,
    ...roadmap,
    pending: false,
  };
};

export function RoadmapCatalogProvider({ children }: { children: ReactNode }) {
  const [synced, setSynced] = useState<SyncedRepoRecord[]>([]);
  const [pending, setPending] = useState<PendingRepoRecord[]>([]);
  const [yourRepos, setYourRepos] = useState<UserRepoState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isSignedIn, getToken } = useAuth();

  const backendConfigured = repoService.isBackendConfigured();

  useEffect(() => {
    if (!backendConfigured) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const response = await repoService.listCatalog();
      if (cancelled) return;
      if (response.ok && response.data) {
        setSynced(response.data.items.map(toSyncedRecord));
        setError(null);
      } else {
        setError(response.error ?? "Unable to load roadmap catalog.");
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [backendConfigured]);

  const refresh = useCallback(async () => {
    if (!backendConfigured) {
      setSynced([]);
      setError(null);
      return;
    }
    setLoading(true);
    const response = await repoService.listCatalog();
    if (response.ok && response.data) {
      setSynced(response.data.items.map(toSyncedRecord));
      setError(null);
    } else {
      setError(response.error ?? "Unable to load roadmap catalog.");
    }
    setLoading(false);
  }, [backendConfigured]);

  const refreshUserRepos = useCallback(async () => {
    if (!(backendConfigured && isSignedIn)) {
      setYourRepos([]);
      return;
    }
    const token = await getToken?.();
    const response = await repoService.listUserRepos(token ?? undefined);
    if (response.ok && response.data) {
      setYourRepos(response.data);
    }
  }, [backendConfigured, getToken, isSignedIn]);

  const desync = useCallback(
    async (fullName: string) => {
      if (!(backendConfigured && isSignedIn)) {
        return false;
      }
      const identity = repoService.buildIdentityFromFullName(fullName);
      const token = await getToken?.();
      const response = await repoService.desyncRepo(
        identity.owner,
        identity.repoName,
        token ?? undefined
      );
      if (response.ok) {
        setYourRepos((prev) =>
          prev.filter((item) => item.repo_full_name !== fullName)
        );
        setSynced((prev) =>
          prev.filter((item) => item.repo.full_name !== fullName)
        );
        return true;
      }
      return false;
    },
    [backendConfigured, getToken, isSignedIn]
  );

  useEffect(() => {
    if (!(backendConfigured && isSignedIn)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUserRepos();
  }, [backendConfigured, isSignedIn, refreshUserRepos]);

  const upsertRoadmap = useCallback(
    (roadmap: RoadmapResponseBody) => {
      setSynced((previous) => {
        const nextRecord = toSyncedRecord(roadmap);
        const index = previous.findIndex(
          (item) => item.fullName === nextRecord.fullName
        );
        if (index >= 0) {
          const clone = [...previous];
          clone[index] = nextRecord;
          return clone;
        }
        return [nextRecord, ...previous];
      });
      setPending((previous) =>
        previous.filter((item) => item.fullName !== roadmap.repo.full_name)
      );
      setYourRepos((previous) => {
        if (!isSignedIn) return previous;
        const next: UserRepoState = {
          repo_full_name: roadmap.repo.full_name,
          status: "synced",
          is_archived: false,
          progress_percent: 0,
          pinned_at: new Date().toISOString(),
          repo: roadmap.repo,
        };
        const idx = previous.findIndex(
          (item) => item.repo_full_name === roadmap.repo.full_name
        );
        if (idx >= 0) {
          const clone = [...previous];
          clone[idx] = next;
          return clone;
        }
        return [next, ...previous];
      });
    },
    [isSignedIn]
  );

  const markPending = useCallback(
    (identity: RepoIdentity) => {
      setPending((previous) => {
        if (previous.some((item) => item.slug === identity.slug)) {
          return previous;
        }
        if (synced.some((item) => item.slug === identity.slug)) {
          return previous;
        }
        return [{ ...identity, pending: true }, ...previous];
      });
    },
    [synced]
  );

  const getBySlug = useCallback(
    (slug: string) =>
      synced.find((item) => item.slug === slug) ??
      pending.find((item) => item.slug === slug),
    [synced, pending]
  );

  const value = useMemo<CatalogContextValue>(
    () => ({
      synced,
      pending,
      yourRepos,
      loading,
      error,
      refresh,
      refreshUserRepos,
      upsertRoadmap,
      markPending,
      getBySlug,
      desync,
    }),
    [
      synced,
      pending,
      yourRepos,
      loading,
      error,
      refresh,
      refreshUserRepos,
      upsertRoadmap,
      markPending,
      getBySlug,
      desync,
    ]
  );

  return (
    <RoadmapCatalogContext.Provider value={value}>
      {children}
    </RoadmapCatalogContext.Provider>
  );
}

export function useRoadmapCatalog() {
  const context = useContext(RoadmapCatalogContext);
  if (!context) {
    throw new Error(
      "useRoadmapCatalog must be used within RoadmapCatalogProvider"
    );
  }
  return context;
}
