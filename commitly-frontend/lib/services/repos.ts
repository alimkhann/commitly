import {
  getRepoById as getRepoByIdFromStatic,
  type RepoRecord,
  type RepoTimelineStage,
  repos,
} from "@/data/repos";

import { type ApiClientResponse, apiClient } from "@/lib/api/client";
import { env } from "@/lib/config/env";

const API_ROUTES = {
  generateRoadmap: "/api/v1/roadmap/generate",
  generateRoadmapStream: "/api/v1/roadmap/generate/stream",
  catalog: "/api/v1/roadmap/catalog",
  cached: (owner: string, repo: string) =>
    `/api/v1/roadmap/cached/${owner}/${repo}`,
  userRepos: "/api/v1/roadmap/user-repos",
  sync: (owner: string, repo: string) =>
    `/api/v1/roadmap/sync/${owner}/${repo}`,
  archive: (owner: string, repo: string) =>
    `/api/v1/roadmap/archive/${owner}/${repo}`,
  unarchive: (owner: string, repo: string) =>
    `/api/v1/roadmap/unarchive/${owner}/${repo}`,
  archived: "/api/v1/roadmap/archived",
  rating: (owner: string, repo: string) =>
    `/api/v1/roadmap/${owner}/${repo}/rating`,
  recordView: (owner: string, repo: string) =>
    `/api/v1/roadmap/${owner}/${repo}/view`,
};

export type RepoIdentity = {
  owner: string;
  repoName: string;
  fullName: string;
  slug: string;
};

export type RoadmapSummary = {
  full_name: string;
  description?: string | null;
  language?: string | null;
  primary_language?: string | null;
  languages?: string[] | null;
  stars: number;
  default_branch: string;
  html_url?: string | null;
  owner_avatar_url?: string | null;
  topics?: string[] | null;
  difficulty?: string | null;
  star_count?: number | null;
  fork_count?: number | null;
  last_pushed_at?: string | null;
  license?: string | null;
  contributor_count?: number | null;
  view_count?: number | null;
  sync_count?: number | null;
  rating_count?: number | null;
  rating_sum?: number | null;
};

export type RoadmapResponseBody = {
  repo: RoadmapSummary;
  timeline: RepoTimelineStage[];
  cached: boolean;
  generated_at: string;
};

export type RoadmapCatalogPage = {
  items: RoadmapResponseBody[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
};

export type CatalogFilters = {
  page?: number;
  page_size?: number;
  language?: string;
  tag?: string;
  difficulty?: string;
  min_rating?: number;
  min_views?: number;
  min_syncs?: number;
  sort?:
    | "newest"
    | "most_viewed"
    | "most_synced"
    | "highest_rated"
    | "trending";
};

export type CatalogPage = {
  items: RoadmapResponseBody[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
};

export type RepoImportResult = ApiClientResponse<RoadmapResponseBody> & {
  skipped?: boolean;
};

export type UserRepoState = {
  repo_full_name: string;
  status: "synced" | "unsynced" | string;
  is_archived: boolean;
  progress_percent: number;
  pinned_at?: string;
  repo?: RoadmapSummary | null;
};

const GIT_SUFFIX_REGEX = /\.git$/i;
const INVALID_CHAR_REGEX = /[^A-Za-z0-9._-]/g;

const sanitizeSegment = (value: string) =>
  value.replace(GIT_SUFFIX_REGEX, "").replace(INVALID_CHAR_REGEX, "-");

const toIdentity = (fullName: string): RepoIdentity => {
  const [owner, repoName] = fullName.split("/");
  return {
    owner,
    repoName,
    fullName,
    slug: `${owner}-${repoName}`,
  };
};

const parsePath = (value: string): RepoIdentity | null => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.includes(" ")) {
    return null;
  }

  let path = normalized;
  if (normalized.startsWith("http")) {
    try {
      const url = new URL(normalized);
      path = url.pathname;
    } catch {
      return null;
    }
  } else if (normalized.startsWith("github.com")) {
    try {
      const url = new URL(`https://${normalized}`);
      path = url.pathname;
    } catch {
      return null;
    }
  }

  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const owner = sanitizeSegment(segments[0]);
  const repoName = sanitizeSegment(segments[1]);

  if (!(owner && repoName)) {
    return null;
  }

  return {
    owner,
    repoName,
    fullName: `${owner}/${repoName}`,
    slug: `${owner}-${repoName}`,
  };
};

