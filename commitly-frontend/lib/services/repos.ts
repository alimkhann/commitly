import type { RepoTimelineStage } from "@/data/repos";

import { type ApiClientResponse, apiClient } from "@/lib/api/client";
import { env } from "@/lib/config/env";

const API_ROUTES = {
  generateRoadmap: "/api/v1/roadmap/generate",
  generateRoadmapStream: "/api/v1/roadmap/generate/stream",
  generateRoadmapProgressive: "/api/v1/roadmap/generate-progressive",
  generateSyllabus: "/api/v1/roadmap/syllabus/generate",
  roadmapJob: (jobId: string) => `/api/v1/roadmap/jobs/${jobId}`,
  roadmapJobContinue: (jobId: string) => `/api/v1/roadmap/jobs/${jobId}/continue`,
  roadmapJobHydrateNext: (jobId: string) =>
    `/api/v1/roadmap/jobs/${jobId}/hydrate-next`,
  syllabus: (owner: string, repo: string) => `/api/v1/roadmap/syllabus/${owner}/${repo}`,
  hydrateStage: (stageId: string) => `/api/v1/roadmap/stages/${stageId}/hydrate`,
  flagStageRegenerate: (stageId: string) =>
    `/api/v1/roadmap/stages/${stageId}/flag-regenerate`,
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
  chat: "/api/v1/roadmap/chat",
  translateStages: "/api/v1/roadmap/translate-stages",
  usageGlobal: "/api/v1/usage/global",
  bugReport: "/api/v1/feedback/bug",
  preferences: "/api/v1/preferences",
  adminCatalogSoftReset: "/api/v1/admin/catalog/soft-reset",
  adminStageRegenFlags: "/api/v1/admin/stage-regen-flags",
  adminStageRegenFlagApprove: (flagId: string) =>
    `/api/v1/admin/stage-regen-flags/${flagId}/approve`,
  adminStageRegenFlagReject: (flagId: string) =>
    `/api/v1/admin/stage-regen-flags/${flagId}/reject`,
};

export type RoadmapGenerationPhase =
  | "ingest"
  | "syllabus"
  | "hydrate"
  | "validate"
  | "persist"
  | "complete";

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
  timeline_quality?: {
    novelty_score: number;
    grounding_score: number;
    anti_template_pass: boolean;
    evaluated_at: string;
  } | null;
  job_state?: RoadmapGenerationJobStatus | string;
  last_generated_stage?: number;
  progress_percent?: number;
  current_phase?: RoadmapGenerationPhase | string;
  phase_message?: string | null;
};

export type RoadmapGenerationJobStatus =
  | "queued"
  | "running"
  | "partial_ready"
  | "completed"
  | "failed";

export type PlanTier = "free" | "pro" | "ultra";

export type StageRegenerationFlagStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "processing"
  | "completed"
  | "failed";

export type ProgressiveGenerationStartResponse = {
  job_id: string;
  repo_full_name: string;
  status: RoadmapGenerationJobStatus;
  initial_timeline: RepoTimelineStage[];
  generated_stages: number;
  total_planned_stages: number;
  progress_percent: number;
  current_phase: RoadmapGenerationPhase | string;
  phase_message: string | null;
  quality_gate_status?: "pass" | "fail";
  quality_fail_reasons?: string[];
  failed_stage_ids?: string[];
  dedupe_score?: number;
  grounding_score?: number;
  failed_stage_reports?: Array<{
    stage_id: string;
    attempt_count: number;
    fail_codes: string[];
    fail_reasons: string[];
    last_model: string;
  }>;
  quality_gate_metrics?: {
    dedupe_score: number;
    grounding_score: number;
    concept_coverage_score: number;
    template_risk_score: number;
  };
  chunk_status?: "pass" | "fail" | "partial_pass";
  queue_state?: "idle" | "queued" | "processing" | "failed" | string;
  worker_attempts?: number;
  last_worker_at?: string | null;
};

export type ProgressiveGenerationJobResponse = {
  status: RoadmapGenerationJobStatus;
  generated_stages: number;
  total_planned_stages: number;
  last_error: string | null;
  updated_at: string;
  progress_percent: number;
  current_phase: RoadmapGenerationPhase | string;
  phase_message: string | null;
  quality_gate_status?: "pass" | "fail";
  quality_fail_reasons?: string[];
  failed_stage_ids?: string[];
  dedupe_score?: number;
  grounding_score?: number;
  failed_stage_reports?: Array<{
    stage_id: string;
    attempt_count: number;
    fail_codes: string[];
    fail_reasons: string[];
    last_model: string;
  }>;
  quality_gate_metrics?: {
    dedupe_score: number;
    grounding_score: number;
    concept_coverage_score: number;
    template_risk_score: number;
  };
  chunk_status?: "pass" | "fail" | "partial_pass";
  queue_state?: "idle" | "queued" | "processing" | "failed" | string;
  worker_attempts?: number;
  last_worker_at?: string | null;
};

