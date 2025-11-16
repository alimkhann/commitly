import { apiClient, type ApiClientResponse } from "@/lib/api/client"
import { env } from "@/lib/config/env"

const API_ROUTES = {
  generateRoadmap: "/api/v1/roadmap/generate",
  catalog: "/api/v1/roadmap/catalog",
  cached: (owner: string, repo: string) => `/api/v1/roadmap/cached/${owner}/${repo}`,
  yourRepos: "/api/v1/roadmap/repos/me",
  archivedRepos: "/api/v1/roadmap/repos/me/archived",
  sync: (owner: string, repo: string) => `/api/v1/roadmap/sync/${owner}/${repo}`,
  archive: (owner: string, repo: string) => `/api/v1/roadmap/archive/${owner}/${repo}`,
  unarchive: (owner: string, repo: string) => `/api/v1/roadmap/unarchive/${owner}/${repo}`,
  rating: (owner: string, repo: string) => `/api/v1/roadmap/${owner}/${repo}/rating`,
}

const sanitizeSegment = (value: string) =>
  value
    .replace(/\.git$/i, "")
    .replace(/[^A-Za-z0-9._-]/g, "-")

const toIdentity = (fullName: string): RepoIdentity => {
  const [owner, repoName] = fullName.split("/")
  return {
    owner,
    repoName,
    fullName,
    slug: `${owner}-${repoName}`,
  }
}

const parsePath = (value: string): RepoIdentity | null => {
  const normalized = value.trim()
  if (!normalized) return null

  if (normalized.includes(" ")) return null

  let path = normalized
  if (normalized.startsWith("http")) {
    try {
      const url = new URL(normalized)
      path = url.pathname
    } catch {
      return null
    }
  } else if (normalized.startsWith("github.com")) {
    try {
      const url = new URL(`https://${normalized}`)
      path = url.pathname
    } catch {
      return null
    }
  }

  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length < 2) return null

  const owner = sanitizeSegment(segments[0])
  const repoName = sanitizeSegment(segments[1])

  if (!owner || !repoName) return null

  return {
    owner,
    repoName,
    fullName: `${owner}/${repoName}`,
    slug: `${owner}-${repoName}`,
  }
}

export type RepoIdentity = {
  owner: string
  repoName: string
  fullName: string
  slug: string
}

export type RoadmapSummary = {
  full_name: string
  description?: string | null
  language?: string | null
  stars: number
  default_branch: string
  html_url?: string | null
  owner_avatar_url?: string | null
}

export type RepoTimelineStage = {
  id: string
  title: string
  summary: string
  status: "not-started" | "in-progress" | "done"
  eta: string
  tasks: string[]
  resources: { label: string; href: string }[]
}

export type RoadmapResponseBody = {
  repo: RoadmapSummary
  timeline: RepoTimelineStage[]
  cached: boolean
  generated_at: string
}

export type RepoImportResult = ApiClientResponse<RoadmapResponseBody> & {
  skipped?: boolean
}

export type CatalogQueryParams = {
  page?: number
  pageSize?: number
  languages?: string[]
  topics?: string[]
  difficulty?: string
  minRating?: number
  minViews?: number
  minSyncs?: number
  sort?: string
  search?: string
}

export type RoadmapStats = {
  primary_language?: string | null
  languages: string[]
  topics: string[]
  difficulty?: string | null
  star_count: number
  fork_count: number
  contributor_count: number
  last_pushed_at?: string | null
  license?: string | null
  view_count: number
  sync_count: number
  rating_count: number
  rating_sum: number
  average_rating?: number | null
}

export type PublicRepoRecord = {
  repo: RoadmapSummary
  stats: RoadmapStats
}

export type PaginatedPublicCatalog = {
  items: PublicRepoRecord[]
  page: number
  page_size: number
  total_count: number
  total_pages: number
}

export type UserRepoState = {
  repo: PublicRepoRecord
  status: "synced" | "unsynced"
  progress_percent: number
  is_archived: boolean
  synced_at?: string | null
  last_viewed_at?: string | null
  created_at: string
  updated_at: string
}

export type RatingPayload = {
  rating: number | null
  average_rating: number | null
  rating_count: number
}

