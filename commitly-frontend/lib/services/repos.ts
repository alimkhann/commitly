import {
  repos,
  getRepoById as getRepoByIdFromStatic,
  type RepoRecord,
  type RepoTimelineStage,
} from "@/data/repos"

import { apiClient, type ApiClientResponse } from "@/lib/api/client"
import { env } from "@/lib/config/env"

const API_ROUTES = {
  generateRoadmap: "/roadmap/generate",
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
}

export type RepoService = typeof repoService
