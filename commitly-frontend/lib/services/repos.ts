import {
  repos,
  getRepoById as getRepoByIdFromStatic,
  type RepoRecord,
  type RepoTimelineStage,
} from "@/data/repos"

import { apiClient, type ApiClientResponse } from "@/lib/api/client"
import { env } from "@/lib/config/env"

const API_ROUTES = {
  generateRoadmap: "/api/v1/roadmap/generate",
  catalog: "/api/v1/roadmap/catalog",
  cached: (owner: string, repo: string) => `/api/v1/roadmap/cached/${owner}/${repo}`,
  userRepos: "/api/v1/roadmap/user-repos",
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

export type RoadmapResponseBody = {
  repo: RoadmapSummary
  timeline: RepoTimelineStage[]
  cached: boolean
  generated_at: string
}

export type RepoImportResult = ApiClientResponse<RoadmapResponseBody> & {
  skipped?: boolean
}

export type UserRepoState = {
  repo_full_name: string
  status: "synced" | "unsynced" | string
  is_archived: boolean
  progress_percent: number
  pinned_at?: string
  repo?: RoadmapSummary | null
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

export const repoService = {
  list(): RepoRecord[] {
    return repos
  },

  listExamples(limit = 3): RepoRecord[] {
    return repos.slice(0, limit)
  },

  findById(id: string) {
    return getRepoByIdFromStatic(id)
  },

  buildIdentityFromFullName(fullName: string): RepoIdentity {
    return toIdentity(fullName)
  },

  parseRepoInput(value: string): RepoIdentity | null {
    return parsePath(value)
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
    authToken?: string
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
      body: { repo_url: repoUrl },
      authToken,
    })
  },

  async listCatalog(): Promise<ApiClientResponse<RoadmapResponseBody[]>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    return apiClient<RoadmapResponseBody[]>(env.apiBaseUrl, {
      path: API_ROUTES.catalog,
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

  async listUserRepos(
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState[]>> {
    if (!env.apiBaseUrl) {
      return { ok: false, status: 0, error: "API base URL missing" }
    }
    return apiClient<UserRepoState[]>(env.apiBaseUrl, {
      path: API_ROUTES.userRepos,
      cache: "no-store",
      authToken,
    })
  },
}

export type RepoService = typeof repoService
