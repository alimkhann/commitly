"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  repoService,
  type RepoIdentity,
  type RoadmapResponseBody,
} from "@/lib/services/repos"

type SyncedRepoRecord = RoadmapResponseBody & RepoIdentity & { pending?: false }
type PendingRepoRecord = RepoIdentity & { pending: true }

type CatalogContextValue = {
  synced: SyncedRepoRecord[]
  pending: PendingRepoRecord[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  upsertRoadmap: (roadmap: RoadmapResponseBody) => void
  markPending: (identity: RepoIdentity) => void
  getBySlug: (slug: string) => SyncedRepoRecord | PendingRepoRecord | undefined
}

const RoadmapCatalogContext = createContext<CatalogContextValue | undefined>(undefined)

const toSyncedRecord = (roadmap: RoadmapResponseBody): SyncedRepoRecord => {
  const identity = repoService.buildIdentityFromFullName(roadmap.repo.full_name)
  return {
    ...identity,
    ...roadmap,
    pending: false,
  }
}

export function RoadmapCatalogProvider({ children }: { children: ReactNode }) {
  const [synced, setSynced] = useState<SyncedRepoRecord[]>([])
  const [pending, setPending] = useState<PendingRepoRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const backendConfigured = repoService.isBackendConfigured()

  useEffect(() => {
    if (!backendConfigured) {
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const response = await repoService.listCatalog()
      if (cancelled) return
      if (response.ok && response.data) {
        setSynced(response.data.map(toSyncedRecord))
        setError(null)
      } else {
        setError(response.error ?? "Unable to load roadmap catalog.")
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [backendConfigured])

  const refresh = useCallback(async () => {
    if (!backendConfigured) {
      setSynced([])
      setError(null)
      return
    }
    setLoading(true)
    const response = await repoService.listCatalog()
    if (response.ok && response.data) {
      setSynced(response.data.map(toSyncedRecord))
      setError(null)
    } else {
      setError(response.error ?? "Unable to load roadmap catalog.")
    }
    setLoading(false)
  }, [backendConfigured])

  const upsertRoadmap = useCallback((roadmap: RoadmapResponseBody) => {
    setSynced((previous) => {
      const nextRecord = toSyncedRecord(roadmap)
      const index = previous.findIndex((item) => item.fullName === nextRecord.fullName)
      if (index >= 0) {
        const clone = [...previous]
        clone[index] = nextRecord
        return clone
      }
      return [nextRecord, ...previous]
    })
    setPending((previous) => previous.filter((item) => item.fullName !== roadmap.repo.full_name))
  }, [])

  const markPending = useCallback((identity: RepoIdentity) => {
    setPending((previous) => {
      if (previous.some((item) => item.slug === identity.slug)) {
        return previous
      }
      if (synced.some((item) => item.slug === identity.slug)) {
        return previous
      }
      return [{ ...identity, pending: true }, ...previous]
    })
  }, [synced])

  const getBySlug = useCallback(
    (slug: string) =>
      synced.find((item) => item.slug === slug) ?? pending.find((item) => item.slug === slug),
    [synced, pending]
  )

  const value = useMemo<CatalogContextValue>(
    () => ({ synced, pending, loading, error, refresh, upsertRoadmap, markPending, getBySlug }),
    [synced, pending, loading, error, refresh, upsertRoadmap, markPending, getBySlug]
  )

  return (
    <RoadmapCatalogContext.Provider value={value}>{children}</RoadmapCatalogContext.Provider>
  )
}

export function useRoadmapCatalog() {
  const context = useContext(RoadmapCatalogContext)
  if (!context) {
    throw new Error("useRoadmapCatalog must be used within RoadmapCatalogProvider")
  }
  return context
}