export const repoService = {
  list(): RepoRecord[] {
    return repos;
  },

  listExamples(limit = 3): RepoRecord[] {
    return repos.slice(0, limit);
  },

  findById(id: string) {
    return getRepoByIdFromStatic(id);
  },

  buildIdentityFromFullName(fullName: string): RepoIdentity {
    return toIdentity(fullName);
  },

  parseRepoInput(value: string): RepoIdentity | null {
    return parsePath(value);
  },

  buildTimelinePath(fullName: string) {
    const identity = toIdentity(fullName);
    return `/repo/${identity.slug}/timeline`;
  },

  isBackendConfigured(): boolean {
    return Boolean(env.apiBaseUrl);
  },

  async *generateRoadmapStream(
    repoUrl: string,
    authToken?: string,
    options?: { forceRefresh?: boolean }
  ): AsyncGenerator<any, void, unknown> {
    if (!env.apiBaseUrl) {
      throw new Error("API base URL missing");
    }

    const params = new URLSearchParams({
      repo_url: repoUrl,
      force_refresh: String(options?.forceRefresh ?? false),
    });

    const url = new URL(API_ROUTES.generateRoadmapStream, env.apiBaseUrl);
    url.search = params.toString();

    const response = await fetch(url.toString(), {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    if (!(response.ok && response.body)) {
      let errorMessage = `Failed to start stream: ${response.status} ${response.statusText}`;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          errorMessage += ` - ${errorBody}`;
        }
      } catch (e) {
        // Ignore error reading body
      }
      throw new Error(errorMessage);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            yield JSON.parse(data);
          } catch (e) {
            console.error("Failed to parse SSE data", e);
          }
        }
      }
    }
  },

  generateRoadmap(
    repoUrl: string,
    authToken?: string,
    options?: { forceRefresh?: boolean }
  ): Promise<RepoImportResult> {
    if (!repoUrl.trim()) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "Repository URL is required.",
      });
    }

    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: true,
        status: 0,
        data: null,
        skipped: true,
        error: undefined,
      });
    }

    return apiClient<RoadmapResponseBody>(env.apiBaseUrl, {
      path: API_ROUTES.generateRoadmap,
      method: "POST",
      body: {
        repo_url: repoUrl,
        force_refresh: options?.forceRefresh ?? false,
      },
      authToken,
    });
  },

  listCatalog(
    filters?: CatalogFilters
  ): Promise<ApiClientResponse<CatalogPage>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }

    // Build query string from filters
    const params = new URLSearchParams();
    if (filters?.page) {
      params.set("page", filters.page.toString());
    }

    if (filters?.page_size) {
      params.set("page_size", filters.page_size.toString());
    }

    if (filters?.language) {
      params.set("language", filters.language);
    }

    if (filters?.tag) {
      params.set("tag", filters.tag);
    }

    if (filters?.difficulty) {
      params.set("difficulty", filters.difficulty);
    }

    if (filters?.min_rating !== undefined) {
      params.set("min_rating", filters.min_rating.toString());
    }

    if (filters?.min_views !== undefined) {
      params.set("min_views", filters.min_views.toString());
    }

    if (filters?.min_syncs !== undefined) {
      params.set("min_syncs", filters.min_syncs.toString());
    }

    if (filters?.sort) {
      params.set("sort", filters.sort);
    }

    const queryString = params.toString();
    const path = queryString
      ? `${API_ROUTES.catalog}?${queryString}`
      : API_ROUTES.catalog;

    return apiClient<CatalogPage>(env.apiBaseUrl, {
      path,
      cache: "no-store",
    });
  },

  getCachedRoadmap(
    owner: string,
    repo: string
  ): Promise<ApiClientResponse<RoadmapResponseBody>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<RoadmapResponseBody>(env.apiBaseUrl, {
      path: API_ROUTES.cached(owner, repo),
      cache: "no-store",
    });
  },

  listUserRepos(
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState[]>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<UserRepoState[]>(env.apiBaseUrl, {
      path: API_ROUTES.userRepos,
      cache: "no-store",
      authToken,
    });
  },

  syncRepo(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<UserRepoState>(env.apiBaseUrl, {
      path: API_ROUTES.sync(owner, repo),
      method: "POST",
      authToken,
    });
  },

  desyncRepo(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<ApiClientResponse<null>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<null>(env.apiBaseUrl, {
      path: API_ROUTES.sync(owner, repo),
      method: "DELETE",
      authToken,
    });
  },

  archiveRepo(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<UserRepoState>(env.apiBaseUrl, {
      path: API_ROUTES.archive(owner, repo),
      method: "POST",
      authToken,
    });
  },

  unarchiveRepo(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<UserRepoState>(env.apiBaseUrl, {
      path: API_ROUTES.unarchive(owner, repo),
      method: "POST",
      authToken,
    });
  },

  listArchivedRepos(
    authToken?: string
  ): Promise<ApiClientResponse<UserRepoState[]>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<UserRepoState[]>(env.apiBaseUrl, {
      path: API_ROUTES.archived,
      cache: "no-store",
      authToken,
    });
  },

  setRating(
    owner: string,
    repo: string,
    rating: number,
    authToken?: string
  ): Promise<
    ApiClientResponse<{
      rating: number;
      repo_full_name: string;
      user_id: string;
      created_at: string;
      updated_at: string;
    }>
  > {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<{
      rating: number;
      repo_full_name: string;
      user_id: string;
      created_at: string;
      updated_at: string;
    }>(env.apiBaseUrl, {
      path: API_ROUTES.rating(owner, repo),
      method: "POST",
      body: { rating },
      authToken,
    });
  },

  getUserRating(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<
    ApiClientResponse<{
      rating: number;
      repo_full_name: string;
      user_id: string;
      created_at: string;
      updated_at: string;
    } | null>
  > {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<{
      rating: number;
      repo_full_name: string;
      user_id: string;
      created_at: string;
      updated_at: string;
    } | null>(env.apiBaseUrl, {
      path: API_ROUTES.rating(owner, repo),
      cache: "no-store",
      authToken,
    });
  },

  recordRoadmapView(
    owner: string,
    repo: string,
    authToken?: string
  ): Promise<ApiClientResponse<void>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<void>(env.apiBaseUrl, {
      path: API_ROUTES.recordView(owner, repo),
      method: "POST",
      authToken,
    });
  },
};

export type RepoService = typeof repoService;
