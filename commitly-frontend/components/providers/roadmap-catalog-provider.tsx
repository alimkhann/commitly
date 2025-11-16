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
import { useAuth } from "@clerk/nextjs"

import {
  repoService,
  type CatalogQueryParams,
  type PaginatedPublicCatalog,
  type RepoIdentity,
  type UserRepoState,
} from "@/lib/services/repos"

export type PendingRepoRecord = RepoIdentity & { pending: true }

export type CatalogContextValue = {
  catalog: PaginatedPublicCatalog | null
  catalogParams: CatalogQueryParams
  catalogLoading: boolean
  userReposLoading: boolean
  yourRepos: UserRepoState[]
  archivedRepos: UserRepoState[]
  pending: PendingRepoRecord[]
  error: string | null
  refreshCatalog: (params?: CatalogQueryParams) => Promise<void>
  refreshUserRepos: () => Promise<void>
  markPending: (identity: RepoIdentity) => void
  clearPending: (fullName: string) => void
  getRepoBySlug: (slug: string) => UserRepoState | PendingRepoRecord | undefined
  syncRepo: (identity: RepoIdentity, authToken?: string) => Promise<void>
  desyncRepo: (identity: RepoIdentity, authToken?: string) => Promise<void>
  archiveRepo: (identity: RepoIdentity, authToken?: string) => Promise<void>
  unarchiveRepo: (identity: RepoIdentity, authToken?: string) => Promise<void>
}

const RoadmapCatalogContext = createContext<CatalogContextValue | undefined>(undefined)

const slugFromFullName = (fullName: string) => fullName.replace("/", "-")