export const repoService = {
  parseRepoInput(value: string): RepoIdentity | null {
    return parsePath(value)
  },

  buildIdentityFromFullName(fullName: string): RepoIdentity {
    return toIdentity(fullName)
  },

  buildTimelinePath(fullName: string) {
    const identity = toIdentity(fullName)
    return `/repo/${identity.slug}/timeline`
  },

  isBackendConfigured(): boolean {
    return Boolean(env.apiBaseUrl)
  },

  async generateRoadmap(
    repoUrl: string,
    authToken?: string,
    options?: { forceRefresh?: boolean }
  ): Promise<RepoImportResult> {
    if (!repoUrl.trim()) {
      return { ok: false, status: 0, error: "Repository URL is required." }
    }

    if (!env.apiBaseUrl) {
      return {
        ok: true,
        status: 0,
        data: null,
        skipped: true,
        error: undefined,
      }
    }

    return apiClient<RoadmapResponseBody>(env.apiBaseUrl, {
      path: API_ROUTES.generateRoadmap,
      method: "POST",
      body: { repo_url: repoUrl, force_refresh: options?.forceRefresh ?? false },
      authToken,
    })
  },

  async listCatalog(
    params?: CatalogQueryParams
  ): Promise<ApiClientResponse<PaginatedPublicCatalog>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set("page", String(params.page))
    if (params?.pageSize) searchParams.set("page_size", String(params.pageSize))
    params?.languages?.forEach((lang) => {
      if (lang) searchParams.append("language", lang)
    })
    params?.topics?.forEach((topic) => {
      if (topic) searchParams.append("topic", topic)
    })
    if (params?.difficulty) searchParams.set("difficulty", params.difficulty)
    if (typeof params?.minRating === "number")
      searchParams.set("min_rating", String(params.minRating))
    if (typeof params?.minViews === "number")
      searchParams.set("min_views", String(params.minViews))
    if (typeof params?.minSyncs === "number")
      searchParams.set("min_syncs", String(params.minSyncs))
    if (params?.sort) searchParams.set("sort", params.sort)
    if (params?.search) searchParams.set("search", params.search)
    const path = `${API_ROUTES.catalog}?${searchParams.toString()}`
    return apiClient<PaginatedPublicCatalog>(env.apiBaseUrl, {
      path,
      cache: "no-store",
    })
  },

  async getCachedRoadmap(
    owner: string,
    repo: string
  ): Promise<ApiClientResponse<RoadmapResponseBody>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    return apiClient<RoadmapResponseBody>(env.apiBaseUrl, {
      path: API_ROUTES.cached(owner, repo),
      cache: "no-store",
    })
  },

  async listUserRepos(authToken?: string): Promise<ApiClientResponse<UserRepoState[]>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    return apiClient<UserRepoState[]>(env.apiBaseUrl, {
      path: API_ROUTES.yourRepos,
      authToken,
      cache: "no-store",
    })
  },

  async listArchivedRepos(
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState[]>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    return apiClient<UserRepoState[]>(env.apiBaseUrl, {
      path: API_ROUTES.archivedRepos,
      authToken,
      cache: "no-store",
    })
  },

  async syncRepo(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    return apiClient<UserRepoState>(env.apiBaseUrl, {
      path: API_ROUTES.sync(owner, repo),
      method: "POST",
      authToken,
    })
  },

  async desyncRepo(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    return apiClient<UserRepoState>(env.apiBaseUrl, {
      path: API_ROUTES.sync(owner, repo),
      method: "DELETE",
      authToken,
    })
  },

  async archiveRepo(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    return apiClient<UserRepoState>(env.apiBaseUrl, {
      path: API_ROUTES.archive(owner, repo),
      method: "POST",
      authToken,
    })
  },

  async unarchiveRepo(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    return apiClient<UserRepoState>(env.apiBaseUrl, {
      path: API_ROUTES.unarchive(owner, repo),
      method: "POST",
      authToken,
    })
  },

  async getRating(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<ApiClientResponse<RatingPayload>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    return apiClient<RatingPayload>(env.apiBaseUrl, {
      path: API_ROUTES.rating(owner, repo),
      authToken,
      cache: "no-store",
    })
  },

  async setRating(
    owner: string,
    repo: string,
    rating: number,
    authToken?: string
  ): Promise<ApiClientResponse<RatingPayload>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    const params = new URLSearchParams({ rating: String(rating) })
    return apiClient<RatingPayload>(env.apiBaseUrl, {
      path: `${API_ROUTES.rating(owner, repo)}?${params.toString()}`,
      method: "POST",
      authToken,
    })
  },
}

export type RepoService = typeof repoService