export type RoadmapSyllabusNode = {
  id: string;
  index: number;
  title: string;
  summary: string;
  category: string;
  difficulty: string;
  goals: string[];
  prerequisites: string[];
  checkpoints: string[];
  source_themes?: string[];
  optional_peeks?: string[];
};

export type SyllabusGenerateResponse = {
  job_id: string;
  repo_full_name: string;
  status: RoadmapGenerationJobStatus;
  syllabus: RoadmapSyllabusNode[];
  initial_stage_details: RepoTimelineStage[];
  generated_stage_count: number;
  total_stage_count: number;
  logical_stage_target: number;
  curriculum_mode: "single_track" | "multi_track" | string;
};

export type SyllabusResponse = {
  repo_full_name: string;
  syllabus: RoadmapSyllabusNode[];
  stage_target: number;
  logical_stage_target: number;
  curriculum_mode: "single_track" | "multi_track" | string;
  generated_stage_count: number;
  generated_at: string;
};

export type StageHydrationResponse = {
  job_id: string;
  stage_id: string;
  detail: RepoTimelineStage;
  quality_score: number;
  hydrated_at: string;
};

export type HydrateNextResponse = {
  status: RoadmapGenerationJobStatus;
  generated_stages: number;
  total_planned_stages: number;
  timeline: RepoTimelineStage[];
  updated_at: string;
  last_error: string | null;
  progress_percent: number;
  current_phase: RoadmapGenerationPhase | string;
  phase_message: string | null;
  quality_gate_status?: "pass" | "fail";
  quality_fail_reasons?: string[];
  failed_stage_ids?: string[];
  dedupe_score?: number;
  grounding_score?: number;
  failed_stage_reports?: Array<{
    stage_id: string;
    attempt_count: number;
    fail_codes: string[];
    fail_reasons: string[];
    last_model: string;
  }>;
  quality_gate_metrics?: {
    dedupe_score: number;
    grounding_score: number;
    concept_coverage_score: number;
    template_risk_score: number;
  };
  chunk_status?: "pass" | "fail" | "partial_pass";
  queue_state?: "idle" | "queued" | "processing" | "failed" | string;
  worker_attempts?: number;
  last_worker_at?: string | null;
};

export type UserPreferences = {
  theme: "system" | "light" | "dark";
  language: "en" | "zh-HK" | "kz" | "ru";
  updated_at?: string | null;
};

export type RoadmapTranslationLanguage = "en" | "zh-HK" | "kz" | "ru";

export type RoadmapTranslatedStage = {
  stage_id: string;
  title: string;
  summary: string;
  goals: string[];
  prerequisites: string[];
  checkpoints: string[];
  tasks: Array<{
    label: string;
    steps: string[];
    files?: string[];
    commands?: string[];
  }>;
  quality_score: number;
  source_hash: string;
};