export function RoadmapCatalogProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth()
  const backendConfigured = repoService.isBackendConfigured()

  const [catalog, setCatalog] = useState<PaginatedPublicCatalog | null>(null)
  const [catalogParams, setCatalogParams] = useState<CatalogQueryParams>({ page: 1, pageSize: 12 })
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [userReposLoading, setUserReposLoading] = useState(false)
  const [yourRepos, setYourRepos] = useState<UserRepoState[]>([])
  const [archivedRepos, setArchivedRepos] = useState<UserRepoState[]>([])
  const [pending, setPending] = useState<PendingRepoRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  const refreshCatalog = useCallback(async (params?: CatalogQueryParams) => {
    if (!backendConfigured) {
      setCatalog(null)
      return
    }
    setCatalogLoading(true)
    const nextParams: CatalogQueryParams = { ...catalogParams }
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        const typedKey = key as keyof CatalogQueryParams
        if (value === undefined || value === null) {
          delete nextParams[typedKey]
          continue
        }
        if (Array.isArray(value)) {
          if (value.length === 0) {
            delete nextParams[typedKey]
          } else {
            nextParams[typedKey] = value as never
          }
          continue
        }
        nextParams[typedKey] = value as never
      }
    }
    const response = await repoService.listCatalog(nextParams)
    if (response.ok && response.data) {
      setCatalog(response.data)
      setCatalogParams(nextParams)
      setError(null)
    } else {
      setError(response.error ?? "Unable to load repository catalog.")
    }
    setCatalogLoading(false)
  }, [backendConfigured, catalogParams])

  const refreshUserRepos = useCallback(async () => {
    if (!backendConfigured || !isLoaded || !isSignedIn || !userId) {
      setYourRepos([])
      setArchivedRepos([])
      return
    }
    setUserReposLoading(true)
    try {
      const token = (await getToken?.()) ?? undefined
      const [activeResponse, archivedResponse] = await Promise.all([
        repoService.listUserRepos(token),
        repoService.listArchivedRepos(token),
      ])
      if (activeResponse.ok && activeResponse.data) {
        setYourRepos(activeResponse.data)
      } else {
        setYourRepos([])
      }
      if (archivedResponse.ok && archivedResponse.data) {
        setArchivedRepos(archivedResponse.data)
      } else {
        setArchivedRepos([])
      }
    } finally {
      setUserReposLoading(false)
    }
  }, [backendConfigured, getToken, isLoaded, isSignedIn, userId])

  useEffect(() => {
    if (!backendConfigured) return
    void refreshCatalog()
  }, [backendConfigured, refreshCatalog])

  useEffect(() => {
    if (!backendConfigured || !isLoaded || !isSignedIn) {
      setYourRepos([])
      setArchivedRepos([])
      return
    }
    void refreshUserRepos()
  }, [backendConfigured, isLoaded, isSignedIn, refreshUserRepos])

  const updateRepoState = useCallback((updated: UserRepoState, opts?: { archive?: boolean }) => {
    setYourRepos((previous) => {
      const others = previous.filter((repo) => repo.repo.repo.full_name !== updated.repo.repo.full_name)
      if (opts?.archive) return others
      return [updated, ...others]
    })
    if (opts?.archive) {
      setArchivedRepos((prev) => {
        const others = prev.filter((repo) => repo.repo.repo.full_name !== updated.repo.repo.full_name)
        return [updated, ...others]
      })
    } else {
      setArchivedRepos((prev) => prev.filter((repo) => repo.repo.repo.full_name !== updated.repo.repo.full_name))
    }
  }, [])

  const syncRepo = useCallback(
    async (identity: RepoIdentity, authToken?: string) => {
      const response = await repoService.syncRepo(identity.owner, identity.repoName, authToken)
      if (response.ok && response.data) {
        updateRepoState(response.data)
      }
    },
    [updateRepoState]
  )

  const desyncRepo = useCallback(
    async (identity: RepoIdentity, authToken?: string) => {
      const response = await repoService.desyncRepo(identity.owner, identity.repoName, authToken)
      if (response.ok && response.data) {
        updateRepoState(response.data)
      }
    },
    [updateRepoState]
  )

  const archiveRepo = useCallback(
    async (identity: RepoIdentity, authToken?: string) => {
      const response = await repoService.archiveRepo(identity.owner, identity.repoName, authToken)
      if (response.ok && response.data) {
        updateRepoState(response.data, { archive: true })
      }
    },
    [updateRepoState]
  )

  const unarchiveRepo = useCallback(
    async (identity: RepoIdentity, authToken?: string) => {
      const response = await repoService.unarchiveRepo(identity.owner, identity.repoName, authToken)
      if (response.ok && response.data) {
        updateRepoState(response.data)
      }
    },
    [updateRepoState]
  )

  const markPending = useCallback((identity: RepoIdentity) => {
    setPending((previous) => {
      if (previous.some((item) => item.slug === identity.slug)) {
        return previous
      }
      return [{ ...identity, pending: true }, ...previous]
    })
  }, [])

  const clearPending = useCallback((fullName: string) => {
    setPending((previous) => previous.filter((item) => item.fullName !== fullName))
  }, [])

  const getRepoBySlug = useCallback(
    (slug: string) => {
      return (
        yourRepos.find((repo) => slugFromFullName(repo.repo.repo.full_name) === slug) ||
        pending.find((repo) => repo.slug === slug)
      )
    },
    [pending, yourRepos]
  )

  const value = useMemo<CatalogContextValue>(
    () => ({
      catalog,
      catalogParams,
      catalogLoading,
      userReposLoading,
      yourRepos,
      archivedRepos,
      pending,
      error,
      refreshCatalog,
      refreshUserRepos,
      markPending,
      clearPending,
      getRepoBySlug,
      syncRepo,
      desyncRepo,
      archiveRepo,
      unarchiveRepo,
    }),
    [
      archiveRepo,
      archivedRepos,
      catalog,
      catalogLoading,
      catalogParams,
      desyncRepo,
      error,
      getRepoBySlug,
      markPending,
      clearPending,
      pending,
      refreshCatalog,
      refreshUserRepos,
      syncRepo,
      unarchiveRepo,
      userReposLoading,
      yourRepos,
    ]
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
