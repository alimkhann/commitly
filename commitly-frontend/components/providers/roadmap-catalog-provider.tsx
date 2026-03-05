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
  archivedRepos: UserRepoState[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshUserRepos: () => Promise<void>;
  refreshArchivedRepos: () => Promise<void>;
  upsertRoadmap: (roadmap: RoadmapResponseBody, shouldSync?: boolean) => void;
  markPending: (identity: RepoIdentity) => void;
  getBySlug: (slug: string) => SyncedRepoRecord | PendingRepoRecord | undefined;
  desync: (fullName: string) => Promise<boolean>;
  archive: (fullName: string) => Promise<boolean>;
  unarchive: (fullName: string) => Promise<boolean>;
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
  const [archivedRepos, setArchivedRepos] = useState<UserRepoState[]>([]);
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
      if (cancelled) {
        return;
      }
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

  const refreshArchivedRepos = useCallback(async () => {
    if (!(backendConfigured && isSignedIn)) {
      setArchivedRepos([]);
      return;
    }
    const token = await getToken?.();
    const response = await repoService.listArchivedRepos(token ?? undefined);
    if (response.ok && response.data) {
      setArchivedRepos(response.data);
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

  const archive = useCallback(
    async (fullName: string) => {
      if (!(backendConfigured && isSignedIn)) {
        return false;
      }
      const identity = repoService.buildIdentityFromFullName(fullName);
      const token = await getToken?.();
      const response = await repoService.archiveRepo(
        identity.owner,
        identity.repoName,
        token ?? undefined
      );
      if (response.ok && response.data) {
        setYourRepos((prev) =>
          prev.map((item) =>
            item.repo_full_name === fullName
              ? { ...item, is_archived: true }
              : item
          )
        );
        if (response.data) {
          const updatedRepo = response.data;
          setArchivedRepos((prev) => {
            const exists = prev.some(
              (item) => item.repo_full_name === fullName
            );
            if (exists) {
              return prev.map((item) =>
                item.repo_full_name === fullName ? updatedRepo : item
              );
            }
            return [updatedRepo, ...prev];
          });
        }
        return true;
      }
      return false;
    },
    [backendConfigured, getToken, isSignedIn]
  );

  const unarchive = useCallback(
    async (fullName: string) => {
      if (!(backendConfigured && isSignedIn)) {
        return false;
      }
      const identity = repoService.buildIdentityFromFullName(fullName);
      const token = await getToken?.();
      const response = await repoService.unarchiveRepo(
        identity.owner,
        identity.repoName,
        token ?? undefined
      );
      if (response.ok && response.data) {
        setArchivedRepos((prev) =>
          prev.filter((item) => item.repo_full_name !== fullName)
        );
        if (response.data) {
          const updatedRepo = response.data;
          setYourRepos((prev) => {
            const exists = prev.some(
              (item) => item.repo_full_name === fullName
            );
            if (exists) {
              return prev.map((item) =>
                item.repo_full_name === fullName ? updatedRepo : item
              );
            }
            return [updatedRepo, ...prev];
          });
        }
        return true;
      }
      return false;
    },
    [backendConfigured, getToken, isSignedIn]
  );

  useEffect(() => {
    if (!(backendConfigured && isSignedIn)) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      refreshUserRepos().catch(() => {
        // Error handling is done in the function
      });
      refreshArchivedRepos().catch(() => {
        // Error handling is done in the function
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [backendConfigured, isSignedIn, refreshUserRepos, refreshArchivedRepos]);

  const upsertRoadmap = useCallback(
    (roadmap: RoadmapResponseBody, shouldSync = false) => {
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
        if (!isSignedIn) {
          return previous;
        }

        const idx = previous.findIndex(
          (item) => item.repo_full_name === roadmap.repo.full_name
        );

        if (idx >= 0) {
          const clone = [...previous];
          clone[idx] = {
            ...clone[idx],
            repo: roadmap.repo,
          };
          return clone;
        }

        if (shouldSync) {
          const next: UserRepoState = {
            repo_full_name: roadmap.repo.full_name,
            status: "synced",
            is_archived: false,
            progress_percent: 0,
            pinned_at: new Date().toISOString(),
            repo: roadmap.repo,
          };
          return [next, ...previous];
        }

        return previous;
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
      archivedRepos,
      loading,
      error,
      refresh,
      refreshUserRepos,
      refreshArchivedRepos,
      upsertRoadmap,
      markPending,
      getBySlug,
      desync,
      archive,
      unarchive,
    }),
    [
      synced,
      pending,
      yourRepos,
      archivedRepos,
      loading,
      error,
      refresh,
      refreshUserRepos,
      refreshArchivedRepos,
      upsertRoadmap,
      markPending,
      getBySlug,
      desync,
      archive,
      unarchive,
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
