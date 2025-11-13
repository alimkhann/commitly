import {
  repos,
  getRepoById as getRepoByIdFromStatic,
  type RepoRecord,
} from "@/data/repos"

import { apiClient, type ApiClientResponse } from "@/lib/api/client"
import { env } from "@/lib/config/env"

const API_ROUTES = {
  importRepo: "/repos/import",
  repo: (id: string) => `/repos/${id}`,
}

export type RepoImportResult = ApiClientResponse<{ id: string }> & {
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

  async queueImport(repoUrl: string): Promise<RepoImportResult> {
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

    return apiClient<{ id: string }>(env.apiBaseUrl, {
      path: API_ROUTES.importRepo,
      method: "POST",
      body: { repoUrl },
    })
  },
}

export type RepoService = typeof repoService