export type RoadmapTranslationResponse = {
  repo_full_name: string;
  target_language: RoadmapTranslationLanguage;
  translated: RoadmapTranslatedStage[];
  cache_hit_ratio: number;
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

export type GlobalUsage = {
  daily_limit: number;
  used: number;
  remaining: number;
  mode: "normal" | "low" | "critical" | string;
  reset_at: string;
  user_daily_limit?: number | null;
  user_used?: number | null;
  user_remaining?: number | null;
  user_reset_at?: string | null;
  plan_tier?: PlanTier | null;
};

export type StageRegenerationFlag = {
  id: string;
  repo_full_name: string;
  stage_id: string;
  requested_by: string;
  status: StageRegenerationFlagStatus;
  reason: string;
  stage_source_hash?: string | null;
  admin_decision_by?: string | null;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
};

export type RoadmapStreamEvent =
  | { type: "progress"; message: string }
  | { type: "result"; data: RoadmapResponseBody }
  | { type: "error"; message: string };

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
  buildIdentityFromFullName(fullName: string): RepoIdentity {
    return toIdentity(fullName);
  },

  parseRepoInput(value: string): RepoIdentity | null {
    return parsePath(value);
  },

  getRepoUrl(identity: RepoIdentity): string {
    return `/repo/${identity.slug}?view=timeline&fullName=${encodeURIComponent(identity.fullName)}`;
  },

  isBackendConfigured(): boolean {
    return Boolean(env.apiBaseUrl);
  },

  async *generateRoadmapStream(
    repoUrl: string,
    authToken?: string,
    options?: { forceRefresh?: boolean }
  ): AsyncGenerator<RoadmapStreamEvent, void, unknown> {
    if (!env.apiBaseUrl) {
      throw new Error("API base URL missing");
    }

    const params = new URLSearchParams({
      repo_url: repoUrl,
      force_refresh: String(options?.forceRefresh ?? false),
    });

    const normalizedBase = env.apiBaseUrl.endsWith("/")
      ? env.apiBaseUrl
      : `${env.apiBaseUrl}/`;
    const normalizedPath = API_ROUTES.generateRoadmapStream.replace(/^\/+/, "");
    const url = new URL(normalizedPath, normalizedBase);
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
      } catch {
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
            yield JSON.parse(data) as RoadmapStreamEvent;
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

  generateRoadmapProgressive(
    repoUrl: string,
    authToken?: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ApiClientResponse<ProgressiveGenerationStartResponse>> {
    if (!repoUrl.trim()) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "Repository URL is required.",
      });
    }

    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }

    return apiClient<ProgressiveGenerationStartResponse>(env.apiBaseUrl, {
      path: API_ROUTES.generateRoadmapProgressive,
      method: "POST",
      body: {
        repo_url: repoUrl,
        force_refresh: options?.forceRefresh ?? false,
      },
      authToken,
    });
  },

  getRoadmapJob(
    jobId: string,
    authToken?: string
  ): Promise<ApiClientResponse<ProgressiveGenerationJobResponse>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<ProgressiveGenerationJobResponse>(env.apiBaseUrl, {
      path: API_ROUTES.roadmapJob(jobId),
      authToken,
      cache: "no-store",
    });
  },

  continueRoadmapJob(
    jobId: string,
    authToken?: string
  ): Promise<ApiClientResponse<ProgressiveGenerationJobResponse>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<ProgressiveGenerationJobResponse>(env.apiBaseUrl, {
      path: API_ROUTES.roadmapJobContinue(jobId),
      method: "POST",
      authToken,
    });
  },

  generateSyllabus(
    repoUrl: string,
    authToken?: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ApiClientResponse<SyllabusGenerateResponse>> {
    if (!repoUrl.trim()) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "Repository URL is required.",
      });
    }

    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }

    return apiClient<SyllabusGenerateResponse>(env.apiBaseUrl, {
      path: API_ROUTES.generateSyllabus,
      method: "POST",
      body: {
        repo_url: repoUrl,
        force_refresh: options?.forceRefresh ?? false,
      },
      authToken,
    });
  },

  getSyllabus(
    owner: string,
    repo: string
  ): Promise<ApiClientResponse<SyllabusResponse>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<SyllabusResponse>(env.apiBaseUrl, {
      path: API_ROUTES.syllabus(owner, repo),
      cache: "no-store",
    });
  },

  hydrateNextRoadmapChunk(
    jobId: string,
    authToken?: string,
    options?: { chunkSize?: number }
  ): Promise<ApiClientResponse<HydrateNextResponse>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }

    return apiClient<HydrateNextResponse>(env.apiBaseUrl, {
      path: API_ROUTES.roadmapJobHydrateNext(jobId),
      method: "POST",
      body: {
        chunk_size: options?.chunkSize ?? 3,
      },
      authToken,
    });
  },

  hydrateRoadmapStage(
    stageId: string,
    jobId: string,
    authToken?: string
  ): Promise<ApiClientResponse<StageHydrationResponse>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<StageHydrationResponse>(env.apiBaseUrl, {
      path: API_ROUTES.hydrateStage(stageId),
      method: "POST",
      body: {
        job_id: jobId,
      },
      authToken,
    });
  },

  flagStageForRegeneration(
    stageId: string,
    payload: {
      repo_full_name: string;
      reason: string;
      stage_source_hash?: string;
    },
    authToken?: string
  ): Promise<ApiClientResponse<{ ok: boolean; flag: StageRegenerationFlag }>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<{ ok: boolean; flag: StageRegenerationFlag }>(
      env.apiBaseUrl,
      {
        path: API_ROUTES.flagStageRegenerate(stageId),
        method: "POST",
        body: payload,
        authToken,
      }
    );
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

  chat(
    owner: string,
    repo: string,
    message: string,
    stageId?: string,
    authToken?: string,
    preferredLanguage?: RoadmapTranslationLanguage
  ): Promise<ApiClientResponse<{ response: string }>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<{ response: string }>(env.apiBaseUrl, {
      path: API_ROUTES.chat,
      method: "POST",
      body: {
        message,
        repo_full_name: `${owner}/${repo}`,
        stage_id: stageId,
        preferred_language: preferredLanguage,
      },
      authToken,
    });
  },

  translateStages(
    payload: {
      repo_full_name: string;
      target_language: RoadmapTranslationLanguage;
      stage_ids: string[];
      source_hashes?: Record<string, string>;
    },
    authToken?: string
  ): Promise<ApiClientResponse<RoadmapTranslationResponse>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<RoadmapTranslationResponse>(env.apiBaseUrl, {
      path: API_ROUTES.translateStages,
      method: "POST",
      body: payload,
      authToken,
    });
  },

  getGlobalUsage(): Promise<ApiClientResponse<GlobalUsage>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<GlobalUsage>(env.apiBaseUrl, {
      path: API_ROUTES.usageGlobal,
      cache: "no-store",
    });
  },

  submitBugReport(
    payload: {
      title: string;
      description: string;
      routePath?: string;
      userAgent?: string;
    },
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
      path: API_ROUTES.bugReport,
      method: "POST",
      body: {
        title: payload.title,
        description: payload.description,
        route_path: payload.routePath ?? "",
        user_agent: payload.userAgent ?? "",
      },
      authToken,
    });
  },

  getPreferences(authToken?: string): Promise<ApiClientResponse<UserPreferences>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<UserPreferences>(env.apiBaseUrl, {
      path: API_ROUTES.preferences,
      cache: "no-store",
      authToken,
    });
  },

  updatePreferences(
    payload: Partial<UserPreferences>,
    authToken?: string
  ): Promise<ApiClientResponse<UserPreferences>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<UserPreferences>(env.apiBaseUrl, {
      path: API_ROUTES.preferences,
      method: "PUT",
      body: payload,
      authToken,
    });
  },

  softResetCatalog(
    adminSecret: string,
    options?: { segment?: string; keepRepos?: string[] }
  ): Promise<ApiClientResponse<{ ok: boolean; catalog_segment: string; remaining_visible: number }>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<
      { ok: boolean; catalog_segment: string; remaining_visible: number },
      { catalog_segment: string; keep_repos?: string[] }
    >(env.apiBaseUrl, {
      path: API_ROUTES.adminCatalogSoftReset,
      method: "POST",
      headers: {
        "x-admin-secret": adminSecret,
      },
      body: {
        catalog_segment: options?.segment ?? "default",
        ...(Array.isArray(options?.keepRepos) ? { keep_repos: options.keepRepos } : {}),
      },
    });
  },

  listStageRegenerationFlags(
    adminSecret: string,
    options?: { status?: StageRegenerationFlagStatus; limit?: number; offset?: number }
  ): Promise<ApiClientResponse<{ items: StageRegenerationFlag[]; limit: number; offset: number }>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    const params = new URLSearchParams();
    if (options?.status) {
      params.set("status", options.status);
    }
    if (typeof options?.limit === "number") {
      params.set("limit", String(options.limit));
    }
    if (typeof options?.offset === "number") {
      params.set("offset", String(options.offset));
    }
    const path = params.toString()
      ? `${API_ROUTES.adminStageRegenFlags}?${params.toString()}`
      : API_ROUTES.adminStageRegenFlags;
    return apiClient<{ items: StageRegenerationFlag[]; limit: number; offset: number }>(
      env.apiBaseUrl,
      {
        path,
        headers: {
          "x-admin-secret": adminSecret,
        },
        cache: "no-store",
      }
    );
  },

  approveStageRegenerationFlag(
    adminSecret: string,
    flagId: string,
    payload?: { regenerate_now?: boolean; note?: string }
  ): Promise<ApiClientResponse<{ ok: boolean; flag: StageRegenerationFlag }>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<{ ok: boolean; flag: StageRegenerationFlag }>(
      env.apiBaseUrl,
      {
        path: API_ROUTES.adminStageRegenFlagApprove(flagId),
        method: "POST",
        headers: {
          "x-admin-secret": adminSecret,
        },
        body: {
          regenerate_now: payload?.regenerate_now ?? true,
          note: payload?.note ?? "",
        },
      }
    );
  },

  rejectStageRegenerationFlag(
    adminSecret: string,
    flagId: string,
    payload?: { reason?: string }
  ): Promise<ApiClientResponse<{ ok: boolean; flag: StageRegenerationFlag }>> {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        error: "API base URL missing",
      });
    }
    return apiClient<{ ok: boolean; flag: StageRegenerationFlag }>(
      env.apiBaseUrl,
      {
        path: API_ROUTES.adminStageRegenFlagReject(flagId),
        method: "POST",
        headers: {
          "x-admin-secret": adminSecret,
        },
        body: {
          reason: payload?.reason ?? "",
        },
      }
    );
  },
};

export type RepoService = typeof repoService;
