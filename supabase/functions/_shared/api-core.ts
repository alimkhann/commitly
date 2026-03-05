import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.58.0";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "npm:jose@5.10.0";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type GlobalUsage = {
  daily_limit: number;
  used: number;
  remaining: number;
  mode: "normal" | "low" | "critical";
  reset_at: string;
  provider_limited?: boolean;
  provider_limited_since?: string | null;
  provider_retry_at?: string | null;
  provider_reason?: string | null;
  queued_jobs?: number;
  processing_jobs?: number;
};

type UserSoftUsage = {
  daily_limit: number;
  used: number;
  remaining: number;
  reset_at: string;
};

type PlanTier = "free" | "pro" | "ultra";

type RoadmapGenerationJobStatus = "queued" | "running" | "partial_ready" | "completed" | "failed";
type RoadmapGenerationPhase = "ingest" | "syllabus" | "hydrate" | "validate" | "persist" | "complete";
type RoadmapTranslationLanguage = "en" | "zh-HK" | "kz" | "ru";
type RepoArchetype = "utility-lib" | "sdk" | "tooling" | "saas-app" | "infra";
type ChunkStatus = "pass" | "fail" | "partial_pass";
type StageRegenerationFlagStatus = "pending" | "approved" | "rejected" | "processing" | "completed" | "failed";
type RoadmapWorkerTaskType = "bootstrap" | "hydrate_chunk" | "regenerate_stage" | "translate_prefetch";
type StageFailCode =
  | "missing_actionability"
  | "low_repo_concept_coverage"
  | "template_phrase_repetition"
  | "low_source_file_relevance"
  | "invalid_command_set"
  | "cross_stage_duplication"
  | "low_grounding"
  | "low_dedupe";

type StageValidationMetrics = {
  actionabilityScore: number;
  conceptCoverageScore: number;
  noveltyScore: number;
  commandFileRealismScore: number;
  checkpointCoherenceScore: number;
  templateRiskScore: number;
};

type StageValidationReport = {
  stage: Record<string, unknown>;
  qualityScore: number;
  groundingScore: number;
  conceptCoverageScore: number;
  templateRiskScore: number;
  metrics: StageValidationMetrics;
  ok: boolean;
  failCodes: StageFailCode[];
  failReasons: string[];
};

type StageRepairAttemptReport = {
  stage_id: string;
  attempt_count: number;
  fail_codes: StageFailCode[];
  fail_reasons: string[];
  last_model: string;
};

type RepoIdentity = {
  owner: string;
  repo: string;
  fullName: string;
};

type CurriculumComplexity = {
  score: number;
  logicalStageTarget: number;
  stageTarget: number;
  mode: "single_track" | "multi_track";
  archetype: RepoArchetype;
};

type RepoIngestSnapshot = {
  snapshotKey: string;
  repoSummary: Record<string, unknown>;
  commitContextLines: string[];
  commitClusters: Array<{
    theme: string;
    commit_count: number;
    samples: string[];
  }>;
  treeStats: {
    fileCount: number;
    topLevelDirs: string[];
    manifests: string[];
    hotPaths: string[];
    featureKeywords: string[];
    architectureMap: Record<string, unknown>;
    apiConcepts: string[];
    knownFiles: string[];
    packageManager: "pnpm" | "npm" | "yarn" | "bun" | "unknown";
    scripts: string[];
    archetype: RepoArchetype;
  };
  readmeExcerpt: string;
  complexity: CurriculumComplexity;
  stageTarget: number;
  logicalStageTarget: number;
};

type StageEvidenceRef = {
  stage_id: string;
  objective: string;
  themes: string[];
  hot_paths: string[];
  feature_keywords: string[];
  readme_hints: string[];
  api_concepts: string[];
  archetype: RepoArchetype;
};

type RoadmapSyllabusNode = {
  id: string;
  index: number;
  title: string;
  summary: string;
  category: string;
  difficulty: string;
  goals: string[];
  prerequisites: string[];
  checkpoints: string[];
  source_themes: string[];
  optional_peeks: string[];
};

type RouteContext = {
  supabase: SupabaseClient;
  req: Request;
  path: string;
  url: URL;
};

type AuthedRouteContext = RouteContext & {
  userId: string;
  planTier: PlanTier;
  authPayload: JWTPayload;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret, x-worker-secret, x-admin-user",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CLERK_JWKS_URL = Deno.env.get("CLERK_JWKS_URL") ?? "";
const CLERK_ISSUER = Deno.env.get("CLERK_ISSUER") ?? "";
const CLERK_AUDIENCE = Deno.env.get("CLERK_AUDIENCE") ?? "";
const CLERK_AUTHORIZED_PARTIES = (Deno.env.get("CLERK_AUTHORIZED_PARTIES") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const CLERK_FALLBACK_AUTHORIZED_PARTIES = [
  "https://app.commitly.one",
  "https://commitly-frontend.vercel.app",
];

const GITHUB_API_BASE = (Deno.env.get("GITHUB_API_BASE") ?? "https://api.github.com").replace(/\/$/, "");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const GITHUB_OAUTH_CLIENT_ID = Deno.env.get("GITHUB_OAUTH_CLIENT_ID") ?? "";
const GITHUB_OAUTH_CLIENT_SECRET = Deno.env.get("GITHUB_OAUTH_CLIENT_SECRET") ?? "";
const GITHUB_OAUTH_REDIRECT_URI = Deno.env.get("GITHUB_OAUTH_REDIRECT_URI") ?? "";
const GITHUB_OAUTH_SCOPE = Deno.env.get("GITHUB_OAUTH_SCOPE") ?? "read:user public_repo";
const GITHUB_OAUTH_SUCCESS_REDIRECT = Deno.env.get("GITHUB_OAUTH_SUCCESS_REDIRECT") ?? "/";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_ALLOW_PRO_MODELS = (Deno.env.get("GEMINI_ALLOW_PRO_MODELS") ?? "false").toLowerCase() === "true";
const GEMINI_FALLBACK_MODELS = (Deno.env.get("GEMINI_FALLBACK_MODELS") ?? "gemini-2.5-flash")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ??
  (GEMINI_ALLOW_PRO_MODELS ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview");
const GEMINI_REQUEST_TIMEOUT_MS = Number(Deno.env.get("GEMINI_REQUEST_TIMEOUT_MS") ?? "45000");
const GITHUB_REQUEST_TIMEOUT_MS = Number(Deno.env.get("GITHUB_REQUEST_TIMEOUT_MS") ?? "25000");
const GEMINI_BASE_MODELS = ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview"] as const;
const GEMINI_PRO_MODELS = ["gemini-3.1-pro-preview"] as const;
const GEMINI_ACTIVE_MODELS = GEMINI_ALLOW_PRO_MODELS
  ? [...GEMINI_BASE_MODELS, ...GEMINI_PRO_MODELS]
  : [...GEMINI_BASE_MODELS];
const GEMINI_MODEL_CANDIDATES = Array.from(
  new Set(
    [
      GEMINI_MODEL,
      ...GEMINI_ACTIVE_MODELS,
      ...GEMINI_FALLBACK_MODELS,
    ].filter((model) => typeof model === "string" && model.trim().length > 0),
  ),
);
const GEMINI_MODELS_PLANNER = GEMINI_ALLOW_PRO_MODELS
  ? ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", "gemini-3.1-pro-preview", ...GEMINI_FALLBACK_MODELS]
  : ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", ...GEMINI_FALLBACK_MODELS];
const GEMINI_MODELS_HYDRATOR = GEMINI_ALLOW_PRO_MODELS
  ? ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", "gemini-3.1-pro-preview", ...GEMINI_FALLBACK_MODELS]
  : ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", ...GEMINI_FALLBACK_MODELS];
const GEMINI_MODELS_REPAIR = GEMINI_ALLOW_PRO_MODELS
  ? ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", "gemini-3.1-pro-preview", ...GEMINI_FALLBACK_MODELS]
  : ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", ...GEMINI_FALLBACK_MODELS];
const GEMINI_MODELS_CHAT = GEMINI_ALLOW_PRO_MODELS
  ? ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", "gemini-3.1-pro-preview", ...GEMINI_FALLBACK_MODELS]
  : ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", ...GEMINI_FALLBACK_MODELS];
const GEMINI_MODELS_TRANSLATE = GEMINI_ALLOW_PRO_MODELS
  ? ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", "gemini-3.1-pro-preview", ...GEMINI_FALLBACK_MODELS]
  : ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", ...GEMINI_FALLBACK_MODELS];
const ADMIN_CATALOG_SECRET = Deno.env.get("ADMIN_CATALOG_SECRET") ?? "";
const ROADMAP_WORKER_SECRET = Deno.env.get("ROADMAP_WORKER_SECRET") ?? "";
const WORKER_DEFAULT_BATCH_SIZE = Number(Deno.env.get("WORKER_DEFAULT_BATCH_SIZE") ?? "4");
const WORKER_MAX_BATCH_SIZE = Number(Deno.env.get("WORKER_MAX_BATCH_SIZE") ?? "12");
const WORKER_MAX_RETRIES = Number(Deno.env.get("WORKER_MAX_RETRIES") ?? "3");
const PROVIDER_RATE_LIMIT_LOOKBACK_MINUTES = Number(Deno.env.get("PROVIDER_RATE_LIMIT_LOOKBACK_MINUTES") ?? "30");
const PROVIDER_RATE_LIMIT_COOLDOWN_MINUTES = Number(Deno.env.get("PROVIDER_RATE_LIMIT_COOLDOWN_MINUTES") ?? "12");
const PROVIDER_RATE_LIMIT_REGEX = /(resource_exhausted|rate[\s_-]?limit|quota|too many requests|429)/i;

const GLOBAL_DAILY_TOKEN_LIMIT = Number(Deno.env.get("GLOBAL_DAILY_TOKEN_LIMIT") ?? "2500000");
const USER_DAILY_TOKEN_SOFT_LIMIT = Number(Deno.env.get("USER_DAILY_TOKEN_SOFT_LIMIT") ?? "120000");
const PLAN_SOFT_LIMITS: Record<PlanTier, number> = {
  free: 120_000,
  pro: 300_000,
  ultra: 700_000,
};
const CURRICULUM_PIPELINE_VERSION = "v2.4";
const ROADMAP_TRANSLATION_LANGUAGES: RoadmapTranslationLanguage[] = ["en", "zh-HK", "kz", "ru"];
const ROADMAP_TRANSLATION_LANGUAGE_LABELS: Record<RoadmapTranslationLanguage, string> = {
  en: "English",
  "zh-HK": "Cantonese (Traditional Chinese, Hong Kong)",
  kz: "Kazakh",
  ru: "Russian",
};

const jwks = CLERK_JWKS_URL ? createRemoteJWKSet(new URL(CLERK_JWKS_URL)) : null;
const REPO_GENERIC_TERMS = new Set([
  "project",
  "repo",
  "repository",
  "code",
  "feature",
  "features",
  "build",
  "setup",
  "configuration",
  "config",
  "module",
  "stage",
  "task",
  "utility",
  "app",
  "application",
  "typescript",
  "javascript",
  "node",
  "package",
  "framework",
  "function",
  "functions",
  "tests",
  "testing",
  "lint",
  "tooling",
  "workflow",
  "guide",
  "docs",
  "readme",
]);
const SIMILARITY_STOPWORDS = new Set([
  "implement",
  "build",
  "define",
  "map",
  "harden",
  "behavior",
  "contract",
  "logic",
  "inputs",
  "input",
  "output",
  "outputs",
  "cases",
  "edge",
  "tests",
  "test",
  "verify",
  "validation",
  "end",
  "stage",
  "core",
]);
const TEMPLATE_TASK_PATTERNS = [
  /define .*scope and acceptance checks/i,
  /implement .*in your own workspace/i,
  /verify .*with tests and checks/i,
  /implement .* in .* with explicit input\/output behavior/i,
  /add at least one verification case/i,
  /run the validation command and record the passing result/i,
  /implement (finalize|verify|check|create) .* in (readme\.md|package\.json|[^ ]*config[^ ]*)/i,
];
const TEMPLATE_SCAFFOLD_STEP_PATTERNS = [
  /define concrete invariants for .* and list expected outputs/i,
  /implement the first iteration in .* and cover one edge case immediately/i,
  /run tests and verify invariant checks pass/i,
  /add focused tests for normal, invalid, and boundary inputs/i,
  /run validation scripts and confirm zero regressions/i,
  /write regression tests that lock expected behavior for tricky inputs/i,
  /re-run full checks and confirm stable output/i,
  /with explicit input parsing/i,
];
const NON_SOURCE_FILE_PATTERNS = [
  /^package\.json$/i,
  /^pnpm-lock\.yaml$/i,
  /^package-lock\.json$/i,
  /^yarn\.lock$/i,
  /^bun\.lockb?$/i,
  /^tsconfig\.json$/i,
  /^biome\.json$/i,
  /^eslint(\.config)?\.[a-z0-9]+$/i,
  /^prettier(\.config)?\.[a-z0-9]+$/i,
  /^\.github\//i,
];
const DISALLOWED_TASK_COMMAND_PATTERNS = [
  /^git\s+/i,
  /^mkdir\b/i,
  /^touch\b/i,
  /^rm\b/i,
  /^cp\b/i,
  /^mv\b/i,
  /^grep\b/i,
  /^ls\b/i,
  /^cat\b/i,
];
const ALLOWED_TASK_COMMAND_PATTERNS = [
  /^(npm|pnpm|yarn|bun)\s+(run\s+[a-z0-9:_-]+|test|lint|build|typecheck|check|dev|add|install|init)\b/i,
  /^(npx|pnpm\s+dlx|bunx)\s+[a-z0-9@._:/-]+/i,
  /^(node|deno|python|python3|go|cargo)\b/i,
];
const CROSS_STAGE_SIMILARITY_LIMIT = 0.78;
const MIN_DEDUPE_SCORE = 60;
const MIN_GROUNDING_SCORE = 65;
const MIN_CONCEPT_COVERAGE_SCORE = 65;
const MAX_TEMPLATE_RISK_SCORE = 25;

const textEncoder = new TextEncoder();

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
) {
  return await Promise.race([
    fetch(url, init),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

function toJsonResponse(payload: Record<string, unknown>, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...Object.fromEntries(new Headers(extraHeaders).entries()),
    },
  });
}

function toTextResponse(payload: string, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(payload, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      ...Object.fromEntries(new Headers(extraHeaders).entries()),
    },
  });
}

function sanitizeControlChars(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function toNoContentResponse(status = 204) {
  return new Response(null, {
    status,
    headers: corsHeaders,
  });
}

function routeError(status: number, detail: string, code?: string) {
  return toJsonResponse(code ? { detail, code } : { detail }, status);
}

function createSupabaseAdminClient() {
  if (!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function extractApiPath(pathname: string) {
  const marker = "/api/v1/";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) {
    return pathname;
  }
  return pathname.slice(markerIndex);
}

function normalizePath(pathname: string) {
  let next = pathname.replace("/api/v1/api/v1/", "/api/v1/");
  if (next.length > 1 && next.endsWith("/")) {
    next = next.slice(0, -1);
  }
  return next;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const payload = await req.json();
    if (!(payload && typeof payload === "object")) {
      return {};
    }
    return payload as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizePreferredLanguage(value: unknown): RoadmapTranslationLanguage {
  if (typeof value !== "string") {
    return "en";
  }
  const normalized = value.trim();
  return ROADMAP_TRANSLATION_LANGUAGES.includes(normalized as RoadmapTranslationLanguage)
    ? (normalized as RoadmapTranslationLanguage)
    : "en";
}

function detectLikelyLanguage(value: string): RoadmapTranslationLanguage | null {
  const text = value.trim();
  if (!text) {
    return null;
  }
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/u.test(text)) {
    return "zh-HK";
  }
  if (/[ӘәҒғҚқҢңӨөҰұҮүІі]/u.test(text)) {
    return "kz";
  }
  if (/[А-Яа-яЁё]/u.test(text)) {
    return "ru";
  }
  if (/[A-Za-z]/.test(text)) {
    return "en";
  }
  return null;
}

function hashText(value: string) {
  let hash = 0x811c9dc5;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash ^= value.charCodeAt(idx);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return null;
  }
  return token.trim();
}

async function verifyClerkToken(token: string): Promise<JWTPayload> {
  if (!(jwks && CLERK_ISSUER)) {
    throw new Error("Clerk JWT verification is not configured");
  }

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, jwks, {
      issuer: CLERK_ISSUER,
      ...(CLERK_AUDIENCE ? { audience: CLERK_AUDIENCE } : {}),
    });
    payload = verified.payload;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "JWT verification failed";
    if (CLERK_AUDIENCE && detail.toLowerCase().includes("missing required \"aud\" claim")) {
      const verified = await jwtVerify(token, jwks, {
        issuer: CLERK_ISSUER,
      });
      payload = verified.payload;
    } else {
      throw error;
    }
  }

  if (CLERK_AUTHORIZED_PARTIES.length > 0) {
    const azpRaw = payload.azp;
    const azp = typeof azpRaw === "string" ? azpRaw.replace(/\/$/, "") : "";
    const normalizedAzp = (() => {
      if (!azp) {
        return "";
      }
      try {
        return new URL(azp).origin.replace(/\/$/, "");
      } catch {
        return azp;
      }
    })();
    const authorizedParties = new Set(
      [...CLERK_AUTHORIZED_PARTIES, ...CLERK_FALLBACK_AUTHORIZED_PARTIES].map((value) => {
        try {
          return new URL(value).origin.replace(/\/$/, "");
        } catch {
          return value.replace(/\/$/, "");
        }
      }),
    );
    if (!normalizedAzp || !authorizedParties.has(normalizedAzp)) {
      throw new Error("Unauthorized party");
    }
  }

  return payload;
}

function normalizePlanTier(value: unknown): PlanTier {
  if (typeof value !== "string") {
    return "free";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "ultra") {
    return "ultra";
  }
  if (normalized === "pro") {
    return "pro";
  }
  return "free";
}

function extractPlanTierFromPayload(payload: JWTPayload): PlanTier {
  const directPlanTier = normalizePlanTier(payload.planTier);
  if (directPlanTier !== "free") {
    return directPlanTier;
  }
  const directPlanName = normalizePlanTier(payload.planName);
  if (directPlanName !== "free") {
    return directPlanName;
  }

  const metadataCandidates: unknown[] = [];
  const publicMetadata = payload.public_metadata;
  const unsafeMetadata = payload.unsafe_metadata;
  const privateMetadata = payload.private_metadata;
  const userMetadata = payload.user_metadata;
  if (publicMetadata && typeof publicMetadata === "object") {
    metadataCandidates.push(publicMetadata);
  }
  if (unsafeMetadata && typeof unsafeMetadata === "object") {
    metadataCandidates.push(unsafeMetadata);
  }
  if (privateMetadata && typeof privateMetadata === "object") {
    metadataCandidates.push(privateMetadata);
  }
  if (userMetadata && typeof userMetadata === "object") {
    metadataCandidates.push(userMetadata);
  }
  const metadata = payload.metadata;
  if (metadata && typeof metadata === "object") {
    metadataCandidates.push(metadata);
  }

  for (const candidate of metadataCandidates) {
    const record = candidate as Record<string, unknown>;
    const tier = normalizePlanTier(record.planTier ?? record.plan_tier ?? record.plan ?? record.tier);
    if (tier !== "free") {
      return tier;
    }
  }
  return "free";
}

async function getAuthContext(req: Request, required = true): Promise<{
  userId: string | null;
  payload: JWTPayload | null;
  planTier: PlanTier;
}> {
  const token = getBearerToken(req);
  if (!token) {
    if (required) {
      throw new Error("Missing authentication token");
    }
    return {
      userId: null,
      payload: null,
      planTier: "free",
    };
  }

  const payload = await verifyClerkToken(token);
  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId && required) {
    throw new Error("User ID missing in token");
  }
  return {
    userId,
    payload,
    planTier: extractPlanTierFromPayload(payload),
  };
}

async function getAuthedUserId(req: Request, required = true) {
  const authContext = await getAuthContext(req, required);
  return authContext.userId;
}

function mapAuthErrorCode(detail: string) {
  const normalized = detail.toLowerCase();
  if (normalized.includes("unauthorized party")) {
    return "unauthorized_party";
  }
  if (normalized.includes("missing authentication token")) {
    return "missing_token";
  }
  return "invalid_token";
}

async function sha256(input: string) {
  const data = textEncoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseRepoUrl(repoUrl: string): RepoIdentity {
  const raw = repoUrl.trim();
  if (!raw) {
    throw new Error("Repository URL is required");
  }

  let path = raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const parsed = new URL(raw);
    path = parsed.pathname;
  } else if (raw.startsWith("github.com")) {
    const parsed = new URL(`https://${raw}`);
    path = parsed.pathname;
  }

  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.replace(/\.git$/i, ""));

  if (segments.length !== 2) {
    throw new Error("Invalid GitHub repository URL");
  }

  const [owner, repo] = segments;
  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
  };
}

async function githubRequest<T>(path: string, token: string | null | undefined, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  if (typeof token === "string" && token.length > 0) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const timeoutMs = Number.isFinite(GITHUB_REQUEST_TIMEOUT_MS) ? Math.max(5_000, GITHUB_REQUEST_TIMEOUT_MS) : 25_000;
  const response = await fetchWithTimeout(
    `${GITHUB_API_BASE}${path}`,
    {
      ...init,
      headers,
    },
    timeoutMs,
    "GitHub request timeout",
  );

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`GitHub API ${response.status}: ${bodyText || response.statusText}`);
  }

  return (await response.json()) as T;
}

async function githubRequestRaw(path: string, token: string | null | undefined): Promise<string> {
  const headers = new Headers();
  headers.set("Accept", "application/vnd.github.raw+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  if (typeof token === "string" && token.length > 0) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const timeoutMs = Number.isFinite(GITHUB_REQUEST_TIMEOUT_MS) ? Math.max(5_000, GITHUB_REQUEST_TIMEOUT_MS) : 25_000;
  const response = await fetchWithTimeout(
    `${GITHUB_API_BASE}${path}`,
    {
      method: "GET",
      headers,
    },
    timeoutMs,
    "GitHub request timeout",
  );

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`GitHub API ${response.status}: ${bodyText || response.statusText}`);
  }

  return await response.text();
}

function buildSnapshotKey(options: {
  fullName: string;
  defaultBranch: string;
  headSha: string;
}) {
  const base = `${options.fullName}:${options.defaultBranch}:${options.headSha}:${CURRICULUM_PIPELINE_VERSION}`;
  return base.toLowerCase();
}

function summarizeCommitClusters(commitLines: string[]) {
  const themeRules: Array<{ theme: string; match: RegExp }> = [
    { theme: "setup-and-tooling", match: /(init|setup|config|ci|lint|build|deps?|upgrade|chore)/i },
    { theme: "auth-and-user-flows", match: /(auth|login|signup|session|user|clerk|oauth)/i },
    { theme: "data-and-persistence", match: /(db|sql|schema|migration|query|cache|redis|supabase)/i },
    { theme: "api-and-backend", match: /(api|endpoint|server|route|handler|http|rpc|edge)/i },
    { theme: "ui-and-ux", match: /(ui|ux|style|css|layout|component|page|design|theme)/i },
    { theme: "testing-and-quality", match: /(test|spec|bug|fix|refactor|quality|validate)/i },
    { theme: "performance-and-observability", match: /(perf|optimi|latency|trace|log|monitor|analytics)/i },
  ];

  const bucket = new Map<string, string[]>();
  for (const line of commitLines) {
    let matchedTheme = "product-iterations";
    for (const rule of themeRules) {
      if (rule.match.test(line)) {
        matchedTheme = rule.theme;
        break;
      }
    }
    const list = bucket.get(matchedTheme) ?? [];
    list.push(line);
    bucket.set(matchedTheme, list);
  }

  return Array.from(bucket.entries())
    .map(([theme, commits]) => ({
      theme,
      commit_count: commits.length,
      samples: commits.slice(0, 8),
    }))
    .sort((a, b) => b.commit_count - a.commit_count);
}

function normalizeKeywordToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\-_/]+/g, " ")
    .trim();
}

function classifyRepoArchetype(options: {
  description: string;
  topics: string[];
  manifests: string[];
  topLevelDirs: string[];
  fileCount: number;
  repoSizeKb: number;
}): RepoArchetype {
  const description = options.description.toLowerCase();
  const topics = options.topics.map((topic) => topic.toLowerCase());
  const manifests = options.manifests.map((item) => item.toLowerCase());
  const dirs = options.topLevelDirs.map((item) => item.toLowerCase());

  const has = (patterns: RegExp[]) =>
    patterns.some((pattern) =>
      pattern.test(description) ||
      topics.some((topic) => pattern.test(topic)) ||
      dirs.some((dir) => pattern.test(dir)) ||
      manifests.some((manifest) => pattern.test(manifest)));

  if (has([/\b(terraform|k8s|kubernetes|helm|ansible|iac|infrastructure|deployment)\b/])) {
    return "infra";
  }
  if (has([/\b(sdk|client|api-client|typescript-sdk|javascript-sdk)\b/])) {
    return "sdk";
  }
  if (has([/\b(cli|linter|compiler|bundler|plugin|tooling|formatter|build-tool)\b/])) {
    return "tooling";
  }
  if (
    has([/\b(saas|dashboard|frontend|backend|fullstack|platform|webapp|application)\b/]) ||
    dirs.some((dir) => ["app", "apps", "web", "dashboard", "server", "api"].includes(dir))
  ) {
    return "saas-app";
  }

  if (
    has([/\b(utility|helpers?|library|parser|formatter|convert|conversion)\b/]) ||
    options.fileCount < 180 ||
    options.repoSizeKb < 4000
  ) {
    return "utility-lib";
  }

  return "saas-app";
}

function extractFeatureKeywords(options: {
  topics: string[];
  description: string;
  readmeExcerpt: string;
}) {
  const tokens: string[] = [];
  tokens.push(...options.topics);
  tokens.push(...options.description.split(/[\s,.;:()[\]{}"'`]+/));
  const headingTokens = options.readmeExcerpt
    .split("\n")
    .filter((line) => /^#{1,4}\s/.test(line.trim()) || /^[-*]\s/.test(line.trim()))
    .flatMap((line) => line.replace(/^#{1,4}\s*/, "").split(/[\s,.;:()[\]{}"'`]+/));
  tokens.push(...headingTokens);

  const normalized = tokens
    .map((token) => normalizeKeywordToken(token))
    .flatMap((token) => token.split(/\s+/))
    .filter((token) => token.length >= 3 && token.length <= 24 && !REPO_GENERIC_TERMS.has(token));

  const counts = new Map<string, number>();
  for (const token of normalized) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([token]) => token);
}

function buildArchitectureMap(options: {
  archetype: RepoArchetype;
  manifests: string[];
  topLevelDirs: string[];
  hotPaths: string[];
}) {
  const entrypoints = options.hotPaths
    .filter((path) => /(src\/index|src\/main|index\.ts|index\.js|cli\.|server\.|api\/)/i.test(path))
    .slice(0, 12);
  const runtime = options.manifests.some((path) => path.endsWith("pyproject.toml") || path.endsWith("requirements.txt"))
    ? "python"
    : options.manifests.some((path) => path.endsWith("Cargo.toml"))
      ? "rust"
      : options.manifests.some((path) => path.endsWith("go.mod"))
        ? "go"
        : "javascript-typescript";

  return {
    archetype: options.archetype,
    runtime,
    package_manager: options.manifests.some((path) => path.endsWith("pnpm-lock.yaml"))
      ? "pnpm"
      : options.manifests.some((path) => path.endsWith("package-lock.json"))
        ? "npm"
        : options.manifests.some((path) => path.endsWith("yarn.lock"))
          ? "yarn"
          : "unknown",
    top_level_dirs: options.topLevelDirs.slice(0, 24),
    manifests: options.manifests.slice(0, 24),
    entrypoints,
  };
}

function detectPackageManager(options: {
  packageManagerField?: string;
  manifests: string[];
}) {
  const field = String(options.packageManagerField ?? "").toLowerCase();
  if (field.startsWith("pnpm")) {
    return "pnpm" as const;
  }
  if (field.startsWith("yarn")) {
    return "yarn" as const;
  }
  if (field.startsWith("bun")) {
    return "bun" as const;
  }
  if (field.startsWith("npm")) {
    return "npm" as const;
  }
  if (options.manifests.some((path) => path.endsWith("pnpm-lock.yaml"))) {
    return "pnpm" as const;
  }
  if (options.manifests.some((path) => path.endsWith("yarn.lock"))) {
    return "yarn" as const;
  }
  if (options.manifests.some((path) => path.endsWith("bun.lockb"))) {
    return "bun" as const;
  }
  if (options.manifests.some((path) => path.endsWith("package-lock.json"))) {
    return "npm" as const;
  }
  return "unknown" as const;
}

function parsePackageScripts(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const scriptsRaw = parsed.scripts;
    const scripts = scriptsRaw && typeof scriptsRaw === "object"
      ? Object.keys(scriptsRaw as Record<string, unknown>)
      : [];
    return {
      packageManagerField: typeof parsed.packageManager === "string" ? parsed.packageManager : "",
      scripts: scripts
        .map((script) => String(script).trim())
        .filter((script) => script.length > 0)
        .slice(0, 64),
    };
  } catch {
    return {
      packageManagerField: "",
      scripts: [] as string[],
    };
  }
}

function computeCurriculumComplexity(options: {
  repoSizeKb: number;
  commitSampleCount: number;
  fileCount: number;
  topLevelDirCount: number;
  manifestCount: number;
  clusterCount: number;
  archetype: RepoArchetype;
}): CurriculumComplexity {
  const {
    repoSizeKb,
    commitSampleCount,
    fileCount,
    topLevelDirCount,
    manifestCount,
    clusterCount,
    archetype,
  } = options;
  const rawScore =
    (Math.log10(Math.max(repoSizeKb, 1)) * 8) +
    (commitSampleCount * 0.35) +
    (fileCount * 0.018) +
    (topLevelDirCount * 1.1) +
    (manifestCount * 2.4) +
    (clusterCount * 1.3);
  const score = Number(rawScore.toFixed(2));
  const tinyRepo = fileCount <= 120 || repoSizeKb <= 1500;
  const smallRepo = fileCount <= 480 || repoSizeKb <= 7000;

  let stageTarget = Math.max(6, Math.min(48, Math.round(6 + rawScore * 0.34)));
  let logicalStageTarget = Math.max(10, Math.min(320, Math.round(10 + rawScore * 1.2)));

  if (archetype === "utility-lib") {
    stageTarget = Math.max(6, Math.min(18, stageTarget));
    logicalStageTarget = Math.max(10, Math.min(40, logicalStageTarget));
  } else if (archetype === "sdk") {
    stageTarget = Math.max(8, Math.min(28, stageTarget));
    logicalStageTarget = Math.max(12, Math.min(56, logicalStageTarget));
  } else if (archetype === "tooling") {
    stageTarget = Math.max(10, Math.min(30, stageTarget));
    logicalStageTarget = Math.max(14, Math.min(70, logicalStageTarget));
  } else if (archetype === "infra") {
    stageTarget = Math.max(10, Math.min(36, stageTarget));
    logicalStageTarget = Math.max(16, Math.min(90, logicalStageTarget));
  } else {
    stageTarget = Math.max(12, Math.min(48, stageTarget));
    logicalStageTarget = Math.max(20, Math.min(200, logicalStageTarget));
  }

  if (tinyRepo) {
    stageTarget = Math.min(stageTarget, 14);
    logicalStageTarget = Math.min(logicalStageTarget, 24);
  } else if (smallRepo) {
    stageTarget = Math.min(stageTarget, 28);
    logicalStageTarget = Math.min(logicalStageTarget, 42);
  }

  const mode: CurriculumComplexity["mode"] = logicalStageTarget > Math.max(40, stageTarget * 2) ? "multi_track" : "single_track";
  return {
    score,
    logicalStageTarget,
    stageTarget,
    mode,
    archetype,
  };
}

function compactReadme(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .join("\n")
    .slice(0, 5000);
}

async function collectCommitHotPaths(
  repoFullName: string,
  commits: Array<Record<string, unknown>>,
  token: string | null,
  limit: number,
) {
  const sample = commits.slice(0, Math.max(4, Math.min(limit, commits.length)));
  const pathScores = new Map<string, number>();

  for (const commit of sample) {
    const sha = String(commit.sha ?? "").trim();
    if (!sha) {
      continue;
    }
    try {
      const detail = await githubRequest<Record<string, unknown>>(
        `/repos/${repoFullName}/commits/${encodeURIComponent(sha)}`,
        token,
      );
      const changedFiles = Array.isArray(detail.files) ? detail.files as Array<Record<string, unknown>> : [];
      for (const file of changedFiles) {
        const filename = String(file.filename ?? "").trim();
        if (!filename) {
          continue;
        }
        const additions = Number(file.additions ?? 0);
        const deletions = Number(file.deletions ?? 0);
        const score = Math.max(1, Math.round((Math.max(additions, 0) + Math.max(deletions, 0)) / 12));
        pathScores.set(filename, (pathScores.get(filename) ?? 0) + score);
      }
    } catch {
      // Best-effort enrichment. Missing commit details should not fail generation.
      continue;
    }
  }

  return Array.from(pathScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([path]) => path);
}

function extractApiConcepts(hotPaths: string[], featureKeywords: string[]) {
  const conceptTokens = new Map<string, number>();
  for (const path of hotPaths) {
    const segments = path
      .replace(/\.[a-z0-9]+$/i, "")
      .split(/[\/_-]/g)
      .map((segment) => normalizeKeywordToken(segment))
      .filter((segment) => segment.length >= 3 && !REPO_GENERIC_TERMS.has(segment));
    for (const segment of segments) {
      conceptTokens.set(segment, (conceptTokens.get(segment) ?? 0) + 2);
    }
  }

  for (const keyword of featureKeywords) {
    conceptTokens.set(keyword, (conceptTokens.get(keyword) ?? 0) + 1);
  }

  return Array.from(conceptTokens.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([token]) => token);
}

async function collectRepoIngestSnapshot(options: {
  supabase: SupabaseClient;
  identity: RepoIdentity;
  githubToken: string | null;
  usageMode: "normal" | "low" | "critical";
}) {
  const { supabase, identity, githubToken, usageMode } = options;
  const commitLimit = usageMode === "low" ? 90 : 140;

  const repo = await githubRequest<Record<string, unknown>>(`/repos/${identity.fullName}`, githubToken);
  const defaultBranch = String(repo.default_branch ?? "main");
  const commits = await githubRequest<Array<Record<string, unknown>>>(
    `/repos/${identity.fullName}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=${commitLimit}`,
    githubToken,
  );
  if (commits.length === 0) {
    throw new Error("Repository does not contain commits");
  }

  const commitsChronological = [...commits].reverse();
  const commitContextLines = commitsChronological
    .map((commit) => {
      const sha = String(commit.sha ?? "").slice(0, 7);
      const message = String((commit.commit as Record<string, unknown> | undefined)?.message ?? "").split("\n")[0];
      return `${sha}: ${message}`;
    })
    .filter((line) => line.length > 0);

  const headSha = String(commits[0]?.sha ?? "").slice(0, 12);
  const snapshotKey = buildSnapshotKey({
    fullName: identity.fullName,
    defaultBranch,
    headSha,
  });

  const { data: existingSnapshot } = await supabase
    .from("repo_ingest_snapshots")
    .select("*")
    .eq("snapshot_key", snapshotKey)
    .maybeSingle();

  if (existingSnapshot) {
    const { data: clusters } = await supabase
      .from("repo_commit_clusters")
      .select("*")
      .eq("snapshot_key", snapshotKey)
      .order("cluster_rank", { ascending: true });

    const cachedTreeStats = (existingSnapshot.tree_stats ?? {}) as Record<string, unknown>;
    const cachedComplexity = (existingSnapshot.complexity ?? {}) as Record<string, unknown>;
    const cachedArchetypeRaw = String(
      cachedTreeStats.archetype ??
        cachedComplexity.archetype ??
        "utility-lib",
    );
    const cachedArchetype: RepoArchetype = (
      ["utility-lib", "sdk", "tooling", "saas-app", "infra"].includes(cachedArchetypeRaw)
        ? cachedArchetypeRaw
        : "utility-lib"
    ) as RepoArchetype;
    return {
      snapshotKey,
      repoSummary: (existingSnapshot.repo_summary ?? {}) as Record<string, unknown>,
      commitContextLines: Array.isArray(existingSnapshot.commit_context)
        ? (existingSnapshot.commit_context as unknown[]).map((line) => String(line))
        : commitContextLines,
      commitClusters: (clusters ?? []).map((row) => ({
        theme: String(row.theme ?? "product-iterations"),
        commit_count: Number(row.commit_count ?? 0),
        samples: Array.isArray(row.samples)
          ? (row.samples as unknown[]).map((item) => String(item))
          : [],
      })),
      treeStats: {
        fileCount: Number(cachedTreeStats.file_count ?? 0),
        topLevelDirs: Array.isArray(cachedTreeStats.top_level_dirs)
          ? (cachedTreeStats.top_level_dirs as unknown[]).map((item) => String(item))
          : [],
        manifests: Array.isArray(cachedTreeStats.manifests)
          ? (cachedTreeStats.manifests as unknown[]).map((item) => String(item))
          : [],
        hotPaths: Array.isArray(cachedTreeStats.hot_paths)
          ? (cachedTreeStats.hot_paths as unknown[]).map((item) => String(item))
          : [],
        featureKeywords: Array.isArray(cachedTreeStats.feature_keywords)
          ? (cachedTreeStats.feature_keywords as unknown[]).map((item) => String(item))
          : [],
        architectureMap: cachedTreeStats.architecture_map && typeof cachedTreeStats.architecture_map === "object"
          ? (cachedTreeStats.architecture_map as Record<string, unknown>)
          : {},
        apiConcepts: Array.isArray(cachedTreeStats.api_concepts)
          ? (cachedTreeStats.api_concepts as unknown[]).map((item) => String(item))
          : [],
        knownFiles: Array.isArray(cachedTreeStats.known_files)
          ? (cachedTreeStats.known_files as unknown[]).map((item) => String(item))
          : [],
        packageManager: (
          ["pnpm", "npm", "yarn", "bun", "unknown"].includes(String(cachedTreeStats.package_manager ?? "unknown"))
            ? String(cachedTreeStats.package_manager ?? "unknown")
            : "unknown"
        ) as RepoIngestSnapshot["treeStats"]["packageManager"],
        scripts: Array.isArray(cachedTreeStats.scripts)
          ? (cachedTreeStats.scripts as unknown[]).map((item) => String(item))
          : [],
        archetype: cachedArchetype,
      },
      readmeExcerpt: String(existingSnapshot.readme_excerpt ?? ""),
      complexity: {
        score: Number(cachedComplexity.score ?? 0),
        logicalStageTarget: Number(cachedComplexity.logical_stage_target ?? Number(existingSnapshot.logical_stage_target ?? 10)),
        stageTarget: Number(cachedComplexity.stage_target ?? Number(existingSnapshot.stage_target ?? 10)),
        mode: String(cachedComplexity.mode ?? "single_track") as CurriculumComplexity["mode"],
        archetype: cachedArchetype,
      },
      stageTarget: Number(existingSnapshot.stage_target ?? 10),
      logicalStageTarget: Number(existingSnapshot.logical_stage_target ?? Number(existingSnapshot.stage_target ?? 10)),
    } as RepoIngestSnapshot;
  }

  const treePayload = await githubRequest<Record<string, unknown>>(
    `/repos/${identity.fullName}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
    githubToken,
  );
  const tree = Array.isArray(treePayload.tree) ? (treePayload.tree as Array<Record<string, unknown>>) : [];
  const filePaths = tree
    .filter((entry) => String(entry.type ?? "") === "blob")
    .map((entry) => String(entry.path ?? ""))
    .filter(Boolean);
  const topLevelDirs = Array.from(new Set(filePaths.map((path) => path.split("/")[0]).filter(Boolean))).slice(0, 250);
  const manifestNames = [
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "Gemfile",
    "composer.json",
    "pom.xml",
    "build.gradle",
  ];
  const manifests = filePaths.filter((path) => manifestNames.some((name) => path.endsWith(name))).slice(0, 120);
  const knownFiles = filePaths.slice(0, 900);

  let packageScripts: string[] = [];
  let packageManagerField = "";
  try {
    if (filePaths.includes("package.json")) {
      const packageRaw = await githubRequestRaw(
        `/repos/${identity.fullName}/contents/package.json?ref=${encodeURIComponent(defaultBranch)}`,
        githubToken,
      );
      const parsedPackage = parsePackageScripts(packageRaw);
      packageScripts = parsedPackage.scripts;
      packageManagerField = parsedPackage.packageManagerField;
    }
  } catch {
    packageScripts = [];
    packageManagerField = "";
  }
  const packageManager = detectPackageManager({
    packageManagerField,
    manifests,
  });

  let readmeExcerpt = "";
  try {
    const readmeRaw = await githubRequestRaw(`/repos/${identity.fullName}/readme`, githubToken);
    readmeExcerpt = compactReadme(readmeRaw);
  } catch {
    readmeExcerpt = "";
  }

  const topics = Array.isArray(repo.topics)
    ? repo.topics.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const archetype = classifyRepoArchetype({
    description: String(repo.description ?? ""),
    topics,
    manifests,
    topLevelDirs,
    fileCount: filePaths.length,
    repoSizeKb: Number(repo.size ?? 0),
  });
  const hotPaths = await collectCommitHotPaths(
    identity.fullName,
    commits,
    githubToken,
    usageMode === "low" ? 14 : 26,
  );
  const featureKeywords = extractFeatureKeywords({
    topics,
    description: String(repo.description ?? ""),
    readmeExcerpt,
  });
  const apiConcepts = extractApiConcepts(hotPaths, featureKeywords);
  const architectureMap = buildArchitectureMap({
    archetype,
    manifests,
    topLevelDirs,
    hotPaths,
  });

  const commitClusters = summarizeCommitClusters(commitContextLines);
  const complexity = computeCurriculumComplexity({
    repoSizeKb: Number(repo.size ?? 0),
    commitSampleCount: commitContextLines.length,
    fileCount: filePaths.length,
    topLevelDirCount: topLevelDirs.length,
    manifestCount: manifests.length,
    clusterCount: commitClusters.length,
    archetype,
  });

  const stageTarget = complexity.stageTarget;
  const logicalStageTarget = complexity.logicalStageTarget;

  const repoSummary = {
    full_name: identity.fullName,
    description: String(repo.description ?? ""),
    language: String(repo.language ?? ""),
    stars: Number(repo.stargazers_count ?? 0),
    default_branch: defaultBranch,
    html_url: String(repo.html_url ?? `https://github.com/${identity.fullName}`),
    owner_avatar_url: String((repo.owner as Record<string, unknown> | undefined)?.avatar_url ?? ""),
    primary_language: String(repo.language ?? ""),
    languages: null,
    topics,
    difficulty: "easy",
    star_count: Number(repo.stargazers_count ?? 0),
    fork_count: Number(repo.forks_count ?? 0),
    last_pushed_at: String(repo.pushed_at ?? ""),
    license: String((repo.license as Record<string, unknown> | undefined)?.name ?? ""),
    contributor_count: 0,
  };

  await supabase
    .from("repo_ingest_snapshots")
    .upsert({
      snapshot_key: snapshotKey,
      pipeline_version: CURRICULUM_PIPELINE_VERSION,
      repo_full_name: identity.fullName,
      default_branch: defaultBranch,
      head_sha: headSha,
      repo_summary: repoSummary,
      commit_context: commitContextLines,
      tree_stats: {
        file_count: filePaths.length,
        top_level_dirs: topLevelDirs,
        manifests,
        hot_paths: hotPaths,
        feature_keywords: featureKeywords,
        architecture_map: architectureMap,
        api_concepts: apiConcepts,
        known_files: knownFiles,
        package_manager: packageManager,
        scripts: packageScripts,
        archetype,
      },
      readme_excerpt: readmeExcerpt,
      complexity: {
        score: complexity.score,
        logical_stage_target: logicalStageTarget,
        stage_target: stageTarget,
        mode: complexity.mode,
        archetype: complexity.archetype,
      },
      stage_target: stageTarget,
      logical_stage_target: logicalStageTarget,
    }, { onConflict: "snapshot_key" });

  if (commitClusters.length > 0) {
    await supabase
      .from("repo_commit_clusters")
      .delete()
      .eq("snapshot_key", snapshotKey);

    await supabase
      .from("repo_commit_clusters")
      .insert(commitClusters.map((cluster, idx) => ({
        snapshot_key: snapshotKey,
        cluster_rank: idx + 1,
        theme: cluster.theme,
        commit_count: cluster.commit_count,
        samples: cluster.samples,
      })));
  }

  return {
    snapshotKey,
    repoSummary,
    commitContextLines,
    commitClusters,
    treeStats: {
      fileCount: filePaths.length,
      topLevelDirs: topLevelDirs.slice(0, 120),
      manifests,
      hotPaths,
      featureKeywords,
      architectureMap,
      apiConcepts,
      knownFiles,
      packageManager,
      scripts: packageScripts,
      archetype,
    },
    readmeExcerpt,
    complexity,
    stageTarget,
    logicalStageTarget,
  } as RepoIngestSnapshot;
}

function isGitHubBadCredentialsError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes("GitHub API 401") && error.message.toLowerCase().includes("bad credentials");
}

function buildRoadmapPrompt(options: {
  repoName: string;
  description: string;
  language: string;
  topics: string[];
  commitsContext: string;
  stageBudget: number;
}) {
  const { repoName, description, language, topics, commitsContext, stageBudget } = options;

  return `You are Commitly, an expert engineering mentor designing STRICT beginner learning plans.

Repository: ${repoName}
Description: ${description || "N/A"}
Language: ${language || "Unknown"}
Topics: ${topics.join(", ") || "None"}

Commit context (oldest to newest):
${commitsContext}

TASK
Generate exactly ${stageBudget} beginner-friendly roadmap stages to rebuild this project from scratch.

HARD REQUIREMENTS
1) Never tell the learner to run "git clone", fork this repo, or copy existing source code.
2) Keep each stage concrete and practical.
3) Each stage must include:
- 1-3 goals
- 3-6 tasks
- explicit prerequisites/checkpoints where needed
4) Every task must use this schema:
{
  "label": "Task title",
  "steps": ["step 1", "step 2"],
  "files": ["path/file.ts"],
  "commands": ["npm run dev"]
}
5) Keep stages beginner-friendly, short, and actionable.
6) Status must always be "not-started".

Return ONLY JSON:
{
  "timeline": [
    {
      "id": "stage-1",
      "index": 1,
      "title": "...",
      "summary": "...",
      "status": "not-started",
      "eta": "45m",
      "category": "setup|feature|refactor|testing|ops|perf|docs|style|chore|other",
      "difficulty": "intro|easy|medium|hard",
      "goals": ["..."],
      "prerequisites": ["..."],
      "checkpoints": ["..."],
      "tasks": [{"label":"...","steps":["..."],"files":["..."],"commands":["..."]}],
      "code_examples": [{"file":"...","language":"...","description":"...","snippet":"..."}],
      "resources": [{"label":"...","href":"..."}],
      "commit_window": ["sha1","sha2"]
    }
  ]
}`;
}

function buildRoadmapReviewPrompt(timeline: unknown) {
  return `You are reviewing a beginner roadmap for clarity and token efficiency.

Improve this JSON timeline by:
- removing vague steps
- keeping beginner specificity
- ensuring tasks are actionable and concise
- removing any instruction that asks the learner to clone/fork/copy an existing repository
- preserving schema exactly

Return ONLY JSON with key "timeline".

Input JSON:
${JSON.stringify(timeline)}`;
}

function buildSyllabusPrompt(options: {
  repoName: string;
  description: string;
  language: string;
  topics: string[];
  readmeExcerpt: string;
  treeStats: RepoIngestSnapshot["treeStats"];
  commitClusters: RepoIngestSnapshot["commitClusters"];
  stageTarget: number;
  logicalStageTarget: number;
  mode: CurriculumComplexity["mode"];
}) {
  const clusterLines = options.commitClusters
    .map((cluster) => `- ${cluster.theme}: ${cluster.commit_count} commits\n  samples: ${cluster.samples.slice(0, 4).join(" | ")}`)
    .join("\n");
  const manifests = options.treeStats.manifests.slice(0, 16).join(", ");
  const topDirs = options.treeStats.topLevelDirs.slice(0, 25).join(", ");

  return `You are Commitly Curriculum Compiler v2.

Your job: design a beginner-first syllabus to rebuild the repository FROM SCRATCH.

Repository: ${options.repoName}
Description: ${options.description || "N/A"}
Language: ${options.language || "Unknown"}
Topics: ${options.topics.join(", ") || "None"}
Repo mode: ${options.mode}
Target generated stages: ${options.stageTarget}
Logical full-coverage stage target: ${options.logicalStageTarget}
Top-level folders: ${topDirs || "unknown"}
Manifest files: ${manifests || "none"}
Readme excerpt:
${options.readmeExcerpt || "N/A"}

Commit themes:
${clusterLines || "- product-iterations: sparse history"}

Rules:
1) Never instruct to clone/fork/copy original source.
2) Never use "inspect existing codebase/source" as a core task. Optional peeks are reference-only.
3) This must feel like OdinProject/Boot.dev style progression:
   - short module title
   - practical objective
   - concrete checkpoints
4) Ensure logical progression from setup to advanced internals.
5) Keep it beginner-safe but technically serious.
6) Return exactly ${options.stageTarget} stages.
7) If logical target is larger than generated stages, design each stage as a compact module that may include multiple lessons.
8) Include optional_peeks as brief references to what to inspect in the original repo (not to copy).

Return ONLY JSON:
{
  "syllabus": [
    {
      "id": "stage-1",
      "index": 1,
      "title": "...",
      "summary": "...",
      "category": "setup|feature|refactor|testing|ops|perf|docs|style|chore|other",
      "difficulty": "intro|easy|medium|hard",
      "goals": ["..."],
      "prerequisites": ["..."],
      "checkpoints": ["..."],
      "source_themes": ["..."],
      "optional_peeks": ["..."]
    }
  ]
}`;
}

function buildSyllabusRepairPrompt(options: {
  repoName: string;
  readmeExcerpt: string;
  commitClusters: RepoIngestSnapshot["commitClusters"];
  stageTarget: number;
  failureReason: string;
  previousSyllabus: unknown;
}) {
  const clusterLines = options.commitClusters
    .slice(0, 10)
    .map((cluster) => `${cluster.theme}: ${cluster.samples.slice(0, 3).join(" | ")}`)
    .join("\n");

  return `You are Commitly Syllabus Repair engine.

Your previous syllabus output failed strict quality validation.
Repository: ${options.repoName}
Target stages: ${options.stageTarget}
Failure reason:
${options.failureReason}

Readme context:
${options.readmeExcerpt || "N/A"}

Commit theme references:
${clusterLines || "N/A"}

Previous invalid syllabus JSON:
${JSON.stringify(options.previousSyllabus)}

Hard rules:
1) Return EXACTLY ${options.stageTarget} stages.
2) Never use template titles like "Stage 2" or "Module 3".
3) Every title must be specific to a subsystem or milestone.
4) Every stage needs concrete summary, goals, and checkpoints.
5) Never instruct clone/fork/copy/inspect-existing-code as core workflow.
6) Learner always builds from scratch in their own workspace.

Return ONLY JSON:
{
  "syllabus": [
    {
      "id": "stage-1",
      "index": 1,
      "title": "...",
      "summary": "...",
      "category": "setup|feature|refactor|testing|ops|perf|docs|style|chore|other",
      "difficulty": "intro|easy|medium|hard",
      "goals": ["..."],
      "prerequisites": ["..."],
      "checkpoints": ["..."],
      "source_themes": ["..."],
      "optional_peeks": ["..."]
    }
  ]
}`;
}

function buildStageHydrationPrompt(options: {
  repoName: string;
  readmeExcerpt: string;
  commitClusters: RepoIngestSnapshot["commitClusters"];
  nodes: RoadmapSyllabusNode[];
  evidenceByStage: StageEvidenceRef[];
  treeStats: RepoIngestSnapshot["treeStats"];
  existingTimeline?: Record<string, unknown>[];
}) {
  const evidenceMap = new Map(options.evidenceByStage.map((evidence) => [evidence.stage_id, evidence]));
  const nodeLines = options.nodes
    .map((node) => {
      const evidence = evidenceMap.get(node.id);
      return `- ${node.id} ${node.title}
  summary: ${node.summary}
  goals: ${node.goals.join(" | ") || "N/A"}
  checkpoints: ${node.checkpoints.join(" | ") || "N/A"}
  optional_peeks: ${node.optional_peeks.join(" | ") || "none"}
  required_evidence:
    - archetype: ${evidence?.archetype ?? "unknown"}
    - objective: ${evidence?.objective ?? node.summary}
    - hot_paths: ${(evidence?.hot_paths ?? []).join(" | ") || "none"}
    - feature_keywords: ${(evidence?.feature_keywords ?? []).join(" | ") || "none"}
    - api_concepts: ${(evidence?.api_concepts ?? []).join(" | ") || "none"}
    - readme_hints: ${(evidence?.readme_hints ?? []).join(" | ") || "none"}`;
    })
    .join("\n");
  const clusterLines = options.commitClusters
    .slice(0, 8)
    .map((cluster) => `${cluster.theme}: ${cluster.samples.slice(0, 3).join(" | ")}`)
    .join("\n");
  const knownFilesHint = options.treeStats.knownFiles.slice(0, 90).join(" | ");
  const scriptsHint = options.treeStats.scripts.join(", ") || "none";
  const packageManager = options.treeStats.packageManager;
  const existingStageLines = (options.existingTimeline ?? [])
    .filter((stage) => String(stage.id ?? "") !== "stage-setup")
    .slice(-5)
    .map((stage) => {
      const taskLabels = Array.isArray(stage.tasks)
        ? (stage.tasks as Array<Record<string, unknown>>).map((task) => String(task.label ?? "")).filter(Boolean).slice(0, 4)
        : [];
      const goals = Array.isArray(stage.goals) ? stage.goals.map((item) => String(item)).slice(0, 3) : [];
      return `- ${String(stage.id ?? "")} ${String(stage.title ?? "")}\n  goals: ${goals.join(" | ") || "N/A"}\n  task_labels: ${taskLabels.join(" | ") || "N/A"}`;
    })
    .join("\n");

  return `You are Commitly Stage Hydrator.

Hydrate the following syllabus stages into actionable beginner tasks.
Repository: ${options.repoName}
Readme context:
${options.readmeExcerpt || "N/A"}

Commit theme references:
${clusterLines || "N/A"}

Known repository files (must be preferred for task file paths):
${knownFilesHint || "N/A"}

Package manager: ${packageManager}
Available package scripts: ${scriptsHint}

Already generated stages (avoid repeating their task skeletons/wording):
${existingStageLines || "none"}

Stages to hydrate:
${nodeLines}

Hard rules:
1) Never instruct "git clone", fork, or copy source.
2) Learner builds from an empty workspace.
3) Every stage must include 3-6 tasks.
4) Every task must include:
   - label
   - steps (2-8)
   - files (real paths)
   - commands (runnable)
5) steps/files/commands must be concrete, no vague placeholders.
6) Do not create passive tasks like "inspect existing repo", "review source", or "read codebase".
7) Include optional_peeks as short hints to inspect concepts in original repo (never copy).
8) Every stage must explicitly reference at least one repo-specific concept from required_evidence (path, keyword, or api_concept).
9) Never use repetitive stage templates such as:
   - "Define scope and acceptance checks"
   - "Implement in your own workspace"
   - "Verify with tests and checks"
10) For utility-lib/sdk repos, prioritize core behavior stages (parser/formatter/api behavior) before tooling polish.
11) Task files should match known repository paths whenever possible. Do not invent fake paths like app/stage-*.
12) Task commands must align with package manager and existing scripts. Avoid invalid commands like npm run dev if dev is not a script.
13) Avoid repeating task wording/skeleton from already generated stages. Use distinct verbs and concrete module outcomes.

Return ONLY JSON:
{
  "timeline": [
    {
      "id": "stage-1",
      "index": 1,
      "title": "...",
      "summary": "...",
      "status": "not-started",
      "eta": "45m",
      "category": "setup|feature|refactor|testing|ops|perf|docs|style|chore|other",
      "difficulty": "intro|easy|medium|hard",
      "goals": ["..."],
      "prerequisites": ["..."],
      "checkpoints": ["..."],
      "tasks": [{"label":"...","steps":["..."],"files":["..."],"commands":["..."]}],
      "code_examples": [{"file":"...","language":"...","description":"...","snippet":"..."}],
      "resources": [{"label":"...","href":"..."}],
      "optional_peeks": ["..."],
      "commit_window": ["sha1","sha2"]
    }
  ]
}`;
}

function buildStageRepairPrompt(options: {
  repoName: string;
  readmeExcerpt: string;
  commitClusters: RepoIngestSnapshot["commitClusters"];
  nodes: RoadmapSyllabusNode[];
  evidenceByStage: StageEvidenceRef[];
  treeStats: RepoIngestSnapshot["treeStats"];
}) {
  const evidenceMap = new Map(options.evidenceByStage.map((evidence) => [evidence.stage_id, evidence]));
  const nodeLines = options.nodes
    .map((node) => {
      const evidence = evidenceMap.get(node.id);
      return `- ${node.id} (${node.index}) ${node.title}
  summary: ${node.summary}
  goals: ${node.goals.join(" | ") || "N/A"}
  checkpoints: ${node.checkpoints.join(" | ") || "N/A"}
  required_evidence:
    - archetype: ${evidence?.archetype ?? "unknown"}
    - hot_paths: ${(evidence?.hot_paths ?? []).join(" | ") || "none"}
    - feature_keywords: ${(evidence?.feature_keywords ?? []).join(" | ") || "none"}
    - api_concepts: ${(evidence?.api_concepts ?? []).join(" | ") || "none"}`;
    })
    .join("\n");
  const clusterLines = options.commitClusters
    .slice(0, 8)
    .map((cluster) => `${cluster.theme}: ${cluster.samples.slice(0, 2).join(" | ")}`)
    .join("\n");
  const knownFilesHint = options.treeStats.knownFiles.slice(0, 90).join(" | ");
  const scriptsHint = options.treeStats.scripts.join(", ") || "none";
  const packageManager = options.treeStats.packageManager;

  return `You are Commitly Stage Repair engine.

Generate replacement stage details ONLY for the stages listed below.
Repository: ${options.repoName}
Readme context:
${options.readmeExcerpt || "N/A"}

Commit theme references:
${clusterLines || "N/A"}

Known repository files:
${knownFilesHint || "N/A"}

Package manager: ${packageManager}
Available scripts: ${scriptsHint}

Stages requiring repair:
${nodeLines}

Hard rules:
1) Never mention clone/fork/copying source.
2) Learner starts from an empty workspace.
3) Each stage must include 3-6 concrete tasks.
4) Every task requires label, steps(2-8), files(real paths), commands(runnable).
5) Avoid placeholders like "Stage 2", "inspect code", "review existing implementation".
6) Include explicit checkpoints.
7) Every repaired stage must mention at least one required_evidence concept.
8) Do not reuse repetitive scaffolding templates across stages.
9) Use real repository file paths when possible and avoid fake app/stage-* paths.
10) Commands must be valid for the package manager and known scripts.

Return ONLY JSON:
{
  "timeline": [
    {
      "id": "stage-1",
      "index": 1,
      "title": "...",
      "summary": "...",
      "status": "not-started",
      "eta": "45m",
      "category": "setup|feature|refactor|testing|ops|perf|docs|style|chore|other",
      "difficulty": "intro|easy|medium|hard",
      "goals": ["..."],
      "prerequisites": ["..."],
      "checkpoints": ["..."],
      "tasks": [{"label":"...","steps":["..."],"files":["..."],"commands":["..."]}],
      "code_examples": [{"file":"...","language":"...","description":"...","snippet":"..."}],
      "resources": [{"label":"...","href":"..."}],
      "optional_peeks": ["..."],
      "commit_window": ["sha1","sha2"]
    }
  ]
}`;
}

function buildIssueAwareStageRepairPrompt(options: {
  repoName: string;
  readmeExcerpt: string;
  commitClusters: RepoIngestSnapshot["commitClusters"];
  node: RoadmapSyllabusNode;
  evidence?: StageEvidenceRef | null;
  treeStats: RepoIngestSnapshot["treeStats"];
  failCodes: StageFailCode[];
  failReasons: string[];
  repairSeedTasks: Array<{ label: string; steps: string[]; files: string[]; commands: string[] }>;
  attempt: number;
}) {
  const clusterLines = options.commitClusters
    .slice(0, 6)
    .map((cluster) => `${cluster.theme}: ${cluster.samples.slice(0, 2).join(" | ")}`)
    .join("\n");
  const evidence = options.evidence;
  const knownFilesHint = options.treeStats.knownFiles.slice(0, 80).join(" | ");
  const scriptsHint = options.treeStats.scripts.join(", ") || "none";
  const failReasonsLine = options.failReasons.join(" | ") || "N/A";
  const failCodesLine = options.failCodes.join(", ") || "none";
  const conceptAnchors = Array.from(new Set([
    ...(evidence?.api_concepts ?? []),
    ...(evidence?.feature_keywords ?? []),
    ...(evidence?.hot_paths ?? []).map((path) => path.split("/").slice(-2).join("/") || path),
  ]
    .map((value) => normalizeKeywordToken(String(value)).trim())
    .filter((value) => value.length >= 3 && !REPO_GENERIC_TERMS.has(value))))
    .slice(0, 4);
  const conceptAnchorsLine = conceptAnchors.length > 0 ? conceptAnchors.join(" | ") : "none";

  return `You are Commitly Stage Repair engine (issue-aware single-stage mode).

Repository: ${options.repoName}
Attempt: ${options.attempt}
Readme context:
${options.readmeExcerpt || "N/A"}

Commit theme references:
${clusterLines || "N/A"}

Stage to repair:
- id: ${options.node.id}
- index: ${options.node.index}
- title: ${options.node.title}
- summary: ${options.node.summary}
- goals: ${options.node.goals.join(" | ") || "N/A"}
- checkpoints: ${options.node.checkpoints.join(" | ") || "N/A"}

Required evidence:
- archetype: ${evidence?.archetype ?? "unknown"}
- objective: ${evidence?.objective ?? options.node.summary}
- hot_paths: ${(evidence?.hot_paths ?? []).join(" | ") || "none"}
- feature_keywords: ${(evidence?.feature_keywords ?? []).join(" | ") || "none"}
- api_concepts: ${(evidence?.api_concepts ?? []).join(" | ") || "none"}
- required_concept_anchors: ${conceptAnchorsLine}

Environment constraints:
- package_manager: ${options.treeStats.packageManager}
- scripts: ${scriptsHint}
- known_files: ${knownFilesHint || "none"}

Previous failure diagnosis:
- fail_codes: ${failCodesLine}
- fail_reasons: ${failReasonsLine}

Repair seed task ideas (for structure only, do not copy verbatim):
${JSON.stringify(options.repairSeedTasks)}

Hard rules:
1) Return only stage "${options.node.id}".
2) Never use clone/fork/copy/inspect-existing-code workflow.
3) Include 3-6 concrete tasks.
4) Every task requires label + steps(2-8) + files(real repo paths) + commands(valid for package manager/scripts).
5) Avoid generic labels like "Implement X" without concrete subsystem context.
6) Stage must reference at least two repo concepts from evidence (api_concepts/feature_keywords/hot_paths).
7) No fake files (app/stage-*, package lock test files, invented config files).
8) No shell housekeeping commands (git/mkdir/touch/grep/ls/cat/rm/cp/mv).
9) Use distinct task wording; avoid repeated template phrases.
10) Forbidden phrases in steps: "Add at least one verification case...", "Run the validation command and record the passing result.", "Implement <concept> in <file> with explicit input/output behavior."
11) Include at least two required_concept_anchors verbatim across goals/checkpoints/tasks.

Return ONLY JSON:
{
  "stage": {
    "id": "${options.node.id}",
    "index": ${options.node.index},
    "title": "...",
    "summary": "...",
    "status": "not-started",
    "eta": "45m",
    "category": "setup|feature|refactor|testing|ops|perf|docs|style|chore|other",
    "difficulty": "intro|easy|medium|hard",
    "goals": ["..."],
    "prerequisites": ["..."],
    "checkpoints": ["..."],
    "tasks": [{"label":"...","steps":["..."],"files":["..."],"commands":["..."]}],
    "code_examples": [{"file":"...","language":"...","description":"...","snippet":"..."}],
    "resources": [{"label":"...","href":"..."}],
    "optional_peeks": ["..."],
    "commit_window": ["sha1","sha2"]
  }
}`;
}

function isTemplateStageTitle(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^stage\s*\d+$/i.test(normalized) ||
    /^module\s*\d+$/i.test(normalized) ||
    /^part\s*\d+$/i.test(normalized);
}

function normalizeSyllabusNodes(
  syllabusRaw: unknown,
  targetCount: number,
  clusters: RepoIngestSnapshot["commitClusters"],
) {
  const rawList = Array.isArray(syllabusRaw) ? syllabusRaw : [];
  const topThemes = clusters.slice(0, 8).map((cluster) => cluster.theme).filter(Boolean);
  const safeThemes = topThemes.length > 0 ? topThemes : ["core-product-flows"];
  const issues: string[] = [];
  const normalized: RoadmapSyllabusNode[] = [];
  const seenTitles = new Set<string>();

  if (rawList.length < targetCount) {
    issues.push(`expected ${targetCount} stages, got ${rawList.length}`);
  }

  for (let idx = 0; idx < targetCount; idx += 1) {
    const rawNode = rawList[idx];
    const node = (rawNode && typeof rawNode === "object") ? (rawNode as Record<string, unknown>) : {};
    const title = typeof node.title === "string" ? node.title.trim() : "";
    const summary = typeof node.summary === "string" ? node.summary.trim() : "";
    const goals = Array.isArray(node.goals)
      ? node.goals.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
      : [];
    const prerequisites = Array.isArray(node.prerequisites)
      ? node.prerequisites.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
      : [];
    const checkpoints = Array.isArray(node.checkpoints)
      ? node.checkpoints.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
      : [];
    const sourceThemes = Array.isArray(node.source_themes)
      ? node.source_themes.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 5)
      : safeThemes.slice(0, 3);
    const optionalPeeks = Array.isArray(node.optional_peeks)
      ? node.optional_peeks.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
      : [];

    if (!title) {
      issues.push(`stage ${idx + 1}: missing title`);
      continue;
    }
    if (isTemplateStageTitle(title)) {
      issues.push(`stage ${idx + 1}: template title "${title}"`);
      continue;
    }
    const normalizedTitle = title.toLowerCase();
    if (seenTitles.has(normalizedTitle)) {
      issues.push(`stage ${idx + 1}: duplicate title "${title}"`);
      continue;
    }
    seenTitles.add(normalizedTitle);

    if (!summary || /^build\s+stage\s+\d+/i.test(summary)) {
      issues.push(`stage ${idx + 1}: template or empty summary`);
      continue;
    }
    if (goals.length < 2) {
      issues.push(`stage ${idx + 1}: requires at least 2 goals`);
      continue;
    }
    if (checkpoints.length < 2) {
      issues.push(`stage ${idx + 1}: requires at least 2 checkpoints`);
      continue;
    }

    normalized.push({
      id: typeof node.id === "string" && node.id.trim().length > 0 ? node.id.trim() : `stage-${idx + 1}`,
      index: idx + 1,
      title,
      summary,
      category: typeof node.category === "string" && node.category.trim().length > 0 ? node.category.trim() : "feature",
      difficulty: typeof node.difficulty === "string" && node.difficulty.trim().length > 0 ? node.difficulty.trim() : "easy",
      goals,
      prerequisites,
      checkpoints,
      source_themes: sourceThemes,
      optional_peeks: optionalPeeks,
    });
  }

  if (issues.length > 0 || normalized.length !== targetCount) {
    const reason = [
      `normalized ${normalized.length}/${targetCount} stages`,
      ...issues.slice(0, 8),
    ].join("; ");
    throw new Error(`Syllabus quality failed: ${reason}`);
  }
  return normalized;
}

function buildChatPrompt(options: {
  repoName: string;
  roadmapSummary: string;
  userQuery: string;
  mode: "normal" | "low" | "critical";
  responseLanguage: RoadmapTranslationLanguage;
}) {
  const { repoName, roadmapSummary, userQuery, mode, responseLanguage } = options;
  const languageLabel = ROADMAP_TRANSLATION_LANGUAGE_LABELS[responseLanguage];

  return `You are Commitly, a stage-grounded beginner coding coach.

Repository: ${repoName}
Budget mode: ${mode}
Preferred response language: ${languageLabel}
Stage/timeline context:
${roadmapSummary}

User question:
${userQuery}

Rules:
- Ground your answer in the provided stage/timeline context; do not invent unrelated architecture.
- Never suggest clone/fork/copying the reference repository.
- Always structure answers in this order:
  1) What to do now
  2) Why this matters
  3) How to verify
  4) Common pitfall
- Include file paths and commands when applicable.
- Keep it concise, practical, and beginner-friendly.
- If context is insufficient, state assumptions clearly before advice.`;
}

function parseGeminiJsonResponse(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  if (candidates.length === 0) {
    throw new Error("Gemini returned no candidates");
  }

  const firstCandidate = candidates[0] as Record<string, unknown>;
  const content = (firstCandidate.content ?? {}) as Record<string, unknown>;
  const parts = Array.isArray(content.parts) ? content.parts : [];

  let text = "";
  for (const part of parts) {
    if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
      text += (part as { text: string }).text;
    }
  }

  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!cleaned) {
    throw new Error("Gemini returned empty text");
  }

  const parsed = tryParseLooseJsonObject(cleaned);
  if (parsed) {
    return parsed;
  }
  throw new Error("Gemini returned malformed JSON");
}

function tryParseLooseJsonObject(raw: string) {
  const candidates: string[] = [];
  const cleaned = raw.trim();
  if (!cleaned) {
    return null;
  }
  candidates.push(cleaned);

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1).trim());
  }

  const withoutTrailingCommas = cleaned.replace(/,\s*([}\]])/g, "$1");
  if (withoutTrailingCommas !== cleaned) {
    candidates.push(withoutTrailingCommas);
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      const balanced = autoCloseJson(candidate);
      if (!balanced || seen.has(balanced)) {
        continue;
      }
      seen.add(balanced);
      try {
        const parsed = JSON.parse(balanced);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

function autoCloseJson(input: string) {
  const stack: string[] = [];
  let inString = false;
  let escaping = false;
  for (let idx = 0; idx < input.length; idx += 1) {
    const ch = input[idx];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (ch === "\\") {
      escaping = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }
    if (ch === "}" || ch === "]") {
      const open = stack.at(-1);
      if ((ch === "}" && open === "{") || (ch === "]" && open === "[")) {
        stack.pop();
      }
    }
  }
  if (stack.length === 0) {
    return input;
  }
  let suffix = "";
  for (let idx = stack.length - 1; idx >= 0; idx -= 1) {
    suffix += stack[idx] === "{" ? "}" : "]";
  }
  return `${input}${suffix}`;
}

function extractGeminiText(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const firstCandidate = candidates[0] as Record<string, unknown> | undefined;
  const content = firstCandidate && typeof firstCandidate.content === "object"
    ? (firstCandidate.content as Record<string, unknown>)
    : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];

  let text = "";
  for (const part of parts) {
    if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
      text += (part as { text: string }).text;
    }
  }
  return text.trim();
}

function hasGeminiUsablePayload(payload: Record<string, unknown>) {
  return extractGeminiText(payload).length > 0;
}

function extractUsageMetadata(payload: Record<string, unknown>) {
  const usage = payload.usageMetadata as Record<string, unknown> | undefined;
  if (!usage) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  const promptTokens = Number(usage.promptTokenCount ?? 0);
  const completionTokens = Number(usage.candidatesTokenCount ?? 0);
  const totalTokens = Number(usage.totalTokenCount ?? promptTokens + completionTokens);

  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
}

async function callGemini(options: {
  prompt: string;
  maxOutputTokens: number;
  responseMimeType?: string;
  temperature?: number;
  models?: string[];
  timeoutMs?: number;
}) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const modelCandidates = Array.isArray(options.models) && options.models.length > 0
    ? Array.from(new Set(options.models.filter((model) => typeof model === "string" && model.trim().length > 0)))
    : GEMINI_MODEL_CANDIDATES;
  let lastError: Error | null = null;
  for (const model of modelCandidates) {
    const timeoutMs = Number.isFinite(options.timeoutMs ?? NaN)
      ? Math.max(8_000, Number(options.timeoutMs))
      : (Number.isFinite(GEMINI_REQUEST_TIMEOUT_MS) ? Math.max(12_000, GEMINI_REQUEST_TIMEOUT_MS) : 45_000);
    let response: Response;
    try {
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: options.prompt }],
              },
            ],
            generationConfig: {
              temperature: options.temperature ?? 0.2,
              topP: 0.8,
              maxOutputTokens: options.maxOutputTokens,
              ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
            },
          }),
        },
        timeoutMs,
        `Gemini request timeout for ${model}`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Gemini request failed";
      lastError = new Error(`Gemini request failed (${model}): ${detail}`);
      continue;
    }

    if (response.ok) {
      const payload = (await response.json()) as Record<string, unknown>;
      if (hasGeminiUsablePayload(payload)) {
        return payload;
      }

      lastError = new Error(`Gemini API 200 (${model}): empty candidate payload`);
      continue;
    }

    const body = await response.text();
    lastError = new Error(`Gemini API ${response.status} (${model}): ${body || response.statusText}`);
    if (![404, 429, 500, 502, 503, 504].includes(response.status)) {
      throw lastError;
    }
  }

  throw lastError ?? new Error("Gemini API request failed");
}

async function callGeminiJson(options: {
  prompt: string;
  maxOutputTokens: number;
  responseMimeType?: string;
  temperature?: number;
  retries?: number;
  models?: string[];
  disableRepair?: boolean;
  timeoutMs?: number;
}) {
  const retries = Math.max(0, Math.floor(options.retries ?? 2));
  const disableRepair = Boolean(options.disableRepair);
  let prompt = options.prompt;
  let lastError: Error | null = null;
  const usageTotals = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  const addUsage = (payload: Record<string, unknown>) => {
    const usage = extractUsageMetadata(payload);
    usageTotals.promptTokens += usage.promptTokens;
    usageTotals.completionTokens += usage.completionTokens;
    usageTotals.totalTokens += usage.totalTokens;
  };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const payload = await callGemini({
      prompt,
      maxOutputTokens: options.maxOutputTokens,
      responseMimeType: options.responseMimeType,
      temperature: options.temperature,
      models: options.models,
      timeoutMs: options.timeoutMs,
    });
    addUsage(payload);

    try {
      const parsed = parseGeminiJsonResponse(payload);
      return { payload, parsed, usage: usageTotals };
    } catch (error) {
      const raw = extractGeminiText(payload);
      if (raw.length > 0) {
        const locallyRepaired = tryParseLooseJsonObject(raw);
        if (locallyRepaired) {
          return { payload, parsed: locallyRepaired, usage: usageTotals };
        }
      }
      if (raw.length > 0 && !disableRepair) {
        const repairPayload = await callGemini({
          prompt:
            `Repair the following malformed JSON and return only valid JSON with identical structure and meaning.\n\n${raw}`,
          maxOutputTokens: options.maxOutputTokens,
          responseMimeType: "application/json",
          temperature: 0,
          models: options.models,
          timeoutMs: options.timeoutMs,
        });
        addUsage(repairPayload);
        try {
          const repaired = parseGeminiJsonResponse(repairPayload);
          return { payload: repairPayload, parsed: repaired, usage: usageTotals };
        } catch {
          const repairedRaw = extractGeminiText(repairPayload);
          if (repairedRaw.length > 0) {
            const locallyRepaired = tryParseLooseJsonObject(repairedRaw);
            if (locallyRepaired) {
              return { payload: repairPayload, parsed: locallyRepaired, usage: usageTotals };
            }
          }
          // Fall through to retry with stricter instruction.
        }
      }

      lastError = error instanceof Error ? error : new Error("Failed to parse Gemini JSON payload");
      prompt =
        `${options.prompt}\n\nIMPORTANT: Return only valid, complete JSON. Do not include markdown fences or extra prose.`;
    }
  }

  throw lastError ?? new Error("Failed to parse Gemini JSON response");
}

function estimateTokenUsage(text: string) {
  return Math.ceil(text.length / 4);
}

function buildRepoSummaryFromRow(row: Record<string, unknown>) {
  const summary = (row.repo_summary ?? {}) as Record<string, unknown>;
  return {
    ...summary,
    primary_language: row.primary_language ?? summary.primary_language ?? summary.language ?? null,
    languages: row.languages ?? summary.languages ?? null,
    topics: row.topics ?? summary.topics ?? null,
    difficulty: row.difficulty ?? summary.difficulty ?? "medium",
    star_count: row.star_count ?? summary.star_count ?? summary.stars ?? 0,
    fork_count: row.fork_count ?? summary.fork_count ?? 0,
    last_pushed_at: row.last_pushed_at ?? summary.last_pushed_at ?? null,
    license: row.license ?? summary.license ?? null,
    contributor_count: row.contributor_count ?? summary.contributor_count ?? 0,
    view_count: row.view_count ?? summary.view_count ?? 0,
    sync_count: row.sync_count ?? summary.sync_count ?? 0,
    rating_count: row.rating_count ?? summary.rating_count ?? 0,
    rating_sum: row.rating_sum ?? summary.rating_sum ?? 0,
  };
}

function mapRoadmapRow(row: Record<string, unknown>, forceCachedValue?: boolean) {
  const generatedStages = Number(row.last_generated_stage ?? 0);
  const timelineCount = Array.isArray(row.timeline) ? row.timeline.length : 0;
  const totalStages = Math.max(1, Number(row.total_planned_stages ?? Math.max(timelineCount - 1, generatedStages, 1)));
  const progressPercent = Number(row.progress_percent ?? Math.min(100, Math.round((generatedStages / totalStages) * 100)));
  const timelineQuality = (row.timeline_quality && typeof row.timeline_quality === "object")
    ? (row.timeline_quality as Record<string, unknown>)
    : null;
  return {
    repo: buildRepoSummaryFromRow(row),
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
    cached: forceCachedValue ?? Boolean(row.cached),
    generated_at: (row.generated_at as string) ?? new Date().toISOString(),
    job_state: typeof row.job_state === "string" ? row.job_state : "completed",
    last_generated_stage: generatedStages,
    progress_percent: Number.isFinite(progressPercent) ? Math.max(0, Math.min(100, progressPercent)) : 0,
    current_phase: typeof row.current_phase === "string" ? row.current_phase : "complete",
    phase_message: typeof row.phase_message === "string" ? row.phase_message : "Generation complete",
    timeline_quality: timelineQuality
      ? {
        novelty_score: Number(timelineQuality.novelty_score ?? 0),
        grounding_score: Number(timelineQuality.grounding_score ?? 0),
        anti_template_pass: Boolean(timelineQuality.anti_template_pass),
        evaluated_at: String(timelineQuality.evaluated_at ?? new Date().toISOString()),
      }
      : null,
  };
}

function computeProgressPercent(generatedStages: number, totalStages: number, phase: RoadmapGenerationPhase) {
  const total = Math.max(1, totalStages);
  const generatedRatio = Math.max(0, Math.min(1, generatedStages / total));
  if (phase === "complete") {
    return 100;
  }
  if (phase === "persist") {
    return Math.max(95, Math.round(85 + generatedRatio * 10));
  }
  if (phase === "validate") {
    return Math.max(80, Math.round(70 + generatedRatio * 15));
  }
  if (phase === "hydrate") {
    return Math.max(40, Math.round(30 + generatedRatio * 45));
  }
  if (phase === "syllabus") {
    return 20;
  }
  return 8;
}

async function updateGenerationJobPhase(
  supabase: SupabaseClient,
  jobId: string,
  options: {
    phase: RoadmapGenerationPhase;
    status?: RoadmapGenerationJobStatus;
    generatedStages?: number;
    totalStages?: number;
    message?: string;
    lastError?: string | null;
    timeline?: Record<string, unknown>[];
    queueState?: string;
    workerAttempts?: number;
    lastWorkerAt?: string | null;
  },
) {
  const generated = Number(options.generatedStages ?? 0);
  const total = Number(options.totalStages ?? Math.max(generated, 1));
  const payload: Record<string, unknown> = {
    current_phase: options.phase,
    phase_message: options.message ?? null,
    progress_percent: computeProgressPercent(generated, total, options.phase),
    updated_at: new Date().toISOString(),
  };
  if (options.status) {
    payload.status = options.status;
  }
  if (options.generatedStages !== undefined) {
    payload.generated_stages = generated;
  }
  if (options.lastError !== undefined) {
    payload.last_error = options.lastError;
  }
  if (Array.isArray(options.timeline)) {
    payload.initial_timeline = options.timeline;
  }
  if (typeof options.queueState === "string" && options.queueState.trim().length > 0) {
    payload.queue_state = options.queueState.trim();
  }
  if (options.workerAttempts !== undefined) {
    payload.worker_attempts = Math.max(0, Math.floor(options.workerAttempts));
  }
  if (options.lastWorkerAt !== undefined) {
    payload.last_worker_at = options.lastWorkerAt;
  }
  await supabase
    .from("roadmap_generation_jobs")
    .update(payload)
    .eq("id", jobId);
}

async function updateGenerationJobQualityDiagnostics(
  supabase: SupabaseClient,
  jobId: string,
  diagnostics: {
    qualityGateStatus?: "pass" | "fail";
    qualityFailReasons?: string[];
    failedStageIds?: string[];
    dedupeScore?: number;
    groundingScore?: number;
  },
) {
  const payload: Record<string, unknown> = {};
  if (diagnostics.qualityGateStatus) {
    payload.quality_gate_status = diagnostics.qualityGateStatus;
  }
  if (diagnostics.qualityFailReasons) {
    payload.quality_fail_reasons = diagnostics.qualityFailReasons;
  }
  if (diagnostics.failedStageIds) {
    payload.failed_stage_ids = diagnostics.failedStageIds;
  }
  if (diagnostics.dedupeScore !== undefined) {
    payload.dedupe_score = Math.max(0, Math.min(100, Math.round(diagnostics.dedupeScore)));
  }
  if (diagnostics.groundingScore !== undefined) {
    payload.grounding_score = Math.max(0, Math.min(100, Math.round(diagnostics.groundingScore)));
  }
  if (Object.keys(payload).length === 0) {
    return;
  }
  payload.updated_at = new Date().toISOString();
  await supabase
    .from("roadmap_generation_jobs")
    .update(payload)
    .eq("id", jobId);
}

async function recordStageRepairAttempt(
  supabase: SupabaseClient,
  payload: {
    jobId: string;
    stageId: string;
    attemptNo: number;
    model: string;
    failCodes: StageFailCode[];
    failReasons: string[];
    metrics: Record<string, unknown>;
  },
) {
  await supabase
    .from("roadmap_generation_stage_attempts")
    .insert({
      job_id: payload.jobId,
      stage_id: payload.stageId,
      attempt_no: payload.attemptNo,
      model: payload.model,
      fail_codes: payload.failCodes,
      fail_reasons: payload.failReasons,
      metrics: payload.metrics,
      created_at: new Date().toISOString(),
    });
}

async function getFailedStageReports(supabase: SupabaseClient, jobId: string): Promise<StageRepairAttemptReport[]> {
  const { data } = await supabase
    .from("roadmap_generation_stage_attempts")
    .select("stage_id,attempt_no,model,fail_codes,fail_reasons,created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  const reports = new Map<string, StageRepairAttemptReport>();
  for (const row of data ?? []) {
    const stageId = String(row.stage_id ?? "");
    if (!stageId) {
      continue;
    }
    const current = reports.get(stageId) ?? {
      stage_id: stageId,
      attempt_count: 0,
      fail_codes: [],
      fail_reasons: [],
      last_model: "",
    };
    current.attempt_count = Math.max(current.attempt_count, Number(row.attempt_no ?? 0));
    current.last_model = String(row.model ?? current.last_model ?? "");
    current.fail_codes = Array.isArray(row.fail_codes)
      ? row.fail_codes.map((item: unknown) => String(item) as StageFailCode)
      : current.fail_codes;
    current.fail_reasons = Array.isArray(row.fail_reasons)
      ? row.fail_reasons.map((item: unknown) => String(item))
      : current.fail_reasons;
    reports.set(stageId, current);
  }
  return Array.from(reports.values())
    .filter((report) => report.fail_codes.length > 0 || report.fail_reasons.length > 0)
    .sort((a, b) => a.stage_id.localeCompare(b.stage_id));
}

async function getLatestQualityGateMetrics(
  supabase: SupabaseClient,
  jobId: string,
  fallback: { dedupeScore: number; groundingScore: number },
) {
  const { data } = await supabase
    .from("roadmap_generation_quality_runs")
    .select("dedupe_score,grounding_score,concept_coverage_score,template_risk_score,created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    dedupe_score: Number(data?.dedupe_score ?? fallback.dedupeScore ?? 0),
    grounding_score: Number(data?.grounding_score ?? fallback.groundingScore ?? 0),
    concept_coverage_score: Number(data?.concept_coverage_score ?? 0),
    template_risk_score: Number(data?.template_risk_score ?? 100),
  };
}

const FORBIDDEN_CLONE_PATTERNS = [
  /\bgit\s+clone\b/i,
  /\bfork\s+this\s+repo\b/i,
  /\bclone\s+(this|the)\s+repo\b/i,
  /\bcopy\s+the\s+source\s+code\b/i,
  /\bcopy\s+code\s+from\b/i,
  /\bduplicate\s+the\s+existing\s+repo\b/i,
  /\bfollow\s+the\s+existing\s+implementation\b/i,
  /\binspect\s+the\s+(existing\s+)?(repo|repository|codebase|source)\b/i,
  /\breview\s+the\s+(existing\s+)?source\s+code\b/i,
  /\bread\s+through\s+the\s+(existing\s+)?repo\b/i,
];

function sanitizeInstructionText(text: string) {
  let next = text;
  next = next.replace(/\bgit\s+clone\s+[^\s]+/ig, "create a fresh local project workspace");
  next = next.replace(/\bfork\s+this\s+repo\b/ig, "build your own implementation in a new repository");
  next = next.replace(/\bclone\s+(this|the)\s+repo\b/ig, "start from an empty repository");
  next = next.replace(/\bcopy\s+the\s+source\s+code\b/ig, "implement the feature yourself from scratch");
  next = next.replace(/\bcopy\s+code\s+from\s+[^\s]+/ig, "implement this part yourself from scratch");
  next = next.replace(/\binspect\s+the\s+(existing\s+)?(repo|repository|codebase|source)\b/ig, "implement this area yourself and compare outcomes with reference docs");
  next = next.replace(/\breview\s+the\s+(existing\s+)?source\s+code\b/ig, "implement the feature directly and validate behavior with tests");
  next = next.replace(/\bread\s+through\s+the\s+(existing\s+)?repo\b/ig, "build the feature directly in your own workspace");
  return next;
}

function containsForbiddenCloneInstruction(text: string) {
  return FORBIDDEN_CLONE_PATTERNS.some((pattern) => pattern.test(text));
}

function sanitizeTaskFiles(files: unknown, _fallbackBasePath: string) {
  const rawFiles = Array.isArray(files)
    ? files.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const normalized = rawFiles
    .map((item) => item.trim().replace(/^\.\//, ""))
    .filter((item) => !containsForbiddenCloneInstruction(item))
    .slice(0, 6);
  return normalized.length > 0 ? normalized : [];
}

function resolveKnownRepoFile(
  file: string,
  knownFiles?: Set<string>,
  _evidence?: StageEvidenceRef | null,
) {
  const candidate = file.trim().replace(/^\.\//, "");
  if (!candidate) {
    return null;
  }
  if (!knownFiles || knownFiles.size === 0) {
    return candidate;
  }
  if (knownFiles.has(candidate)) {
    return candidate;
  }

  const candidateBase = candidate.split("/").slice(-1)[0] ?? candidate;
  for (const known of knownFiles) {
    if (known.endsWith(`/${candidateBase}`) || known === candidateBase) {
      return known;
    }
  }
  if (
    isSourceLikeFile(candidate) &&
    !/^app\/stage-\d+/i.test(candidate) &&
    !/^stage-\d+/i.test(candidate)
  ) {
    return candidate;
  }
  return null;
}

function isSourceLikeFile(path: string) {
  const normalized = path.trim().replace(/^\.\//, "");
  if (!normalized) {
    return false;
  }
  if (NON_SOURCE_FILE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  if (/^README\.md$/i.test(normalized) || /^docs\//i.test(normalized)) {
    return true;
  }
  if (/\/(test|tests|spec)\//i.test(normalized) || /\.(test|spec)\.[a-z0-9]+$/i.test(normalized)) {
    return true;
  }
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|rb|php|cs|md|json|toml|yaml|yml)$/i.test(normalized);
}

function normalizeTaskCommands(
  commands: string[],
  packageManager: RepoIngestSnapshot["treeStats"]["packageManager"],
  scripts: Set<string>,
) {
  const pm = packageManager;
  const normalized: string[] = [];

  const normalizeByManager = (command: string) => {
    let next = command.trim();
    if (pm === "pnpm") {
      next = next.replace(/^npm\s+run\s+/i, "pnpm run ");
      next = next.replace(/^npm\s+test\b/i, "pnpm test");
      next = next.replace(/^npm\s+install\b/i, "pnpm add");
    } else if (pm === "yarn") {
      next = next.replace(/^npm\s+run\s+/i, "yarn ");
      next = next.replace(/^npm\s+test\b/i, "yarn test");
    } else if (pm === "bun") {
      next = next.replace(/^npm\s+run\s+/i, "bun run ");
      next = next.replace(/^npm\s+test\b/i, "bun test");
    }
    return next;
  };

  const hasScript = (script: string) => scripts.size === 0 || scripts.has(script);

  for (const raw of commands) {
    const command = normalizeByManager(raw);
    if (!command) {
      continue;
    }
    if (DISALLOWED_TASK_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
      continue;
    }
    const runMatch = command.match(/^(npm|pnpm|yarn|bun)\s+run\s+([a-z0-9:_-]+)/i);
    if (runMatch) {
      if (hasScript(runMatch[2])) {
        normalized.push(command);
      }
      continue;
    }
    const testMatch = command.match(/^(npm|pnpm|yarn|bun)\s+test\b/i);
    if (testMatch) {
      if (hasScript("test")) {
        normalized.push(command);
      }
      continue;
    }
    if (ALLOWED_TASK_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
      normalized.push(command);
      continue;
    }
    normalized.push(command);
  }

  return Array.from(new Set(normalized))
    .filter((command) => ALLOWED_TASK_COMMAND_PATTERNS.some((pattern) => pattern.test(command)))
    .slice(0, 6);
}

function pickValidationCommand(
  packageManager: RepoIngestSnapshot["treeStats"]["packageManager"],
  scripts: Set<string>,
) {
  const pm = packageManager === "unknown" ? "npm" : packageManager;
  const preferred = ["test", "typecheck", "lint", "build", "check"];
  for (const script of preferred) {
    if (scripts.has(script)) {
      const candidate = normalizeTaskCommands([`${pm} run ${script}`], packageManager, scripts);
      if (candidate.length > 0) {
        return candidate[0];
      }
    }
  }
  const anyScript = Array.from(scripts)[0];
  if (anyScript) {
    const candidate = normalizeTaskCommands([`${pm} run ${anyScript}`], packageManager, scripts);
    if (candidate.length > 0) {
      return candidate[0];
    }
  }
  return `${pm} install`;
}

function buildEvidenceRecoveryTasks(options: {
  node: RoadmapSyllabusNode;
  evidence?: StageEvidenceRef | null;
  knownFiles?: Set<string>;
  packageManager: RepoIngestSnapshot["treeStats"]["packageManager"];
  scripts: Set<string>;
}) {
  const knownFiles = options.knownFiles;
  const evidence = options.evidence;
  const command = pickValidationCommand(options.packageManager, options.scripts);
  const sourceCandidates = (evidence?.hot_paths ?? [])
    .map((path) => String(path).trim())
    .filter((path) => path.length > 0)
    .filter((path) => isSourceLikeFile(path))
    .map((path) => resolveKnownRepoFile(path, knownFiles, evidence) ?? path)
    .slice(0, 6);

  const fallbackKnown = Array.from(knownFiles ?? [])
    .filter((path) => isSourceLikeFile(path))
    .slice(0, 8);
  const filesPool = Array.from(new Set([...sourceCandidates, ...fallbackKnown])).slice(0, 8);

  const concepts = [
    ...options.node.goals,
    ...options.node.checkpoints,
    ...(evidence?.api_concepts ?? []),
    ...(evidence?.feature_keywords ?? []),
  ]
    .map((item) => sanitizeInstructionText(String(item)).replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 6 && item.length <= 80)
    .filter((item) => !/^stage\s+\d+/i.test(item));

  const uniqueConcepts = Array.from(new Set(concepts));
  const tasks: Array<{ label: string; steps: string[]; files: string[]; commands: string[] }> = [];
  const actionVerbs = ["Build", "Refine", "Validate", "Cover"];

  for (let idx = 0; idx < Math.max(3, Math.min(5, uniqueConcepts.length)); idx += 1) {
    const concept = uniqueConcepts[idx] ?? `Core behavior ${idx + 1}`;
    const file = filesPool[idx % Math.max(filesPool.length, 1)] ?? "src/index.ts";
    const secondaryFile = filesPool[(idx + 1) % Math.max(filesPool.length, 1)];
    const taskFiles = Array.from(new Set([file, secondaryFile].filter(Boolean) as string[])).slice(0, 2);
    const verb = actionVerbs[idx % actionVerbs.length];
    const label = sanitizeInstructionText(`${verb} ${concept}`);
    tasks.push({
      label,
      steps: [
        sanitizeInstructionText(`Implement ${concept} directly in ${file} with concrete behavior checks.`),
        sanitizeInstructionText(`Add or update tests for ${concept}, including at least one edge case.`),
        sanitizeInstructionText(`Run ${command} and confirm all checks pass for this stage.`),
      ],
      files: taskFiles.length > 0 ? taskFiles : [file],
      commands: [command],
    });
    if (tasks.length >= 3) {
      break;
    }
  }

  return tasks.slice(0, 4);
}

function buildEvidenceBoundRecoveryStage(options: {
  node: RoadmapSyllabusNode;
  evidence?: StageEvidenceRef | null;
  knownFiles?: Set<string>;
  packageManager: RepoIngestSnapshot["treeStats"]["packageManager"];
  scripts: Set<string>;
}) {
  const { node, evidence, knownFiles } = options;
  const command = pickValidationCommand(options.packageManager, options.scripts);
  const sourceCandidates = (evidence?.hot_paths ?? [])
    .map((path) => String(path).trim())
    .filter((path) => path.length > 0 && isSourceLikeFile(path))
    .map((path) => resolveKnownRepoFile(path, knownFiles, evidence) ?? path)
    .slice(0, 8);
  const fallbackFiles = Array.from(knownFiles ?? [])
    .filter((path) => isSourceLikeFile(path))
    .slice(0, 8);
  const filesPool = Array.from(new Set([...sourceCandidates, ...fallbackFiles]));
  const nodeTokenSet = new Set(toComparableTokens(
    `${node.title} ${node.summary} ${node.goals.join(" ")} ${node.checkpoints.join(" ")}`,
  ));
  const genericAnchorPattern =
    /(github|workflow|readme|package|lock|lint|config|changelog|license|ci\/cd|cicd|pnpm|npm|yarn|bun)/i;
  const rankedAnchors = [
    ...(evidence?.api_concepts ?? []),
    ...(evidence?.feature_keywords ?? []),
    ...(evidence?.hot_paths ?? []).map((path) => path.split("/").slice(-2).join("/") || path),
    node.title,
    ...node.goals,
    ...node.checkpoints,
  ]
    .map((item) => sanitizeInstructionText(String(item)).replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 3 && !/^stage\s+\d+/i.test(item))
    .filter((item) => !genericAnchorPattern.test(item))
    .map((item) => {
      const tokens = toComparableTokens(item);
      const overlap = tokens.reduce((sum, token) => sum + (nodeTokenSet.has(token) ? 1 : 0), 0);
      const specificity = tokens.filter((token) => !REPO_GENERIC_TERMS.has(token)).length;
      return { item, score: overlap * 3 + specificity };
    })
    .sort((a, b) => b.score - a.score);
  const conceptAnchors = Array.from(new Set(rankedAnchors.map((entry) => entry.item))).slice(0, 4);

  const anchors = conceptAnchors.length > 0
    ? conceptAnchors
    : [
      sanitizeInstructionText(node.title),
      ...(node.goals ?? []),
      ...(node.checkpoints ?? []),
    ]
      .map((item) => String(item).trim())
      .filter((item) => item.length >= 3)
      .slice(0, 3);

  const pickFile = (idx: number) =>
    filesPool[idx % Math.max(filesPool.length, 1)] ?? "src/index.ts";

  const tasks = [
    {
      label: `Map behavior contract for ${anchors[0] ?? "core behavior"}`,
      steps: [
        `Define concrete invariants for ${anchors[0] ?? "the core behavior"} and list expected outputs.`,
        `Implement the first iteration in ${pickFile(0)} and cover one edge case immediately.`,
        "Run tests and verify invariant checks pass.",
      ],
      files: Array.from(new Set([pickFile(0), pickFile(1)])).slice(0, 2),
      commands: [command],
    },
    {
      label: `Implement ${anchors[1] ?? anchors[0] ?? "key functionality"} end-to-end`,
      steps: [
        `Implement ${anchors[1] ?? anchors[0] ?? "the next behavior"} in ${pickFile(1)} with explicit input parsing.`,
        "Add focused tests for normal, invalid, and boundary inputs.",
        "Run validation scripts and confirm zero regressions.",
      ],
      files: Array.from(new Set([pickFile(1), pickFile(2)])).slice(0, 2),
      commands: [command],
    },
    {
      label: `Harden ${anchors[2] ?? anchors[0] ?? "core logic"} for edge cases`,
      steps: [
        `Refactor ${pickFile(2)} to handle malformed inputs and precision boundaries for ${anchors[2] ?? anchors[0] ?? "core logic"}.`,
        "Write regression tests that lock expected behavior for tricky inputs.",
        "Re-run full checks and confirm stable output.",
      ],
      files: Array.from(new Set([pickFile(2), pickFile(3)])).slice(0, 2),
      commands: [command],
    },
  ];

  return {
    id: node.id,
    index: node.index,
    title: node.title,
    summary: node.summary,
    status: "not-started",
    eta: "45m",
    category: node.category,
    difficulty: node.difficulty,
    goals: node.goals,
    prerequisites: node.prerequisites,
    checkpoints: node.checkpoints,
    tasks,
    code_examples: [],
    resources: [],
    optional_peeks: node.optional_peeks,
    commit_window: [],
  } as Record<string, unknown>;
}

function toComparableTokens(text: string) {
  return sanitizeInstructionText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s/_-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !REPO_GENERIC_TERMS.has(token));
}

function toSimilarityTokens(text: string) {
  return sanitizeInstructionText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s/_-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) =>
      token.length >= 3 &&
      !REPO_GENERIC_TERMS.has(token) &&
      !SIMILARITY_STOPWORDS.has(token)
    );
}

function scoreStageGrounding(stage: Record<string, unknown>, evidence?: StageEvidenceRef | null) {
  if (!evidence) {
    return 0;
  }
  const stageText = JSON.stringify(stage).toLowerCase();
  const features = new Set([
    ...(evidence.feature_keywords ?? []),
    ...(evidence.api_concepts ?? []),
    ...(evidence.hot_paths ?? []).map((path) => path.split("/").pop() ?? path),
  ]
    .map((item) => normalizeKeywordToken(String(item)))
    .flatMap((item) => item.split(/\s+/))
    .filter((item) => item.length >= 3 && !REPO_GENERIC_TERMS.has(item)));
  if (features.size === 0) {
    return 0;
  }

  let hitCount = 0;
  for (const token of features) {
    if (stageText.includes(token)) {
      hitCount += 1;
    }
  }

  const tasks = Array.isArray(stage.tasks) ? stage.tasks as Array<Record<string, unknown>> : [];
  let fileHits = 0;
  for (const task of tasks) {
    const files = Array.isArray(task.files) ? task.files as string[] : [];
    for (const file of files) {
      if ((evidence.hot_paths ?? []).some((path) => path.includes(file) || file.includes(path.split("/").slice(-2).join("/")))) {
        fileHits += 1;
      }
    }
  }

  const featureCoverage = Math.min(1, hitCount / Math.max(4, Math.floor(features.size * 0.4)));
  const fileCoverage = Math.min(1, fileHits / 3);
  return Math.round((featureCoverage * 70) + (fileCoverage * 30));
}

function scoreStageConceptCoverage(stage: Record<string, unknown>, evidence?: StageEvidenceRef | null) {
  if (!evidence) {
    return 0;
  }
  const stageText = JSON.stringify(stage).toLowerCase();
  const tokens = new Set([
    ...(evidence.feature_keywords ?? []),
    ...(evidence.api_concepts ?? []),
    ...(evidence.hot_paths ?? []).flatMap((path) => path.split(/[\/_.-]+/g)),
  ]
    .map((value) => normalizeKeywordToken(String(value)))
    .flatMap((value) => value.split(/\s+/))
    .filter((token) => token.length >= 3 && !REPO_GENERIC_TERMS.has(token)));
  if (tokens.size === 0) {
    return 0;
  }
  let hits = 0;
  for (const token of tokens) {
    if (stageText.includes(token)) {
      hits += 1;
    }
  }
  return Math.round(Math.min(1, hits / Math.max(2, Math.floor(tokens.size * 0.35))) * 100);
}

function countStageRepoConceptHits(stage: Record<string, unknown>, evidence?: StageEvidenceRef | null) {
  if (!evidence) {
    return 0;
  }
  const stageText = JSON.stringify(stage).toLowerCase();
  const candidates = Array.from(new Set([
    ...(evidence.api_concepts ?? []),
    ...(evidence.feature_keywords ?? []),
    ...(evidence.hot_paths ?? []).map((path) => path.split("/").slice(-2).join("/") || path),
  ]
    .map((value) => normalizeKeywordToken(String(value)).trim())
    .filter((value) => value.length >= 3)));

  let hits = 0;
  for (const candidate of candidates) {
    const tokens = candidate.split(/\s+/).filter((token) => token.length >= 3 && !REPO_GENERIC_TERMS.has(token));
    if (tokens.length === 0) {
      continue;
    }
    const matched = tokens.every((token) => stageText.includes(token));
    if (matched) {
      hits += 1;
    }
  }
  return hits;
}

function scoreCheckpointCoherence(
  checkpoints: string[],
  goals: string[],
  tasks: Array<{ label: string; steps: string[] }>,
) {
  const targetTokens = new Set(toComparableTokens(`${checkpoints.join(" ")} ${goals.join(" ")}`));
  if (targetTokens.size === 0 || tasks.length === 0) {
    return 50;
  }
  const taskTokens = new Set(toComparableTokens(tasks.map((task) => `${task.label} ${task.steps.join(" ")}`).join(" ")));
  if (taskTokens.size === 0) {
    return 25;
  }
  let overlaps = 0;
  for (const token of targetTokens) {
    if (taskTokens.has(token)) {
      overlaps += 1;
    }
  }
  return Math.round(Math.min(1, overlaps / Math.max(3, Math.floor(targetTokens.size * 0.45))) * 100);
}

function scoreStageQualityFromMetrics(metrics: StageValidationMetrics) {
  const weighted =
    (metrics.actionabilityScore * 0.3) +
    (metrics.conceptCoverageScore * 0.25) +
    (metrics.noveltyScore * 0.2) +
    (metrics.commandFileRealismScore * 0.15) +
    (metrics.checkpointCoherenceScore * 0.1);
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

function validateHydratedStageQuality(
  stage: Record<string, unknown>,
  node: RoadmapSyllabusNode,
  evidence?: StageEvidenceRef | null,
  context?: {
    knownFiles?: Set<string>;
    packageManager?: RepoIngestSnapshot["treeStats"]["packageManager"];
    scripts?: Set<string>;
  },
) {
  const fallbackBasePath = `app/stage-${node.index}`;
  const failReasons: string[] = [];
  const failCodes = new Set<StageFailCode>();
  const knownFiles = context?.knownFiles;
  const packageManager = context?.packageManager ?? "unknown";
  const scripts = context?.scripts ?? new Set<string>();
  const titleText = String(stage.title ?? node.title ?? "").trim();
  const rawTasks = Array.isArray(stage.tasks) ? stage.tasks : [];
  let invalidCommandSetCount = 0;
  const sanitizedTasks = rawTasks
    .map((rawTask) => {
      const task = (rawTask && typeof rawTask === "object") ? (rawTask as Record<string, unknown>) : {};
      const label = sanitizeInstructionText(String(task.label ?? `Build ${node.title}`)).trim();
      const stepsRaw = Array.isArray(task.steps)
        ? task.steps.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      const steps = stepsRaw
        .map((item) => sanitizeInstructionText(item))
        .filter((item) => !containsForbiddenCloneInstruction(item))
        .slice(0, 8);
      const commandsRaw = Array.isArray(task.commands)
        ? task.commands.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      const commands = normalizeTaskCommands(
        commandsRaw
        .map((item) => sanitizeInstructionText(item))
        .filter((item) => !containsForbiddenCloneInstruction(item))
        .slice(0, 6),
        packageManager,
        scripts,
      );
      if (commandsRaw.length > 0 && commands.length === 0) {
        invalidCommandSetCount += 1;
      }
      const files = sanitizeTaskFiles(task.files, fallbackBasePath)
        .map((file) => resolveKnownRepoFile(file, knownFiles, evidence))
        .filter((file): file is string => Boolean(file));
      if (steps.length < 2 || files.length === 0 || commands.length === 0) {
        return null;
      }
      return {
        label: label || `Build ${node.title}`,
        steps,
        files,
        commands,
      };
    })
    .filter((task): task is { label: string; steps: string[]; files: string[]; commands: string[] } => Boolean(task));

  const stageText = JSON.stringify({ ...stage, tasks: sanitizedTasks });
  const cloneFree = !containsForbiddenCloneInstruction(stageText.toLowerCase());
  if (!cloneFree) {
    failReasons.push("contains forbidden clone/copy instructions");
    failCodes.add("missing_actionability");
  }
  if (!titleText || /^stage\s*\d+$/i.test(titleText)) {
    failReasons.push("title is missing or template-like");
    failCodes.add("template_phrase_repetition");
  }
  const minTaskCount = node.category === "setup" ? 2 : 3;
  if (sanitizedTasks.length < minTaskCount) {
    failReasons.push(`has fewer than ${minTaskCount} actionable tasks`);
    failCodes.add("missing_actionability");
  }
  const sourceLikeTaskCount = sanitizedTasks.filter((task) => task.files.some((file) => isSourceLikeFile(file))).length;
  if (node.category !== "setup" && sourceLikeTaskCount < Math.max(2, Math.min(3, sanitizedTasks.length))) {
    failReasons.push("tasks do not target enough source-like repository files");
    failCodes.add("low_source_file_relevance");
  }
  const uniqueTaskLabelCount = new Set(
    sanitizedTasks.map((task) => task.label.trim().toLowerCase()).filter(Boolean),
  ).size;
  const taskCount = Math.max(1, sanitizedTasks.length);
  const uniqueLabelRatio = uniqueTaskLabelCount / taskCount;
  if (uniqueTaskLabelCount < Math.max(2, Math.floor(sanitizedTasks.length * 0.8))) {
    failReasons.push("task labels are too repetitive");
    failCodes.add("template_phrase_repetition");
  }
  const templatePatternHits = sanitizedTasks.reduce((count, task) => {
    const text = `${task.label} ${task.steps.join(" ")}`;
    return count + (TEMPLATE_TASK_PATTERNS.some((pattern) => pattern.test(text)) ? 1 : 0);
  }, 0);
  const scaffoldStepPatternHits = sanitizedTasks.reduce((count, task) =>
    count + task.steps.filter((step) =>
      TEMPLATE_SCAFFOLD_STEP_PATTERNS.some((pattern) => pattern.test(step))
    ).length, 0);
  const recoveryStepHits = sanitizedTasks.reduce((count, task) => {
    return count + task.steps.filter((step) =>
      /add or update tests for .*, including at least one edge case/i.test(step) ||
      /run (npm|pnpm|yarn|bun)\s+(run\s+[a-z0-9:_-]+|test|lint|build|typecheck|check)\b.*confirm all checks pass/i.test(step) ||
      /with explicit input\/output behavior/i.test(step)
    ).length;
  }, 0);
  if (templatePatternHits > 0 || scaffoldStepPatternHits >= 2) {
    failReasons.push("contains repetitive scaffold task patterns");
    failCodes.add("template_phrase_repetition");
  }
  if (recoveryStepHits >= 2 || scaffoldStepPatternHits >= 3) {
    failReasons.push("contains fallback-like repair scaffolding phrases");
    failCodes.add("template_phrase_repetition");
  }
  const vagueLabelHits = sanitizedTasks.filter((task) =>
    /^(build .*behavior|implement .*logic|verify .*|setup .*framework|implement (src|github|workflows|package|lock).*)$/i.test(task.label.trim()) ||
    /parsing path$/i.test(task.label.trim())).length;
  const genericImplementLabelHits = sanitizedTasks.filter((task) =>
    /^(implement|build|verify)\s+[a-z0-9][a-z0-9\s/_-]{4,}$/i.test(task.label.trim()) &&
    !/(parser|format|token|duration|unit|api|middleware|cache|query|schema|endpoint|validation|serialize|deserialize|adapter)/i.test(task.label.trim())
  ).length;
  if (vagueLabelHits > 0 || genericImplementLabelHits > 1) {
    failReasons.push("contains vague or low-signal task labels");
    failCodes.add("template_phrase_repetition");
  }
  if (invalidCommandSetCount > 0) {
    failReasons.push("contains invalid command sets for package manager/scripts");
    failCodes.add("invalid_command_set");
  }
  const summaryText = sanitizeInstructionText(String(stage.summary ?? node.summary ?? "")).trim();
  if (!summaryText || /^build stage \d+ from scratch/i.test(summaryText)) {
    failReasons.push("summary is template-like or empty");
    failCodes.add("template_phrase_repetition");
  }
  if (
    evidence?.archetype === "utility-lib" &&
    sanitizedTasks.some((task) => task.files.some((file) => /src\/app\.(ts|js|tsx|jsx)/i.test(file)))
  ) {
    failReasons.push("utility/library stage should not default to app-shell files");
    failCodes.add("low_source_file_relevance");
  }

  const qualityCandidate = {
    ...stage,
    summary: summaryText || node.summary,
    tasks: sanitizedTasks,
  };
  const groundingScore = scoreStageGrounding(qualityCandidate, evidence);
  const conceptCoverageScore = scoreStageConceptCoverage(qualityCandidate, evidence);
  const conceptHits = countStageRepoConceptHits(qualityCandidate, evidence);
  const actionabilityScore = Math.round(
    Math.max(0, Math.min(1, sanitizedTasks.length / 4)) * 40 +
    Math.max(0, Math.min(1, sanitizedTasks.reduce((sum, task) => sum + task.steps.length, 0) / Math.max(8, sanitizedTasks.length * 3))) * 40 +
    Math.max(0, Math.min(1, sanitizedTasks.reduce((sum, task) => sum + task.commands.length, 0) / Math.max(3, sanitizedTasks.length))) * 20,
  );
  const commandFileRealismScore = Math.round(
    Math.max(0, Math.min(1, sourceLikeTaskCount / Math.max(1, sanitizedTasks.length))) * 65 +
    Math.max(0, Math.min(1, (sanitizedTasks.length - invalidCommandSetCount) / Math.max(1, sanitizedTasks.length))) * 35,
  );
  const checkpointCoherenceScore = scoreCheckpointCoherence(
    Array.isArray(qualityCandidate.checkpoints) ? qualityCandidate.checkpoints.map((item) => String(item)) : [],
    Array.isArray(qualityCandidate.goals) ? qualityCandidate.goals.map((item) => String(item)) : [],
    sanitizedTasks.map((task) => ({ label: task.label, steps: task.steps })),
  );
  const templateRiskScore = Math.max(0, Math.min(100, Math.round(
    (templatePatternHits * 24) +
    (scaffoldStepPatternHits * 16) +
    (vagueLabelHits * 16) +
    (recoveryStepHits * 30) +
    ((1 - uniqueLabelRatio) * 45),
  )));
  const noveltyScore = Math.max(0, Math.min(100, Math.round(
    (uniqueLabelRatio * 70) + ((100 - templateRiskScore) * 0.3),
  )));
  const metrics: StageValidationMetrics = {
    actionabilityScore,
    conceptCoverageScore,
    noveltyScore,
    commandFileRealismScore,
    checkpointCoherenceScore,
    templateRiskScore,
  };
  const qualityScore = scoreStageQualityFromMetrics(metrics);

  const relaxedGroundingCategory = new Set(["docs", "ops", "chore"]);
  const groundingThreshold = relaxedGroundingCategory.has(node.category)
    ? Math.max(1, MIN_GROUNDING_SCORE - 10)
    : Math.max(1, MIN_GROUNDING_SCORE - 1);
  if (groundingScore < groundingThreshold) {
    failReasons.push(`insufficient repo grounding (${groundingScore})`);
    failCodes.add("low_grounding");
  }
  if (conceptCoverageScore < MIN_CONCEPT_COVERAGE_SCORE) {
    failReasons.push(`low repo concept coverage (${conceptCoverageScore})`);
    failCodes.add("low_repo_concept_coverage");
  }
  const minConceptHits = node.category === "setup" ? 1 : 2;
  if (conceptHits < minConceptHits) {
    failReasons.push(`insufficient repo concept references (${conceptHits} < ${minConceptHits})`);
    failCodes.add("low_repo_concept_coverage");
  }
  if (templateRiskScore > MAX_TEMPLATE_RISK_SCORE) {
    failReasons.push(`template risk too high (${templateRiskScore})`);
    failCodes.add("template_phrase_repetition");
  }
  if (actionabilityScore < 60) {
    failReasons.push(`actionability too low (${actionabilityScore})`);
    failCodes.add("missing_actionability");
  }
  if (qualityScore < 65) {
    failReasons.push(`weighted quality score too low (${qualityScore})`);
    failCodes.add("missing_actionability");
  }
  const ok = failCodes.size === 0;
  return {
    stage: qualityCandidate,
    qualityScore,
    groundingScore,
    conceptCoverageScore,
    templateRiskScore,
    metrics,
    ok,
    failCodes: Array.from(failCodes),
    failReasons: Array.from(new Set(failReasons)),
  };
}

function scoreStageQuality(stage: Record<string, unknown>) {
  const tasks = Array.isArray(stage.tasks) ? stage.tasks as Array<Record<string, unknown>> : [];
  const goals = Array.isArray(stage.goals) ? stage.goals.map((item) => String(item)) : [];
  const checkpoints = Array.isArray(stage.checkpoints) ? stage.checkpoints.map((item) => String(item)) : [];
  const sourceLikeTaskCount = tasks.filter((task) =>
    Array.isArray(task.files) && (task.files as unknown[]).some((file) => isSourceLikeFile(String(file)))
  ).length;
  const actionabilityScore = Math.round(
    Math.max(0, Math.min(1, tasks.length / 4)) * 50 +
    Math.max(0, Math.min(1, tasks.reduce((sum, task) => sum + (Array.isArray(task.steps) ? task.steps.length : 0), 0) / Math.max(8, tasks.length * 3))) * 50,
  );
  const conceptCoverageScore = Math.max(50, Math.min(90, Math.round(
    Math.max(0, Math.min(1, (goals.length + checkpoints.length) / 6)) * 100,
  )));
  const noveltyScore = Math.max(35, Math.min(95, Math.round(
    (new Set(tasks.map((task) => String(task.label ?? "").toLowerCase())).size / Math.max(1, tasks.length)) * 100,
  )));
  const commandFileRealismScore = Math.max(25, Math.min(95, Math.round(
    Math.max(0, Math.min(1, sourceLikeTaskCount / Math.max(1, tasks.length))) * 100,
  )));
  const checkpointCoherenceScore = scoreCheckpointCoherence(
    checkpoints,
    goals,
    tasks.map((task) => ({
      label: String(task.label ?? ""),
      steps: Array.isArray(task.steps) ? task.steps.map((step) => String(step)) : [],
    })),
  );
  return scoreStageQualityFromMetrics({
    actionabilityScore,
    conceptCoverageScore,
    noveltyScore,
    commandFileRealismScore,
    checkpointCoherenceScore,
    templateRiskScore: 0,
  });
}

function scoreLexicalSimilarity(a: string, b: string) {
  const aTokens = new Set(toSimilarityTokens(a));
  const bTokens = new Set(toSimilarityTokens(b));
  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(1, new Set([...aTokens, ...bTokens]).size);
}

function stageSignature(stage: Record<string, unknown>) {
  const tasks = Array.isArray(stage.tasks) ? stage.tasks as Array<Record<string, unknown>> : [];
  const taskText = tasks
    .map((task) => {
      const label = String(task.label ?? "");
      const steps = Array.isArray(task.steps) ? task.steps.join(" ") : "";
      return `${label} ${steps}`;
    })
    .join(" ");
  return `${String(stage.title ?? "")} ${String(stage.summary ?? "")} ${taskText}`;
}

function evaluateChunkQuality(options: {
  chunkNodes: RoadmapSyllabusNode[];
  chunkStages: Record<string, unknown>[];
  existingTimeline: Record<string, unknown>[];
  validationByNodeId: Map<string, StageValidationReport>;
  archetype: RepoArchetype;
  domainKeywords: string[];
}) {
  const reasons: string[] = [];
  const failedStageIds = new Set<string>();
  const chunkFailCodes = new Set<StageFailCode>();
  const combinedTimeline = [
    ...options.existingTimeline.filter((stage) => String(stage.id ?? "") !== "stage-setup"),
    ...options.chunkStages,
  ];

  const similarityScores: number[] = [];
  const worstSimilarityByNewStage = new Map<string, number>();
  const signatures = combinedTimeline.map((stage) => ({
    id: String(stage.id ?? ""),
    index: Number(stage.index ?? 0),
    category: String(stage.category ?? "feature"),
    text: stageSignature(stage),
  }));
  for (let idx = 0; idx < signatures.length; idx += 1) {
    for (let j = idx + 1; j < signatures.length; j += 1) {
      const setupMismatch =
        (signatures[idx].category === "setup" && signatures[j].category !== "setup") ||
        (signatures[idx].category !== "setup" && signatures[j].category === "setup");
      if (setupMismatch) {
        continue;
      }
      const rawScore = scoreLexicalSimilarity(signatures[idx].text, signatures[j].text);
      const earlyOrSetupPair =
        (
          (signatures[idx].index <= 2 && signatures[j].index <= 2) ||
          (signatures[idx].category === "setup" && signatures[j].category === "setup")
        );
      const score = earlyOrSetupPair ? rawScore * 0.55 : rawScore;
      similarityScores.push(score);
      const involvesNewStage = options.chunkStages.some((stage) => String(stage.id ?? "") === signatures[j].id);
      if (involvesNewStage) {
        const currentWorst = worstSimilarityByNewStage.get(signatures[j].id) ?? 0;
        worstSimilarityByNewStage.set(signatures[j].id, Math.max(currentWorst, score));
      }
      if (involvesNewStage && score > CROSS_STAGE_SIMILARITY_LIMIT) {
        failedStageIds.add(signatures[j].id);
        chunkFailCodes.add("cross_stage_duplication");
        reasons.push(`high cross-stage duplication: ${signatures[idx].id} vs ${signatures[j].id} (${score.toFixed(2)})`);
      }
    }
  }

  const chunkTemplateStageIds = options.chunkStages
    .filter((stage) => {
      const tasks = Array.isArray(stage.tasks) ? stage.tasks as Array<Record<string, unknown>> : [];
      const hits = tasks.reduce((count, task) => {
        const text = `${String(task.label ?? "")} ${
          Array.isArray(task.steps) ? task.steps.join(" ") : ""
        }`;
        return count + (TEMPLATE_TASK_PATTERNS.some((pattern) => pattern.test(text)) ? 1 : 0);
      }, 0);
      return hits >= 1;
    })
    .map((stage) => String(stage.id ?? ""));
  if (chunkTemplateStageIds.length > 0) {
    for (const stageId of chunkTemplateStageIds) {
      failedStageIds.add(stageId);
    }
    chunkFailCodes.add("template_phrase_repetition");
    reasons.push(`template scaffolding pattern detected in ${chunkTemplateStageIds.join(", ")}`);
  }

  if (options.archetype === "utility-lib" || options.archetype === "sdk") {
    const domainTokens = options.domainKeywords
      .map((keyword) => normalizeKeywordToken(keyword))
      .filter((keyword) => keyword.length >= 3 && !REPO_GENERIC_TERMS.has(keyword))
      .slice(0, 16);
    const firstStages = combinedTimeline
      .filter((stage) => Number(stage.index ?? 0) > 0)
      .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
      .slice(0, Math.min(3, combinedTimeline.length));
    const firstStagesText = firstStages.map((stage) => stageSignature(stage).toLowerCase()).join(" ");
    const domainCoverage = domainTokens.some((token) => firstStagesText.includes(token));
    if (!domainCoverage && firstStages.length > 0) {
      const offending = firstStages
        .map((stage) => String(stage.id ?? ""))
        .filter((stageId) => options.chunkStages.some((stage) => String(stage.id ?? "") === stageId));
      for (const stageId of offending) {
        failedStageIds.add(stageId);
      }
      chunkFailCodes.add("low_repo_concept_coverage");
      reasons.push("tiny/small repo early stages miss core domain behavior");
    }
  }

  const groundingScores = options.chunkNodes.map((node) => Number(options.validationByNodeId.get(node.id)?.groundingScore ?? 0));
  const conceptCoverageScores = options.chunkNodes.map((node) =>
    Number(options.validationByNodeId.get(node.id)?.conceptCoverageScore ?? 0));
  const templateRiskScores = options.chunkNodes.map((node) =>
    Number(options.validationByNodeId.get(node.id)?.templateRiskScore ?? 100));
  const groundingScore = groundingScores.length > 0
    ? Math.round(groundingScores.reduce((sum, value) => sum + value, 0) / groundingScores.length)
    : 0;
  const conceptCoverageScore = conceptCoverageScores.length > 0
    ? Math.round(conceptCoverageScores.reduce((sum, value) => sum + value, 0) / conceptCoverageScores.length)
    : 0;
  const templateRiskScore = templateRiskScores.length > 0
    ? Math.round(templateRiskScores.reduce((sum, value) => sum + value, 0) / templateRiskScores.length)
    : 100;
  const worstSimilarities = Array.from(worstSimilarityByNewStage.values());
  const averageWorstSimilarity = worstSimilarities.length > 0
    ? worstSimilarities.reduce((sum, value) => sum + value, 0) / worstSimilarities.length
    : (similarityScores.length > 0 ? Math.max(...similarityScores) : 0);
  const dedupeScore = Math.max(0, Math.min(100, Math.round((1 - averageWorstSimilarity) * 100)));
  const noveltyScore = dedupeScore;
  const antiTemplatePass = chunkTemplateStageIds.length === 0;
  const dedupeThreshold = options.chunkStages.length <= 1
    ? 25
    : (options.chunkStages.length <= 2 ? 25 : MIN_DEDUPE_SCORE);
  if (dedupeScore < dedupeThreshold) {
    for (const stage of options.chunkStages) {
      failedStageIds.add(String(stage.id ?? ""));
    }
    chunkFailCodes.add("low_dedupe");
    reasons.push(`dedupe score below threshold (${dedupeScore} < ${dedupeThreshold})`);
  }
  const hasRelaxedGroundingCategory = options.chunkNodes.some((node) =>
    ["docs", "ops", "chore"].includes(node.category)
  );
  const groundingThreshold = hasRelaxedGroundingCategory
    ? Math.max(1, MIN_GROUNDING_SCORE - 10)
    : Math.max(1, MIN_GROUNDING_SCORE - 1);
  if (groundingScore < groundingThreshold) {
    for (const stage of options.chunkStages) {
      failedStageIds.add(String(stage.id ?? ""));
    }
    chunkFailCodes.add("low_grounding");
    reasons.push(`grounding score below threshold (${groundingScore} < ${groundingThreshold})`);
  }
  if (conceptCoverageScore < MIN_CONCEPT_COVERAGE_SCORE) {
    for (const stage of options.chunkStages) {
      failedStageIds.add(String(stage.id ?? ""));
    }
    chunkFailCodes.add("low_repo_concept_coverage");
    reasons.push(`concept coverage below threshold (${conceptCoverageScore} < ${MIN_CONCEPT_COVERAGE_SCORE})`);
  }
  if (templateRiskScore > MAX_TEMPLATE_RISK_SCORE) {
    for (const stage of options.chunkStages) {
      failedStageIds.add(String(stage.id ?? ""));
    }
    chunkFailCodes.add("template_phrase_repetition");
    reasons.push(`template risk above threshold (${templateRiskScore} > ${MAX_TEMPLATE_RISK_SCORE})`);
  }

  let chunkStatus: ChunkStatus = "pass";
  if (failedStageIds.size > 0) {
    chunkStatus = options.chunkStages.length === failedStageIds.size ? "fail" : "partial_pass";
  }

  return {
    noveltyScore,
    dedupeScore,
    groundingScore,
    conceptCoverageScore,
    templateRiskScore,
    antiTemplatePass,
    failedStageIds: Array.from(failedStageIds),
    failCodes: Array.from(chunkFailCodes),
    reasons: Array.from(new Set(reasons)),
    qualityGateStatus:
      failedStageIds.size > 0 ||
      !antiTemplatePass ||
      groundingScore < groundingThreshold ||
      conceptCoverageScore < MIN_CONCEPT_COVERAGE_SCORE ||
      templateRiskScore > MAX_TEMPLATE_RISK_SCORE
        ? "fail"
        : "pass",
    chunkStatus,
  };
}

function normalizeTimeline(
  timelineRaw: unknown,
  stageBudget: number,
  commits: Array<{ sha: string }>,
): Array<Record<string, unknown>> {
  const rawList = Array.isArray(timelineRaw) ? timelineRaw : [];
  const stages = rawList
    .slice(0, stageBudget)
    .map((rawStage, idx) => {
      const stage = (rawStage && typeof rawStage === "object") ? (rawStage as Record<string, unknown>) : {};
      const rawTasks = Array.isArray(stage.tasks) ? stage.tasks : [];
      const tasks = rawTasks
        .map((rawTask) => {
          const task = (rawTask && typeof rawTask === "object") ? (rawTask as Record<string, unknown>) : {};
          const label = typeof task.label === "string"
            ? sanitizeInstructionText(task.label.trim())
            : "Task";
          const steps = Array.isArray(task.steps)
            ? task.steps
              .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
              .map((item) => sanitizeInstructionText(item))
              .filter((item) => !containsForbiddenCloneInstruction(item))
            : [];
          const files = Array.isArray(task.files)
            ? task.files.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : [];
          const commands = Array.isArray(task.commands)
            ? task.commands
              .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
              .map((item) => sanitizeInstructionText(item))
              .filter((item) => !containsForbiddenCloneInstruction(item))
            : [];

          if (steps.length === 0) {
            return null;
          }

          return {
            label,
            steps: steps.slice(0, 8),
            files: files.slice(0, 6),
            commands: commands.slice(0, 6),
          };
        })
        .filter(Boolean);

      const goals = Array.isArray(stage.goals)
        ? stage.goals.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      const prerequisites = Array.isArray(stage.prerequisites)
        ? stage.prerequisites.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      const checkpoints = Array.isArray(stage.checkpoints)
        ? stage.checkpoints.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      const resources = Array.isArray(stage.resources)
        ? stage.resources
          .map((resource) => {
            const item = (resource && typeof resource === "object") ? (resource as Record<string, unknown>) : {};
            if (!(typeof item.label === "string" && typeof item.href === "string")) {
              return null;
            }
            return {
              label: item.label,
              href: item.href,
            };
          })
          .filter(Boolean)
        : [];

      const codeExamples = Array.isArray(stage.code_examples)
        ? stage.code_examples
          .map((example) => {
            const item = (example && typeof example === "object") ? (example as Record<string, unknown>) : {};
            if (!(typeof item.file === "string" && typeof item.language === "string" && typeof item.description === "string" && typeof item.snippet === "string")) {
              return null;
            }
            return {
              file: item.file,
              language: item.language,
              description: item.description,
              snippet: item.snippet,
            };
          })
          .filter(Boolean)
        : [];

      const stageTitle = typeof stage.title === "string" && stage.title.trim().length > 0
        ? stage.title.trim()
        : "";
      const safeSummary = typeof stage.summary === "string" && stage.summary.trim().length > 0
        ? stage.summary
        : "";
      const safeGoals = goals.length > 0
        ? goals.slice(0, 3)
        : [];
      const safeTasks = tasks.length > 0
        ? tasks
        : [];

      return {
        id: `stage-${idx + 1}`,
        index: idx + 1,
        title: stageTitle,
        summary: safeSummary,
        status: "not-started",
        eta: typeof stage.eta === "string" ? stage.eta : "45m",
        category: typeof stage.category === "string" ? stage.category : "feature",
        difficulty: typeof stage.difficulty === "string" ? stage.difficulty : "easy",
        goals: safeGoals,
        prerequisites: prerequisites.slice(0, 5),
        checkpoints: checkpoints.slice(0, 5),
        tasks: safeTasks,
        code_examples: codeExamples,
        resources,
        commit_window: Array.isArray(stage.commit_window)
          ? stage.commit_window.filter((sha): sha is string => typeof sha === "string")
          : [],
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const setupStage = {
    id: "stage-setup",
    index: 0,
    title: "Workspace Setup",
    summary: "Prepare your own clean project workspace before implementing features.",
    status: "not-started",
    eta: "20m",
    category: "setup",
    difficulty: "intro",
    goals: [
      "Create a fresh project workspace",
      "Install dependencies",
      "Run basic checks locally",
    ],
    prerequisites: [],
    checkpoints: [
      "Project boots locally",
      "Lint/type checks run successfully",
    ],
    tasks: [
      {
        label: "Initialize project structure",
        steps: [
          "Create a new empty repository/folder for your rebuild.",
          "Set up the framework/runtime skeleton and package manager.",
        ],
        files: ["README.md", "package.json"],
        commands: ["npm install", "npm run dev"],
      },
    ],
    code_examples: [],
    resources: [],
    commit_window: commits.length > 0 ? [commits[commits.length - 1].sha, commits[0].sha] : [],
  };

  return [setupStage, ...stages.map((stage, idx) => ({ ...stage, index: idx + 1 }))] as Array<Record<string, unknown>>;
}

async function getGlobalUsage(supabase: SupabaseClient): Promise<GlobalUsage> {
  const { data, error } = await supabase.rpc("get_global_token_budget", {
    p_daily_limit: GLOBAL_DAILY_TOKEN_LIMIT,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    const fallbackDailyLimit = Math.max(Number.isFinite(GLOBAL_DAILY_TOKEN_LIMIT) ? GLOBAL_DAILY_TOKEN_LIMIT : 2_500_000, 1);
    return {
      daily_limit: fallbackDailyLimit,
      used: 0,
      remaining: fallbackDailyLimit,
      mode: "normal",
      reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const row = data[0] as Record<string, unknown>;
  return {
    daily_limit: Number(row.daily_limit ?? 0),
    used: Number(row.used ?? 0),
    remaining: Number(row.remaining ?? 0),
    mode: String(row.mode ?? "normal") as GlobalUsage["mode"],
    reset_at: String(row.reset_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
  };
}

async function getProviderRateLimitStatus(supabase: SupabaseClient) {
  const lookbackMs = Math.max(5, PROVIDER_RATE_LIMIT_LOOKBACK_MINUTES) * 60 * 1000;
  const sinceIso = new Date(Date.now() - lookbackMs).toISOString();
  const { data, error } = await supabase
    .from("roadmap_worker_runs")
    .select("created_at,error_detail,status,task_type")
    .eq("status", "failed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !(Array.isArray(data) && data.length > 0)) {
    return {
      provider_limited: false,
      provider_limited_since: null,
      provider_retry_at: null,
      provider_reason: null,
    };
  }

  const rateLimitedRows = data.filter((row) =>
    PROVIDER_RATE_LIMIT_REGEX.test(String(row.error_detail ?? ""))
  );
  if (rateLimitedRows.length === 0) {
    return {
      provider_limited: false,
      provider_limited_since: null,
      provider_retry_at: null,
      provider_reason: null,
    };
  }

  const latest = rateLimitedRows[0] as Record<string, unknown>;
  const latestAt = new Date(String(latest.created_at ?? new Date().toISOString()));
  const cooldownMinutes = Math.max(5, Math.min(45, PROVIDER_RATE_LIMIT_COOLDOWN_MINUTES + (rateLimitedRows.length - 1) * 2));
  const retryAt = new Date(latestAt.getTime() + cooldownMinutes * 60 * 1000);
  const now = Date.now();
  const providerLimited = retryAt.getTime() > now;

  return {
    provider_limited: providerLimited,
    provider_limited_since: latestAt.toISOString(),
    provider_retry_at: retryAt.toISOString(),
    provider_reason: sanitizeControlChars(String(latest.error_detail ?? "")).slice(0, 240),
  };
}

async function getQueueLoadSummary(supabase: SupabaseClient) {
  const [queuedResult, processingResult] = await Promise.all([
    supabase
      .from("roadmap_generation_jobs")
      .select("id", { head: true, count: "exact" })
      .eq("queue_state", "queued"),
    supabase
      .from("roadmap_generation_jobs")
      .select("id", { head: true, count: "exact" })
      .eq("queue_state", "processing"),
  ]);

  return {
    queuedJobs: Number(queuedResult.count ?? 0),
    processingJobs: Number(processingResult.count ?? 0),
  };
}

async function resolvePlanDailyLimit(
  supabase: SupabaseClient,
  userId: string | null,
  planTier: PlanTier,
): Promise<number> {
  const envFallbackLimit = Math.max(
    Number.isFinite(USER_DAILY_TOKEN_SOFT_LIMIT) ? USER_DAILY_TOKEN_SOFT_LIMIT : PLAN_SOFT_LIMITS.free,
    1,
  );
  const planFallbackLimit = Math.max(PLAN_SOFT_LIMITS[planTier] ?? PLAN_SOFT_LIMITS.free, 1);

  if (!userId) {
    return planFallbackLimit;
  }

  const { data: overrideRow } = await supabase
    .from("user_plan_overrides")
    .select("daily_soft_limit")
    .eq("user_id", userId)
    .maybeSingle();
  const overrideLimit = Number(overrideRow?.daily_soft_limit ?? 0);
  if (Number.isFinite(overrideLimit) && overrideLimit > 0) {
    return Math.max(1, Math.floor(overrideLimit));
  }

  const { data: quotaRow } = await supabase
    .from("plan_token_quotas")
    .select("daily_soft_limit")
    .eq("plan_tier", planTier)
    .maybeSingle();
  const quotaLimit = Number(quotaRow?.daily_soft_limit ?? 0);
  if (Number.isFinite(quotaLimit) && quotaLimit > 0) {
    return Math.max(1, Math.floor(quotaLimit));
  }

  if (planTier === "free" && envFallbackLimit > 0) {
    return envFallbackLimit;
  }

  return planFallbackLimit;
}

async function getUserSoftUsage(
  supabase: SupabaseClient,
  userId: string | null,
  planTier: PlanTier,
): Promise<UserSoftUsage> {
  const fallbackLimit = await resolvePlanDailyLimit(supabase, userId, planTier);
  if (!userId) {
    return {
      daily_limit: fallbackLimit,
      used: 0,
      remaining: fallbackLimit,
      reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const { data, error } = await supabase.rpc("get_user_soft_token_budget", {
    p_user_id: userId,
    p_daily_limit: fallbackLimit,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return {
      daily_limit: fallbackLimit,
      used: 0,
      remaining: fallbackLimit,
      reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const row = data[0] as Record<string, unknown>;
  return {
    daily_limit: Number(row.daily_limit ?? fallbackLimit),
    used: Number(row.used ?? 0),
    remaining: Number(row.remaining ?? fallbackLimit),
    reset_at: String(row.reset_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
  };
}

function modeFromRemaining(remaining: number, dailyLimit: number): "normal" | "low" | "critical" {
  if (remaining <= 0) {
    return "critical";
  }
  if (remaining <= Math.max(1, Math.floor(dailyLimit * 0.15))) {
    return "low";
  }
  return "normal";
}

async function resolveUsageMode(
  supabase: SupabaseClient,
  userId: string | null,
  planTier: PlanTier = "free",
) {
  const globalUsage = await getGlobalUsage(supabase);
  const userUsage = await getUserSoftUsage(supabase, userId, planTier);
  const userMode = modeFromRemaining(userUsage.remaining, userUsage.daily_limit);

  const mode: "normal" | "low" | "critical" =
    globalUsage.mode === "critical" || userMode === "critical"
      ? "critical"
      : globalUsage.mode === "low" || userMode === "low"
        ? "low"
        : "normal";

  return {
    mode,
    globalUsage,
    userUsage,
    planTier,
  };
}

async function recordTokenUsage(supabase: SupabaseClient, params: {
  kind: string;
  userId: string | null;
  endpoint: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  metadata?: JsonObject;
  userDailyLimit?: number;
}) {
  const safePromptTokens = Math.max(0, Math.floor(params.promptTokens));
  const safeCompletionTokens = Math.max(0, Math.floor(params.completionTokens));
  const safeTotalTokens = Math.max(0, Math.floor(params.totalTokens));

  const usageResult = await supabase.rpc("record_token_usage", {
    p_kind: params.kind,
    p_user_id: params.userId,
    p_endpoint: params.endpoint,
    p_prompt_tokens: safePromptTokens,
    p_completion_tokens: safeCompletionTokens,
    p_total_tokens: safeTotalTokens,
    p_metadata: params.metadata ?? {},
    p_daily_limit: GLOBAL_DAILY_TOKEN_LIMIT,
  });

  if (usageResult.error) {
    // Fallback path when RPC is unavailable/misconfigured.
    console.error("record_token_usage RPC failed, using table fallback:", usageResult.error.message);
    const budgetDate = new Date().toISOString().slice(0, 10);
    const { data: existingBudget } = await supabase
      .from("global_token_budget")
      .select("used,daily_limit")
      .eq("budget_date", budgetDate)
      .maybeSingle();

    const previousUsed = Number(existingBudget?.used ?? 0);
    const resolvedDailyLimit = Math.max(Number(existingBudget?.daily_limit ?? GLOBAL_DAILY_TOKEN_LIMIT) || GLOBAL_DAILY_TOKEN_LIMIT, 1);

    await supabase
      .from("global_token_budget")
      .upsert(
        {
          budget_date: budgetDate,
          daily_limit: resolvedDailyLimit,
          used: previousUsed + safeTotalTokens,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "budget_date" },
      );

    await supabase
      .from("token_usage_events")
      .insert({
        kind: params.kind,
        user_id: params.userId,
        endpoint: params.endpoint,
        prompt_tokens: safePromptTokens,
        completion_tokens: safeCompletionTokens,
        total_tokens: safeTotalTokens,
        metadata: params.metadata ?? {},
      });
  }

  if (params.userId) {
    const resolvedUserDailyLimit = Math.max(
      1,
      Math.floor(
        Number(params.userDailyLimit ?? USER_DAILY_TOKEN_SOFT_LIMIT ?? PLAN_SOFT_LIMITS.free) || PLAN_SOFT_LIMITS.free,
      ),
    );
    const userSoftResult = await supabase.rpc("record_user_soft_token_usage", {
      p_user_id: params.userId,
      p_total_tokens: safeTotalTokens,
      p_daily_limit: resolvedUserDailyLimit,
    });

    if (userSoftResult.error) {
      console.error("record_user_soft_token_usage RPC failed:", userSoftResult.error.message);
    }
  }
}

function _getRepoSlug(fullName: string) {
  const [owner, repo] = fullName.split("/");
  return `${owner}-${repo}`;
}

function toCatalogResponse(rows: Record<string, unknown>[], page: number, pageSize: number, totalCount: number) {
  const items = rows.map((row) => mapRoadmapRow(row));
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;
  return {
    items,
    page,
    page_size: pageSize,
    total_count: totalCount,
    total_pages: totalPages,
  };
}

type RoadmapWorkerTaskPayload = {
  type: RoadmapWorkerTaskType;
  job_id?: string;
  user_id?: string;
  plan_tier?: PlanTier;
  repo_full_name?: string;
  chunk_size?: number;
  stage_id?: string;
  flag_id?: string;
  target_language?: RoadmapTranslationLanguage;
  stage_ids?: string[];
};

type RoadmapWorkerQueueMessage = {
  msg_id: number;
  read_ct: number;
  message: RoadmapWorkerTaskPayload;
};

function isWorkerAuthorized(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (SUPABASE_SERVICE_ROLE_KEY && authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return true;
  }
  if (!ROADMAP_WORKER_SECRET) {
    return true;
  }
  const supplied = req.headers.get("x-worker-secret") ?? "";
  return supplied.length > 0 && supplied === ROADMAP_WORKER_SECRET;
}

async function enqueueRoadmapTask(supabase: SupabaseClient, task: RoadmapWorkerTaskPayload) {
  const { data, error } = await supabase.rpc("enqueue_roadmap_task", {
    p_task_type: task.type,
    p_payload: task,
    p_delay_seconds: 0,
  });
  if (error) {
    throw new Error(`Queue enqueue failed: ${error.message}`);
  }
  const msgId = Number(data ?? 0);
  return Number.isFinite(msgId) && msgId > 0 ? msgId : null;
}

async function readRoadmapTasks(supabase: SupabaseClient, limit: number): Promise<RoadmapWorkerQueueMessage[]> {
  const readLimit = Math.max(1, Math.min(WORKER_MAX_BATCH_SIZE, Math.floor(limit)));
  const { data, error } = await supabase.rpc("read_roadmap_tasks", {
    p_batch_size: readLimit,
    p_visibility_timeout: 60,
  });
  if (error) {
    throw new Error(`Queue read failed: ${error.message}`);
  }
  const messages: RoadmapWorkerQueueMessage[] = [];
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    const messageEnvelope = record.message;
    if (!(messageEnvelope && typeof messageEnvelope === "object")) {
      continue;
    }
    const envelope = messageEnvelope as Record<string, unknown>;
    const payload = envelope.payload;
    if (!(payload && typeof payload === "object")) {
      continue;
    }
    const task = payload as RoadmapWorkerTaskPayload;
    if (typeof task.type !== "string") {
      continue;
    }
    messages.push({
      msg_id: Number(record.msg_id ?? 0),
      read_ct: Number(record.read_ct ?? 0),
      message: task,
    });
  }
  return messages.filter((item) => Number.isFinite(item.msg_id) && item.msg_id > 0);
}

async function archiveRoadmapTask(supabase: SupabaseClient, msgId: number) {
  const { error } = await supabase.rpc("archive_roadmap_task", {
    p_msg_id: msgId,
  });
  if (error) {
    console.error("Queue archive failed", msgId, error.message);
  }
}

async function setRoadmapTaskVisibility(supabase: SupabaseClient, msgId: number, seconds: number) {
  const safeSeconds = Math.max(10, Math.min(600, Math.floor(seconds)));
  const { error } = await supabase.rpc("set_roadmap_task_vt", {
    p_msg_id: msgId,
    p_visibility_timeout: safeSeconds,
  });
  if (error) {
    console.error("Queue visibility update failed", msgId, error.message);
  }
}

function resolveWorkerDrainUrl(req: Request) {
  const fallbackOrigin = new URL(req.url).origin;
  const origin = (SUPABASE_URL || fallbackOrigin).replace(/\/$/, "");
  return `${origin}/functions/v1/roadmap-worker/api/v1/internal/worker/drain`;
}

function scheduleBackgroundTask(task: Promise<unknown>) {
  try {
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(task);
      return;
    }
  } catch {
    // no-op
  }
  task.catch(() => undefined);
}

function triggerWorkerDrain(context: RouteContext, maxTasks = 1) {
  const target = resolveWorkerDrainUrl(context.req);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (SUPABASE_SERVICE_ROLE_KEY) {
    headers.apikey = SUPABASE_SERVICE_ROLE_KEY;
    headers.Authorization = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  }
  if (ROADMAP_WORKER_SECRET) {
    headers["x-worker-secret"] = ROADMAP_WORKER_SECRET;
  }
  const task = fetch(target, {
    method: "POST",
    headers,
    body: JSON.stringify({
      max_tasks: Math.max(1, Math.min(WORKER_MAX_BATCH_SIZE, Math.floor(maxTasks))),
    }),
  }).catch((error) => {
    console.error("Failed to trigger worker drain:", error instanceof Error ? error.message : String(error));
  });
  scheduleBackgroundTask(task);
}

async function getGitHubTokenForUser(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("github_credentials")
    .select("access_token")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const userToken = typeof data?.access_token === "string" && data.access_token.length > 0 ? data.access_token : null;
  if (userToken) {
    try {
      await githubRequest<Record<string, unknown>>("/user", userToken);
      return userToken;
    } catch (error) {
      if (isGitHubBadCredentialsError(error)) {
        // Stale OAuth token (common after OAuth app config changes). Remove it so reconnect flow is clean.
        await supabase.from("github_credentials").delete().eq("clerk_user_id", userId);
      } else {
        throw error;
      }
    }
  }

  if (typeof GITHUB_TOKEN === "string" && GITHUB_TOKEN.length > 0) {
    return GITHUB_TOKEN;
  }

  return null;
}

async function generateRoadmapInternal(options: {
  supabase: SupabaseClient;
  repoUrl: string;
  forceRefresh: boolean;
  userId: string;
  planTier?: PlanTier;
  onProgress?: (message: string) => Promise<void>;
}) {
  const { supabase, repoUrl, forceRefresh, userId, planTier = "free", onProgress } = options;
  const identity = parseRepoUrl(repoUrl);

  if (!forceRefresh) {
    const { data: existing } = await supabase
      .from("generated_roadmaps")
      .select("*")
      .eq("repo_full_name", identity.fullName)
      .maybeSingle();

    if (existing) {
      return mapRoadmapRow(existing as Record<string, unknown>, true);
    }
  }

  const usageSnapshot = await resolveUsageMode(supabase, userId, planTier);
  if (usageSnapshot.mode === "critical") {
    throw new Error("Token budget is depleted. Please try again after reset.");
  }

  const generationMode = usageSnapshot.mode === "low" ? "low" : "normal";
  const commitLimit = generationMode === "low" ? 40 : 80;
  const maxOutputTokens = generationMode === "low" ? 2048 : 4096;
  const shouldReview = generationMode === "normal";

  await onProgress?.("Resolving GitHub access...");
  const githubToken = await getGitHubTokenForUser(supabase, userId);

  await onProgress?.("Fetching repository metadata...");
  const repo = await githubRequest<Record<string, unknown>>(
    `/repos/${identity.fullName}`,
    githubToken,
  );

  await onProgress?.("Collecting commit history...");
  const commits = await githubRequest<Array<Record<string, unknown>>>(
    `/repos/${identity.fullName}/commits?sha=${encodeURIComponent(String(repo.default_branch ?? "main"))}&per_page=${commitLimit}`,
    githubToken,
  );

  if (commits.length === 0) {
    throw new Error("Repository does not contain commits");
  }

  const commitsChronological = [...commits].reverse();
  const commitContextLines = commitsChronological
    .map((commit) => {
      const sha = String(commit.sha ?? "").slice(0, 7);
      const message = String((commit.commit as Record<string, unknown> | undefined)?.message ?? "").split("\n")[0];
      return `${sha}: ${message}`;
    })
    .slice(0, commitLimit);

  const stageBudget = Math.min(12, Math.max(6, Math.floor(commits.length / 20) + 6));

  const roadmapPrompt = buildRoadmapPrompt({
    repoName: identity.fullName,
    description: String(repo.description ?? ""),
    language: String(repo.language ?? ""),
    topics: Array.isArray(repo.topics) ? repo.topics.map((topic) => String(topic)) : [],
    commitsContext: commitContextLines.join("\n"),
    stageBudget,
  });

  await onProgress?.("Generating beginner roadmap...");
  const firstPassResult = await callGeminiJson({
    prompt: roadmapPrompt,
    maxOutputTokens,
    responseMimeType: "application/json",
    temperature: 0.2,
    models: GEMINI_MODELS_PLANNER,
  });

  let timelinePayload = firstPassResult.parsed.timeline;
  let totalUsage = firstPassResult.usage;

  if (shouldReview) {
    await onProgress?.("Refining roadmap quality...");
    const reviewPrompt = buildRoadmapReviewPrompt(timelinePayload);
    const secondPassResult = await callGeminiJson({
      prompt: reviewPrompt,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      temperature: 0.1,
      models: GEMINI_MODELS_REPAIR,
    });

    timelinePayload = secondPassResult.parsed.timeline;
    const reviewUsage = secondPassResult.usage;
    totalUsage = {
      promptTokens: totalUsage.promptTokens + reviewUsage.promptTokens,
      completionTokens: totalUsage.completionTokens + reviewUsage.completionTokens,
      totalTokens: totalUsage.totalTokens + reviewUsage.totalTokens,
    };
  }

  const normalizedTimeline = normalizeTimeline(
    timelinePayload,
    stageBudget,
    commitsChronological.map((commit) => ({ sha: String(commit.sha ?? "") })),
  );
  const qualityFailures = normalizedTimeline
    .filter((stage) => String(stage.id) !== "stage-setup")
    .map((stage) => {
      const pseudoNode: RoadmapSyllabusNode = {
        id: String(stage.id ?? ""),
        index: Number(stage.index ?? 0),
        title: String(stage.title ?? ""),
        summary: String(stage.summary ?? ""),
        category: String(stage.category ?? "feature"),
        difficulty: String(stage.difficulty ?? "easy"),
        goals: Array.isArray(stage.goals) ? stage.goals.map((item: unknown) => String(item)) : [],
        prerequisites: Array.isArray(stage.prerequisites)
          ? stage.prerequisites.map((item: unknown) => String(item))
          : [],
        checkpoints: Array.isArray(stage.checkpoints) ? stage.checkpoints.map((item: unknown) => String(item)) : [],
        source_themes: [],
        optional_peeks: [],
      };
      return validateHydratedStageQuality(stage, pseudoNode);
    })
    .filter((result) => !result.ok);
  if (qualityFailures.length > 0) {
    const reason = qualityFailures
      .slice(0, 2)
      .map((failure) => failure.failReasons.join(", "))
      .join(" | ");
    throw new Error(`Roadmap quality validation failed: ${reason}`);
  }

  await onProgress?.("Persisting roadmap and snapshots...");

  const commitChunksToInsert = await Promise.all(
    commitsChronological.slice(0, commitLimit).map(async (commit, idx) => {
      const sha = String(commit.sha ?? "");
      const message = String((commit.commit as Record<string, unknown> | undefined)?.message ?? "");
      const authoredAt = String(
        ((commit.commit as Record<string, unknown> | undefined)?.author as Record<string, unknown> | undefined)?.date ?? new Date().toISOString(),
      );
      const content = `${message}`;
      const hash = await sha256(`${identity.fullName}:${sha}:${content}`);

      return {
        repo_full_name: identity.fullName,
        commit_sha: sha,
        chunk_type: idx === 0 ? "initial-full" : "diff-only",
        chunk_hash: hash,
        content,
        authored_at: authoredAt,
      };
    }),
  );

  if (commitChunksToInsert.length > 0) {
    await supabase
      .from("repo_commit_chunks")
      .upsert(commitChunksToInsert, { onConflict: "chunk_hash", ignoreDuplicates: true });
  }

  const { data: existingRoadmap } = await supabase
    .from("generated_roadmaps")
    .select("view_count, sync_count, rating_count, rating_sum")
    .eq("repo_full_name", identity.fullName)
    .maybeSingle();

  const repoSummary = {
    full_name: identity.fullName,
    description: String(repo.description ?? ""),
    language: String(repo.language ?? ""),
    stars: Number(repo.stargazers_count ?? 0),
    default_branch: String(repo.default_branch ?? "main"),
    html_url: String(repo.html_url ?? `https://github.com/${identity.fullName}`),
    owner_avatar_url: String((repo.owner as Record<string, unknown> | undefined)?.avatar_url ?? ""),
    primary_language: String(repo.language ?? ""),
    languages: Array.isArray(repo.languages) ? repo.languages : null,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    difficulty: "easy",
    star_count: Number(repo.stargazers_count ?? 0),
    fork_count: Number(repo.forks_count ?? 0),
    last_pushed_at: String(repo.pushed_at ?? ""),
    license: String((repo.license as Record<string, unknown> | undefined)?.name ?? ""),
    contributor_count: 0,
    view_count: Number(existingRoadmap?.view_count ?? 0),
    sync_count: Number(existingRoadmap?.sync_count ?? 0),
    rating_count: Number(existingRoadmap?.rating_count ?? 0),
    rating_sum: Number(existingRoadmap?.rating_sum ?? 0),
  };

  const rowToStore = {
    repo_full_name: identity.fullName,
    repo_summary: repoSummary,
    timeline: normalizedTimeline,
    cached: false,
    generated_at: new Date().toISOString(),
    primary_language: repoSummary.primary_language,
    languages: repoSummary.languages,
    topics: repoSummary.topics,
    difficulty: repoSummary.difficulty,
    star_count: repoSummary.star_count,
    fork_count: repoSummary.fork_count,
    last_pushed_at: repoSummary.last_pushed_at || null,
    license: repoSummary.license || null,
    contributor_count: repoSummary.contributor_count,
    view_count: repoSummary.view_count,
    sync_count: repoSummary.sync_count,
    rating_count: repoSummary.rating_count,
    rating_sum: repoSummary.rating_sum,
    job_state: "completed",
    last_generated_stage: Math.max(normalizedTimeline.length - 1, 0),
  };

  const { data: upserted, error: upsertError } = await supabase
    .from("generated_roadmaps")
    .upsert(rowToStore, { onConflict: "repo_full_name" })
    .select("*")
    .single();

  if (upsertError) {
    throw new Error(`Failed to persist roadmap: ${upsertError.message}`);
  }

  const fallbackTokens = estimateTokenUsage(roadmapPrompt) + estimateTokenUsage(JSON.stringify(normalizedTimeline));
  const promptTokens = totalUsage.promptTokens > 0 ? totalUsage.promptTokens : estimateTokenUsage(roadmapPrompt);
  const completionTokens = totalUsage.completionTokens > 0
    ? totalUsage.completionTokens
    : Math.max(fallbackTokens - promptTokens, 0);
  const totalTokens = totalUsage.totalTokens > 0 ? totalUsage.totalTokens : fallbackTokens;

  await recordTokenUsage(supabase, {
    kind: "roadmap_generate",
    userId,
    endpoint: "/api/v1/roadmap/generate",
    promptTokens,
    completionTokens,
    totalTokens,
      metadata: {
        repo_full_name: identity.fullName,
        mode: generationMode,
        plan_tier: usageSnapshot.planTier,
        global_remaining: usageSnapshot.globalUsage.remaining,
        user_remaining: usageSnapshot.userUsage.remaining,
        stage_budget: stageBudget,
        commit_sample: commitLimit,
      },
    userDailyLimit: usageSnapshot.userUsage.daily_limit,
  });

  await supabase
    .from("user_synced_repos")
    .upsert(
      {
        user_id: userId,
        repo_full_name: identity.fullName,
        status: "synced",
        is_archived: false,
        progress_percent: 0,
      },
      { onConflict: "user_id,repo_full_name" },
    );

  return mapRoadmapRow(upserted as Record<string, unknown>, false);
}

async function handleWaitlistCount(context: RouteContext) {
  const { supabase } = context;
  const { count, error } = await supabase
    .from("waitlist")
    .select("id", { count: "exact", head: true });

  if (error) {
    return routeError(500, error.message);
  }

  return toJsonResponse({ count: count ?? 0 });
}

async function handleWaitlistJoin(context: RouteContext) {
  const { supabase, req } = context;
  const body = await readJsonBody(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 100) : "landing";

  if (!email) {
    return routeError(400, "Email is required.");
  }

  const { data, error } = await supabase
    .from("waitlist")
    .insert({ email, source: source || "landing" })
    .select("id,email,source,created_at")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return routeError(409, "This email is already on the waitlist.");
    }
    return routeError(500, error.message);
  }

  return toJsonResponse(data as JsonObject, 201);
}

async function handleUsageGlobal(context: RouteContext) {
  const usage = await getGlobalUsage(context.supabase);
  const providerStatus = await getProviderRateLimitStatus(context.supabase);
  const queueSummary = await getQueueLoadSummary(context.supabase);
  if (queueSummary.queuedJobs > 0 && !providerStatus.provider_limited) {
    triggerWorkerDrain(context, Math.min(4, Math.max(1, queueSummary.queuedJobs)));
  }
  let userUsage: UserSoftUsage | null = null;
  let planTier: PlanTier = "free";
  try {
    const auth = await getAuthContext(context.req, false);
    planTier = auth.planTier;
    if (auth.userId) {
      userUsage = await getUserSoftUsage(context.supabase, auth.userId, planTier);
    }
  } catch {
    userUsage = null;
    planTier = "free";
  }

  return toJsonResponse({
    ...usage,
    provider_limited: providerStatus.provider_limited,
    provider_limited_since: providerStatus.provider_limited_since,
    provider_retry_at: providerStatus.provider_retry_at,
    provider_reason: providerStatus.provider_reason,
    queued_jobs: queueSummary.queuedJobs,
    processing_jobs: queueSummary.processingJobs,
    user_daily_limit: userUsage?.daily_limit ?? null,
    user_used: userUsage?.used ?? null,
    user_remaining: userUsage?.remaining ?? null,
    user_reset_at: userUsage?.reset_at ?? null,
    plan_tier: userUsage ? planTier : null,
  });
}

function isAdminAuthorized(req: Request) {
  if (!ADMIN_CATALOG_SECRET) {
    return false;
  }
  const supplied = req.headers.get("x-admin-secret") ?? "";
  return supplied.length > 0 && supplied === ADMIN_CATALOG_SECRET;
}

async function handleAdminCatalogSoftReset(context: RouteContext) {
  if (!isAdminAuthorized(context.req)) {
    return routeError(401, "Unauthorized admin request.");
  }
  const body = await readJsonBody(context.req);
  const segment = typeof body.catalog_segment === "string" && body.catalog_segment.trim().length > 0
    ? body.catalog_segment.trim().slice(0, 64)
    : `reset-${new Date().toISOString().slice(0, 10)}`;
  const keepRepos = Array.isArray(body.keep_repos)
    ? body.keep_repos.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
  const keepSet = new Set(keepRepos);
  if (keepSet.size > 0) {
    const { data: visibleRows, error: visibleError } = await context.supabase
      .from("generated_roadmaps")
      .select("repo_full_name")
      .eq("is_catalog_visible", true);
    if (visibleError) {
      return routeError(500, `Soft reset failed: ${visibleError.message}`);
    }
    const toHide = (visibleRows ?? [])
      .map((row) => String(row.repo_full_name))
      .filter((name) => !keepSet.has(name));
    if (toHide.length > 0) {
      const { error: hideError } = await context.supabase
        .from("generated_roadmaps")
        .update({ is_catalog_visible: false, catalog_segment: segment })
        .in("repo_full_name", toHide);
      if (hideError) {
        return routeError(500, `Soft reset failed: ${hideError.message}`);
      }
    }
  } else {
    const { error: hideError } = await context.supabase
      .from("generated_roadmaps")
      .update({ is_catalog_visible: false, catalog_segment: segment })
      .eq("is_catalog_visible", true);
    if (hideError) {
      return routeError(500, `Soft reset failed: ${hideError.message}`);
    }
  }

  const { error: archiveError } = await context.supabase
    .from("user_synced_repos")
    .update({
      is_archived: true,
      status: "synced",
      updated_at: new Date().toISOString(),
    })
    .eq("is_archived", false);
  if (archiveError) {
    return routeError(500, `Soft reset failed: ${archiveError.message}`);
  }

  const { data: visibleRows, count: visibleCount } = await context.supabase
    .from("generated_roadmaps")
    .select("repo_full_name", { count: "exact" })
    .eq("is_catalog_visible", true);

  return toJsonResponse({
    ok: true,
    catalog_segment: segment,
    remaining_visible: Number(visibleCount ?? visibleRows?.length ?? 0),
  });
}

async function handleAdminCatalogHideRepo(context: RouteContext) {
  if (!isAdminAuthorized(context.req)) {
    return routeError(401, "Unauthorized admin request.");
  }
  const body = await readJsonBody(context.req);
  const repoFullName = typeof body.repo_full_name === "string" ? body.repo_full_name.trim() : "";
  if (!repoFullName) {
    return routeError(400, "repo_full_name is required", "missing_repo_full_name");
  }
  const segment = typeof body.catalog_segment === "string" && body.catalog_segment.trim().length > 0
    ? body.catalog_segment.trim().slice(0, 64)
    : `hidden-${new Date().toISOString().slice(0, 10)}`;

  const { data: existing, error: lookupError } = await context.supabase
    .from("generated_roadmaps")
    .select("repo_full_name,is_catalog_visible,catalog_segment")
    .eq("repo_full_name", repoFullName)
    .maybeSingle();
  if (lookupError) {
    return routeError(500, lookupError.message, "hide_repo_lookup_failed");
  }
  if (!existing) {
    return routeError(404, "Roadmap not found", "roadmap_not_found");
  }

  const { error: updateError } = await context.supabase
    .from("generated_roadmaps")
    .update({
      is_catalog_visible: false,
      catalog_segment: segment,
      updated_at: new Date().toISOString(),
    })
    .eq("repo_full_name", repoFullName);
  if (updateError) {
    return routeError(500, updateError.message, "hide_repo_failed");
  }

  return toJsonResponse({
    ok: true,
    repo_full_name: repoFullName,
    is_catalog_visible: false,
    catalog_segment: segment,
  });
}

async function handleFlagStageForRegeneration(context: AuthedRouteContext, stageId: string) {
  const body = await readJsonBody(context.req);
  const repoFullName = typeof body.repo_full_name === "string" ? body.repo_full_name.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const stageSourceHash = typeof body.stage_source_hash === "string" ? body.stage_source_hash.trim() : null;

  if (!repoFullName) {
    return routeError(400, "repo_full_name is required", "missing_repo_full_name");
  }
  if (!reason || reason.length < 12) {
    return routeError(400, "Please provide a detailed reason for regeneration.", "invalid_reason");
  }

  const { data: roadmapRow, error: roadmapError } = await context.supabase
    .from("generated_roadmaps")
    .select("timeline,is_catalog_visible")
    .eq("repo_full_name", repoFullName)
    .maybeSingle();
  if (roadmapError) {
    return routeError(500, roadmapError.message, "roadmap_lookup_failed");
  }
  if (!roadmapRow) {
    return routeError(404, "Roadmap not found", "roadmap_not_found");
  }

  const timeline = Array.isArray(roadmapRow.timeline)
    ? (roadmapRow.timeline as Array<Record<string, unknown>>)
    : [];
  const stage = timeline.find((item) => String(item.id ?? "") === stageId);
  if (!stage) {
    return routeError(404, "Stage not found in roadmap", "stage_not_found");
  }
  const computedHash = buildStageSourceHash(stage);
  if (stageSourceHash && stageSourceHash.length > 0 && stageSourceHash !== computedHash) {
    return routeError(409, "Stage content changed. Refresh and retry flagging.", "stage_source_mismatch");
  }

  const { data, error } = await context.supabase
    .from("roadmap_stage_regen_flags")
    .insert({
      repo_full_name: repoFullName,
      stage_id: stageId,
      requested_by: context.userId,
      status: "pending",
      reason: reason.slice(0, 2000),
      stage_source_hash: stageSourceHash || computedHash,
    })
    .select("*")
    .single();
  if (error) {
    return routeError(500, error.message, "stage_regen_flag_create_failed");
  }

  return toJsonResponse({
    ok: true,
    flag: data,
  }, 201);
}

async function handleAdminListStageRegenFlags(context: RouteContext) {
  if (!isAdminAuthorized(context.req)) {
    return routeError(401, "Unauthorized admin request.");
  }
  const statusFilter = (context.url.searchParams.get("status") ?? "").trim();
  const limit = Math.max(1, Math.min(200, Number(context.url.searchParams.get("limit") ?? "50")));
  const offset = Math.max(0, Number(context.url.searchParams.get("offset") ?? "0"));

  let query = context.supabase
    .from("roadmap_stage_regen_flags")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  const { data, error } = await query;
  if (error) {
    return routeError(500, error.message, "stage_regen_flag_list_failed");
  }
  return toJsonResponse({
    items: data ?? [],
    limit,
    offset,
  });
}

async function handleAdminApproveStageRegenFlag(context: RouteContext, flagId: string) {
  if (!isAdminAuthorized(context.req)) {
    return routeError(401, "Unauthorized admin request.");
  }
  const body = await readJsonBody(context.req);
  const regenerateNow = Boolean(body.regenerate_now);
  const adminActor = (context.req.headers.get("x-admin-user") ?? "admin").trim().slice(0, 200);
  const adminNote = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "Approved";

  const { data: flagRow, error: flagError } = await context.supabase
    .from("roadmap_stage_regen_flags")
    .select("*")
    .eq("id", flagId)
    .maybeSingle();
  if (flagError || !flagRow) {
    return routeError(404, flagError?.message ?? "Stage regeneration flag not found", "stage_regen_flag_not_found");
  }

  const nextStatus: StageRegenerationFlagStatus = regenerateNow ? "processing" : "approved";
  const { data: updatedRow, error: updateError } = await context.supabase
    .from("roadmap_stage_regen_flags")
    .update({
      status: nextStatus,
      admin_decision_by: adminActor,
      admin_note: adminNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", flagId)
    .select("*")
    .single();
  if (updateError || !updatedRow) {
    return routeError(500, updateError?.message ?? "Failed to update regeneration flag", "stage_regen_flag_update_failed");
  }

  if (regenerateNow) {
    await enqueueRoadmapTask(context.supabase, {
      type: "regenerate_stage",
      flag_id: flagId,
      repo_full_name: String(updatedRow.repo_full_name ?? ""),
      stage_id: String(updatedRow.stage_id ?? ""),
      user_id: String(updatedRow.requested_by ?? ""),
    });
    triggerWorkerDrain(context, 1);
  }

  return toJsonResponse({
    ok: true,
    flag: updatedRow,
  });
}

async function handleAdminRejectStageRegenFlag(context: RouteContext, flagId: string) {
  if (!isAdminAuthorized(context.req)) {
    return routeError(401, "Unauthorized admin request.");
  }
  const body = await readJsonBody(context.req);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "Rejected by admin.";
  const adminActor = (context.req.headers.get("x-admin-user") ?? "admin").trim().slice(0, 200);

  const { data: updatedRow, error } = await context.supabase
    .from("roadmap_stage_regen_flags")
    .update({
      status: "rejected",
      admin_decision_by: adminActor,
      admin_note: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", flagId)
    .select("*")
    .single();
  if (error || !updatedRow) {
    return routeError(500, error?.message ?? "Failed to reject regeneration flag", "stage_regen_flag_reject_failed");
  }

  return toJsonResponse({
    ok: true,
    flag: updatedRow,
  });
}

async function handleGetPreferences(context: AuthedRouteContext) {
  const { data, error } = await context.supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error) {
    return routeError(500, error.message);
  }

  const payload = {
    theme: String(data?.theme ?? "system"),
    language: String(data?.language ?? "en"),
    updated_at: data?.updated_at ?? null,
  };
  return toJsonResponse(payload as unknown as JsonObject);
}

async function handleUpsertPreferences(context: AuthedRouteContext) {
  const body = await readJsonBody(context.req);
  const theme = typeof body.theme === "string" ? body.theme.trim().toLowerCase() : "system";
  const language = typeof body.language === "string" ? body.language.trim() : "en";
  const allowedThemes = new Set(["system", "light", "dark"]);
  const allowedLanguages = new Set(["en", "zh-HK", "kz", "ru"]);
  if (!allowedThemes.has(theme)) {
    return routeError(400, "Invalid theme value.");
  }
  if (!allowedLanguages.has(language)) {
    return routeError(400, "Invalid language value.");
  }

  const { data, error } = await context.supabase
    .from("user_preferences")
    .upsert({
      user_id: context.userId,
      theme,
      language,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    return routeError(500, error.message);
  }

  return toJsonResponse({
    theme: data.theme,
    language: data.language,
    updated_at: data.updated_at,
  } as unknown as JsonObject);
}

async function handleCatalog(context: RouteContext) {
  const { supabase, url } = context;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("page_size") ?? "20")));
  const language = (url.searchParams.get("language") ?? "").trim();
  const tag = (url.searchParams.get("tag") ?? "").trim();
  const difficulty = (url.searchParams.get("difficulty") ?? "").trim();
  const minRating = Number(url.searchParams.get("min_rating") ?? "0");
  const minViews = Number(url.searchParams.get("min_views") ?? "0");
  const minSyncs = Number(url.searchParams.get("min_syncs") ?? "0");
  const sort = (url.searchParams.get("sort") ?? "newest").trim();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("generated_roadmaps").select("*", { count: "exact" }).eq("is_catalog_visible", true);

  if (language) {
    query = query.ilike("primary_language", language);
  }
  if (tag) {
    query = query.contains("topics", [tag]);
  }
  if (difficulty) {
    query = query.eq("difficulty", difficulty);
  }
  if (Number.isFinite(minViews) && minViews > 0) {
    query = query.gte("view_count", minViews);
  }
  if (Number.isFinite(minSyncs) && minSyncs > 0) {
    query = query.gte("sync_count", minSyncs);
  }

  switch (sort) {
    case "most_viewed":
      query = query.order("view_count", { ascending: false });
      break;
    case "most_synced":
      query = query.order("sync_count", { ascending: false });
      break;
    case "highest_rated":
      query = query.order("rating_sum", { ascending: false });
      break;
    case "trending":
      query = query.order("sync_count", { ascending: false }).order("view_count", { ascending: false });
      break;
    default:
      query = query.order("generated_at", { ascending: false });
      break;
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    return routeError(500, error.message);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const qualityVisibleRows = rows.filter((row) => {
    const jobState = String(row.job_state ?? "completed");
    if (jobState === "completed") {
      return true;
    }
    if (jobState !== "partial_ready") {
      return false;
    }
    const stageCount = Array.isArray(row.timeline) ? row.timeline.length : 0;
    const hasQuality = row.timeline_quality && typeof row.timeline_quality === "object";
    return stageCount >= 5 && Boolean(hasQuality);
  });
  const filteredRows = Number.isFinite(minRating) && minRating > 0
    ? qualityVisibleRows.filter((row) => {
      const ratingCount = Number(row.rating_count ?? 0);
      const ratingSum = Number(row.rating_sum ?? 0);
      if (ratingCount <= 0) {
        return false;
      }
      return ratingSum / ratingCount >= minRating;
    })
    : qualityVisibleRows;

  return toJsonResponse(toCatalogResponse(filteredRows, page, pageSize, count ?? filteredRows.length) as unknown as JsonObject);
}

async function handleGetCachedRoadmap(context: RouteContext, owner: string, repo: string) {
  const fullName = `${owner}/${repo}`;
  const { data, error } = await context.supabase
    .from("generated_roadmaps")
    .select("*")
    .eq("repo_full_name", fullName)
    .maybeSingle();

  if (error) {
    return routeError(500, error.message);
  }

  if (!data) {
    return routeError(404, "Timeline has not been generated for this repository.");
  }

  if (data.is_catalog_visible === false) {
    let userId: string | null = null;
    try {
      userId = await getAuthedUserId(context.req, false);
    } catch {
      userId = null;
    }
    if (!userId) {
      return routeError(404, "Timeline has not been generated for this repository.");
    }
    const { data: syncedRow, error: syncedError } = await context.supabase
      .from("user_synced_repos")
      .select("repo_full_name,is_archived")
      .eq("user_id", userId)
      .eq("repo_full_name", fullName)
      .maybeSingle();
    if (syncedError) {
      return routeError(500, syncedError.message);
    }
    if (!syncedRow || Boolean(syncedRow.is_archived)) {
      return routeError(404, "Timeline has not been generated for this repository.");
    }
  }

  return toJsonResponse(mapRoadmapRow(data as Record<string, unknown>) as unknown as JsonObject);
}

async function handleGenerateRoadmap(context: AuthedRouteContext) {
  const body = await readJsonBody(context.req);
  const repoUrl = typeof body.repo_url === "string" ? body.repo_url : "";
  const forceRefresh = Boolean(body.force_refresh);

  if (!repoUrl) {
    return routeError(400, "repo_url is required");
  }

  try {
    const result = await generateRoadmapInternal({
      supabase: context.supabase,
      repoUrl,
      forceRefresh,
      userId: context.userId,
      planTier: context.planTier,
    });
    return toJsonResponse(result as unknown as JsonObject);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Roadmap generation failed";
    if (message.includes("Token budget is depleted")) {
      return routeError(429, message);
    }
    if (message.includes("Connect GitHub")) {
      return routeError(403, message);
    }
    return routeError(502, message);
  }
}

async function handleGenerateRoadmapStream(context: AuthedRouteContext) {
  const repoUrl = context.url.searchParams.get("repo_url") ?? "";
  const forceRefresh = context.url.searchParams.get("force_refresh") === "true";

  if (!repoUrl) {
    return routeError(400, "repo_url is required");
  }

  const stream = new ReadableStream({
    start: async (controller) => {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        send({ type: "progress", message: "Connecting to GitHub..." });
        const result = await generateRoadmapInternal({
          supabase: context.supabase,
          repoUrl,
          forceRefresh,
          userId: context.userId,
          planTier: context.planTier,
          onProgress: async (message) => send({ type: "progress", message }),
        });
        send({ type: "result", data: result });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Generation failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function _buildRoadmapChunkPrompt(options: {
  repoName: string;
  description: string;
  language: string;
  topics: string[];
  commitsContext: string;
  stageStart: number;
  stageEnd: number;
  existingTitles: string[];
}) {
  const {
    repoName,
    description,
    language,
    topics,
    commitsContext,
    stageStart,
    stageEnd,
    existingTitles,
  } = options;
  const chunkCount = Math.max(stageEnd - stageStart + 1, 1);
  const existingLabel = existingTitles.length > 0
    ? existingTitles.map((title, idx) => `stage-${idx + 1}: ${title}`).join("\n")
    : "none";

  return `You are Commitly, an expert engineering mentor creating STRICT beginner roadmap chunks.

Repository: ${repoName}
Description: ${description || "N/A"}
Language: ${language || "Unknown"}
Topics: ${topics.join(", ") || "None"}
Already generated stages:
${existingLabel}

Commit context (oldest to newest):
${commitsContext}

TASK
Generate exactly ${chunkCount} NEW beginner-friendly stages for stage numbers ${stageStart}-${stageEnd}.
Do not repeat previously generated stages.

HARD REQUIREMENTS
1) Never tell the learner to clone/copy this repository.
2) Keep each stage concrete and practical.
3) Each stage must include:
- 1-3 goals
- 3-6 tasks
- explicit prerequisites/checkpoints where needed
4) Every task must use this schema:
{
  "label": "Task title",
  "steps": ["step 1", "step 2"],
  "files": ["path/file.ts"],
  "commands": ["npm run dev"]
}
5) Status must always be "not-started".

Return ONLY JSON:
{
  "timeline": [
    {
      "id": "stage-${stageStart}",
      "index": ${stageStart},
      "title": "...",
      "summary": "...",
      "status": "not-started",
      "eta": "45m",
      "category": "setup|feature|refactor|testing|ops|perf|docs|style|chore|other",
      "difficulty": "intro|easy|medium|hard",
      "goals": ["..."],
      "prerequisites": ["..."],
      "checkpoints": ["..."],
      "tasks": [{"label":"...","steps":["..."],"files":["..."],"commands":["..."]}],
      "code_examples": [{"file":"...","language":"...","description":"...","snippet":"..."}],
      "resources": [{"label":"...","href":"..."}],
      "commit_window": ["sha1","sha2"]
    }
  ]
}`;
}

function _normalizeTimelineChunk(
  timelineRaw: unknown,
  chunkSize: number,
  commits: Array<{ sha: string }>,
  stageOffset: number,
) {
  const normalized = normalizeTimeline(timelineRaw, chunkSize, commits).filter((stage) => stage.id !== "stage-setup");
  return normalized.map((stage, idx) => ({
    ...stage,
    id: `stage-${stageOffset + idx + 1}`,
    index: stageOffset + idx + 1,
  }));
}

function mapRepoSummaryToRoadmapRow(repoSummary: Record<string, unknown>) {
  return {
    primary_language: String(repoSummary.primary_language ?? repoSummary.language ?? ""),
    languages: Array.isArray(repoSummary.languages) ? repoSummary.languages : null,
    topics: Array.isArray(repoSummary.topics) ? repoSummary.topics : [],
    difficulty: String(repoSummary.difficulty ?? "easy"),
    star_count: Number(repoSummary.star_count ?? repoSummary.stars ?? 0),
    fork_count: Number(repoSummary.fork_count ?? 0),
    last_pushed_at: String(repoSummary.last_pushed_at ?? "") || null,
    license: String(repoSummary.license ?? "") || null,
    contributor_count: Number(repoSummary.contributor_count ?? 0),
    view_count: Number(repoSummary.view_count ?? 0),
    sync_count: Number(repoSummary.sync_count ?? 0),
    rating_count: Number(repoSummary.rating_count ?? 0),
    rating_sum: Number(repoSummary.rating_sum ?? 0),
  };
}

async function upsertProgressiveRoadmapRow(options: {
  supabase: SupabaseClient;
  repoFullName: string;
  repoSummary: Record<string, unknown>;
  timeline: Record<string, unknown>[];
  jobState: RoadmapGenerationJobStatus;
  lastGeneratedStage: number;
  timelineQuality?: {
    novelty_score: number;
    grounding_score: number;
    anti_template_pass: boolean;
    evaluated_at: string;
  };
}) {
  const { supabase, repoFullName, repoSummary, timeline, jobState, lastGeneratedStage, timelineQuality } = options;
  const mapped = mapRepoSummaryToRoadmapRow(repoSummary);
  const rowToStore = {
    repo_full_name: repoFullName,
    repo_summary: repoSummary,
    timeline,
    cached: false,
    generated_at: new Date().toISOString(),
    primary_language: mapped.primary_language,
    languages: mapped.languages,
    topics: mapped.topics,
    difficulty: mapped.difficulty,
    star_count: mapped.star_count,
    fork_count: mapped.fork_count,
    last_pushed_at: mapped.last_pushed_at,
    license: mapped.license,
    contributor_count: mapped.contributor_count,
    view_count: mapped.view_count,
    sync_count: mapped.sync_count,
    rating_count: mapped.rating_count,
    rating_sum: mapped.rating_sum,
    job_state: jobState,
    last_generated_stage: lastGeneratedStage,
    timeline_quality: timelineQuality ?? null,
    is_catalog_visible: true,
    catalog_segment: "default",
  };

  const { data, error } = await supabase
    .from("generated_roadmaps")
    .upsert(rowToStore, { onConflict: "repo_full_name" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to persist progressive roadmap: ${error.message}`);
  }

  return data as Record<string, unknown>;
}

async function getSyllabusNodesById(supabase: SupabaseClient, syllabusId: string) {
  const { data } = await supabase
    .from("roadmap_syllabus_nodes")
    .select("*")
    .eq("syllabus_id", syllabusId)
    .order("stage_index", { ascending: true });

  return (data ?? []).map((row) => ({
    id: String(row.stage_id ?? `stage-${row.stage_index}`),
    index: Number(row.stage_index ?? 0),
    title: String(row.title ?? `Stage ${row.stage_index}`),
    summary: String(row.summary ?? ""),
    category: String(row.category ?? "feature"),
    difficulty: String(row.difficulty ?? "easy"),
    goals: Array.isArray(row.goals) ? row.goals.map((item: unknown) => String(item)) : [],
    prerequisites: Array.isArray(row.prerequisites) ? row.prerequisites.map((item: unknown) => String(item)) : [],
    checkpoints: Array.isArray(row.checkpoints) ? row.checkpoints.map((item: unknown) => String(item)) : [],
    source_themes: Array.isArray(row.source_themes) ? row.source_themes.map((item: unknown) => String(item)) : [],
    optional_peeks: Array.isArray(row.optional_peeks) ? row.optional_peeks.map((item: unknown) => String(item)) : [],
  })) as RoadmapSyllabusNode[];
}

async function persistSyllabus(options: {
  supabase: SupabaseClient;
  ingest: RepoIngestSnapshot;
  forceRefresh: boolean;
}) {
  const { supabase, ingest, forceRefresh } = options;

  if (!forceRefresh) {
    const { data: existing } = await supabase
      .from("roadmap_syllabi")
      .select("*")
      .eq("snapshot_key", ingest.snapshotKey)
      .eq("pipeline_version", CURRICULUM_PIPELINE_VERSION)
      .maybeSingle();
    if (existing) {
      const nodes = await getSyllabusNodesById(supabase, String(existing.id));
      if (nodes.length > 0) {
        return {
          syllabusId: String(existing.id),
          nodes,
          stageTarget: Number(existing.stage_target ?? nodes.length),
          logicalStageTarget: Number(existing.logical_stage_target ?? nodes.length),
        };
      }
    }
  }

  const stageTarget = ingest.stageTarget;
  const syllabusPrompt = buildSyllabusPrompt({
    repoName: String(ingest.repoSummary.full_name ?? ""),
    description: String(ingest.repoSummary.description ?? ""),
    language: String(ingest.repoSummary.language ?? ""),
    topics: Array.isArray(ingest.repoSummary.topics)
      ? ingest.repoSummary.topics.map((topic) => String(topic))
      : [],
    readmeExcerpt: ingest.readmeExcerpt,
    treeStats: ingest.treeStats,
    commitClusters: ingest.commitClusters,
    stageTarget,
    logicalStageTarget: ingest.logicalStageTarget,
    mode: ingest.complexity.mode,
  });

  const syllabusResult = await callGeminiJson({
    prompt: syllabusPrompt,
    maxOutputTokens: ingest.complexity.mode === "multi_track" ? 3400 : 2600,
    responseMimeType: "application/json",
    temperature: 0.2,
    models: GEMINI_MODELS_PLANNER,
  });

  let nodes: RoadmapSyllabusNode[] = [];
  try {
    nodes = normalizeSyllabusNodes(
      syllabusResult.parsed.syllabus,
      stageTarget,
      ingest.commitClusters,
    );
  } catch (error) {
    let failureReason = error instanceof Error ? error.message : "Unknown syllabus normalization failure";
    const repairPrompt = buildSyllabusRepairPrompt({
      repoName: String(ingest.repoSummary.full_name ?? ""),
      readmeExcerpt: ingest.readmeExcerpt,
      commitClusters: ingest.commitClusters,
      stageTarget,
      failureReason,
      previousSyllabus: syllabusResult.parsed.syllabus,
    });
    for (const model of GEMINI_MODELS_REPAIR) {
      try {
        const repairResult = await callGeminiJson({
          prompt: repairPrompt,
          maxOutputTokens: ingest.complexity.mode === "multi_track" ? 3600 : 2800,
          responseMimeType: "application/json",
          temperature: 0.1,
          models: [model],
          retries: 1,
        });
        nodes = normalizeSyllabusNodes(
          repairResult.parsed.syllabus,
          stageTarget,
          ingest.commitClusters,
        );
        break;
      } catch (repairError) {
        failureReason = repairError instanceof Error ? repairError.message : String(repairError);
      }
    }
    if (nodes.length === 0) {
      throw new Error(`Syllabus quality failed after repair retries. ${failureReason}`);
    }
  }

  const { data: syllabusRow, error: syllabusError } = await supabase
    .from("roadmap_syllabi")
    .upsert({
      snapshot_key: ingest.snapshotKey,
      repo_full_name: String(ingest.repoSummary.full_name ?? ""),
      pipeline_version: CURRICULUM_PIPELINE_VERSION,
      stage_target: stageTarget,
      logical_stage_target: ingest.logicalStageTarget,
      complexity_score: ingest.complexity.score,
      curriculum_mode: ingest.complexity.mode,
      syllabus: nodes,
    }, { onConflict: "snapshot_key,pipeline_version" })
    .select("*")
    .single();

  if (syllabusError || !syllabusRow) {
    throw new Error(syllabusError?.message ?? "Failed to persist syllabus");
  }

  await supabase
    .from("roadmap_syllabus_nodes")
    .delete()
    .eq("syllabus_id", syllabusRow.id);

  await supabase
    .from("roadmap_syllabus_nodes")
    .insert(nodes.map((node) => ({
      syllabus_id: syllabusRow.id,
      stage_id: node.id,
      stage_index: node.index,
      title: node.title,
      summary: node.summary,
      category: node.category,
      difficulty: node.difficulty,
      goals: node.goals,
      prerequisites: node.prerequisites,
      checkpoints: node.checkpoints,
      source_themes: node.source_themes,
      optional_peeks: node.optional_peeks,
    })));

  return {
    syllabusId: String(syllabusRow.id),
    nodes,
    stageTarget,
    logicalStageTarget: ingest.logicalStageTarget,
  };
}

function mergeSyllabusNodeIntoStage(stage: Record<string, unknown>, node: RoadmapSyllabusNode) {
  return {
    ...stage,
    id: node.id,
    index: node.index,
    title: node.title,
    summary: String(stage.summary ?? node.summary ?? ""),
    category: String(stage.category ?? node.category),
    difficulty: String(stage.difficulty ?? node.difficulty),
    goals: Array.isArray(stage.goals) && stage.goals.length > 0 ? stage.goals : node.goals,
    prerequisites: Array.isArray(stage.prerequisites) && stage.prerequisites.length > 0
      ? stage.prerequisites
      : node.prerequisites,
    checkpoints: Array.isArray(stage.checkpoints) && stage.checkpoints.length > 0
      ? stage.checkpoints
      : node.checkpoints,
    optional_peeks: Array.isArray(stage.optional_peeks) && stage.optional_peeks.length > 0
      ? stage.optional_peeks
      : node.optional_peeks,
  };
}

function pickRelevantHotPaths(
  node: RoadmapSyllabusNode,
  hotPaths: string[],
  featureKeywords: string[],
) {
  const nodeTokens = new Set(toComparableTokens(
    `${node.title} ${node.summary} ${node.goals.join(" ")} ${node.checkpoints.join(" ")}`,
  ));
  const keywordHints = featureKeywords.slice(0, 10);
  const scored = hotPaths.map((path) => {
    const pathTokens = new Set(toComparableTokens(path));
    let score = 0;
    for (const token of pathTokens) {
      if (nodeTokens.has(token)) {
        score += 2;
      }
      if (keywordHints.some((keyword) => token.includes(keyword) || keyword.includes(token))) {
        score += 1;
      }
    }
    return { path, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .filter((item, idx) => item.score > 0 || idx < 3)
    .slice(0, 8)
    .map((item) => item.path);
}

function buildStageEvidenceRefs(options: {
  nodes: RoadmapSyllabusNode[];
  commitClusters: RepoIngestSnapshot["commitClusters"];
  treeStats: RepoIngestSnapshot["treeStats"];
  readmeExcerpt: string;
}) {
  const archetype = options.treeStats.archetype;
  const readmeHints = options.readmeExcerpt
    .split("\n")
    .filter((line) => /^#{1,4}\s/.test(line.trim()))
    .map((line) => line.replace(/^#{1,4}\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 12);

  return options.nodes.map((node) => {
    const nodeThemes = node.source_themes.length > 0 ? node.source_themes : ["product-iterations"];
    const relatedClusterSamples = options.commitClusters
      .filter((cluster) => nodeThemes.some((theme) => cluster.theme.includes(theme) || theme.includes(cluster.theme)))
      .flatMap((cluster) => cluster.samples)
      .slice(0, 8);

    return {
      stage_id: node.id,
      objective: node.summary || node.title,
      themes: nodeThemes.slice(0, 6),
      hot_paths: pickRelevantHotPaths(node, options.treeStats.hotPaths, options.treeStats.featureKeywords),
      feature_keywords: options.treeStats.featureKeywords.slice(0, 16),
      readme_hints: [...readmeHints.slice(0, 6), ...relatedClusterSamples.slice(0, 4)].slice(0, 10),
      api_concepts: options.treeStats.apiConcepts.slice(0, 14),
      archetype,
    } as StageEvidenceRef;
  });
}

async function getOrCreateProgressiveJob(
  context: AuthedRouteContext,
  repoUrl: string,
  forceRefresh: boolean,
  options?: { quickStart?: boolean },
) {
  const identity = parseRepoUrl(repoUrl);
  const { supabase, userId } = context;
  const quickStart = Boolean(options?.quickStart);

  if (!forceRefresh) {
    const { data: existingJob } = await supabase
      .from("roadmap_generation_jobs")
      .select("*")
      .eq("user_id", userId)
      .eq("repo_full_name", identity.fullName)
      .in("status", ["queued", "running", "partial_ready"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJob) {
      return existingJob as Record<string, unknown>;
    }
  }

  const usageSnapshot = await resolveUsageMode(supabase, userId, context.planTier);
  if (usageSnapshot.mode === "critical") {
    throw new Error("Token budget is depleted. Please try again after reset.");
  }

  if (quickStart) {
    const { data: createdJob, error: createError } = await supabase
      .from("roadmap_generation_jobs")
      .insert({
        user_id: userId,
        repo_full_name: identity.fullName,
        repo_url: repoUrl,
        status: "queued",
        generated_stages: 0,
        total_planned_stages: 0,
        stage_budget: 0,
        mode: usageSnapshot.mode,
        initial_timeline: [],
        repo_summary: {
          full_name: identity.fullName,
          html_url: `https://github.com/${identity.fullName}`,
        },
        commit_context: [],
        last_error: null,
        quality_gate_status: "pass",
        quality_fail_reasons: [],
        failed_stage_ids: [],
        dedupe_score: 0,
        grounding_score: 0,
        progress_percent: computeProgressPercent(0, 1, "ingest"),
        current_phase: "ingest",
        phase_message: "Queued. Preparing ingest artifacts...",
        queue_state: "queued",
        worker_attempts: 0,
        last_worker_at: null,
      })
      .select("*")
      .single();

    if (createError || !createdJob) {
      throw new Error(createError?.message ?? "Failed to initialize roadmap generation job");
    }

    return createdJob as Record<string, unknown>;
  }

  const githubToken = await getGitHubTokenForUser(supabase, userId);
  const ingest = await collectRepoIngestSnapshot({
    supabase,
    identity,
    githubToken,
    usageMode: usageSnapshot.mode,
  });
  const syllabus = await persistSyllabus({
    supabase,
    ingest,
    forceRefresh,
  });

  const setupStage = normalizeTimeline([], 0, ingest.commitContextLines.map((line) => ({ sha: line.split(":")[0] ?? "" })));
  const { data: existingRoadmap } = await supabase
    .from("generated_roadmaps")
    .select("*")
    .eq("repo_full_name", identity.fullName)
    .maybeSingle();

  const existingTimeline = existingRoadmap && Array.isArray(existingRoadmap.timeline)
    ? (existingRoadmap.timeline as Record<string, unknown>[])
    : null;
  const existingGeneratedStages = existingRoadmap
    ? Math.max(0, Number(existingRoadmap.last_generated_stage ?? (existingTimeline ? Math.max(existingTimeline.length - 1, 0) : 0)))
    : 0;
  const resumeFromPartial = Boolean(
    existingRoadmap &&
      existingRoadmap.job_state === "partial_ready" &&
      existingTimeline &&
      existingTimeline.length > 0 &&
      !forceRefresh,
  );

  const repoSummary = {
    ...ingest.repoSummary,
    view_count: Number(existingRoadmap?.view_count ?? 0),
    sync_count: Number(existingRoadmap?.sync_count ?? 0),
    rating_count: Number(existingRoadmap?.rating_count ?? 0),
    rating_sum: Number(existingRoadmap?.rating_sum ?? 0),
    ingest_snapshot_key: ingest.snapshotKey,
    syllabus_id: syllabus.syllabusId,
    logical_stage_target: syllabus.logicalStageTarget,
    curriculum_mode: ingest.complexity.mode,
  };

  const initialTimeline = resumeFromPartial
    ? (existingTimeline as Record<string, unknown>[])
    : setupStage;
  const generatedStages = resumeFromPartial ? existingGeneratedStages : 0;
  const initialStatus: RoadmapGenerationJobStatus = generatedStages >= syllabus.stageTarget
    ? "completed"
    : generatedStages > 0
      ? "partial_ready"
      : "queued";

  const { data: createdJob, error: createError } = await supabase
    .from("roadmap_generation_jobs")
    .insert({
      user_id: userId,
      repo_full_name: identity.fullName,
      repo_url: repoUrl,
      status: initialStatus,
      generated_stages: generatedStages,
      total_planned_stages: syllabus.stageTarget,
      stage_budget: syllabus.stageTarget,
      mode: usageSnapshot.mode,
      initial_timeline: initialTimeline,
      repo_summary: repoSummary,
      commit_context: ingest.commitContextLines,
      last_error: null,
      quality_gate_status: "pass",
      quality_fail_reasons: [],
      failed_stage_ids: [],
      dedupe_score: 0,
      grounding_score: 0,
      progress_percent: initialStatus === "completed" ? 100 : computeProgressPercent(generatedStages, syllabus.stageTarget, "syllabus"),
      current_phase: initialStatus === "completed" ? "complete" : "syllabus",
      phase_message: initialStatus === "completed" ? "Generation complete." : "Syllabus compiled. Ready to hydrate stages.",
      queue_state: initialStatus === "completed" ? "idle" : "queued",
      worker_attempts: 0,
      last_worker_at: null,
    })
    .select("*")
    .single();

  if (createError || !createdJob) {
    throw new Error(createError?.message ?? "Failed to initialize roadmap generation job");
  }

  return createdJob as Record<string, unknown>;
}

async function bootstrapProgressiveJob(
  context: AuthedRouteContext,
  jobRow: Record<string, unknown>,
  usageMode: "normal" | "low" | "critical",
) {
  const { supabase, userId } = context;
  const repoUrl = typeof jobRow.repo_url === "string" && jobRow.repo_url.trim().length > 0
    ? String(jobRow.repo_url)
    : `https://github.com/${String(jobRow.repo_full_name ?? "")}`;
  const identity = parseRepoUrl(repoUrl);

  await updateGenerationJobPhase(supabase, String(jobRow.id), {
    phase: "ingest",
    status: "running",
    generatedStages: 0,
    totalStages: 1,
    message: "Collecting repository context...",
    lastError: null,
    queueState: "processing",
  });

  const githubToken = await getGitHubTokenForUser(supabase, userId);
  const ingest = await collectRepoIngestSnapshot({
    supabase,
    identity,
    githubToken,
    usageMode,
  });
  const syllabus = await persistSyllabus({
    supabase,
    ingest,
    forceRefresh: false,
  });
  const setupStage = normalizeTimeline(
    [],
    0,
    ingest.commitContextLines.map((line) => ({ sha: line.split(":")[0] ?? "" })),
  );

  const { data: existingRoadmap } = await supabase
    .from("generated_roadmaps")
    .select("*")
    .eq("repo_full_name", identity.fullName)
    .maybeSingle();

  const repoSummary = {
    ...ingest.repoSummary,
    view_count: Number(existingRoadmap?.view_count ?? 0),
    sync_count: Number(existingRoadmap?.sync_count ?? 0),
    rating_count: Number(existingRoadmap?.rating_count ?? 0),
    rating_sum: Number(existingRoadmap?.rating_sum ?? 0),
    ingest_snapshot_key: ingest.snapshotKey,
    syllabus_id: syllabus.syllabusId,
    logical_stage_target: syllabus.logicalStageTarget,
    curriculum_mode: ingest.complexity.mode,
  };

  const { data: updated, error: updateError } = await supabase
    .from("roadmap_generation_jobs")
    .update({
      repo_url: repoUrl,
      status: "queued",
      generated_stages: 0,
      total_planned_stages: syllabus.stageTarget,
      stage_budget: syllabus.stageTarget,
      mode: usageMode,
      initial_timeline: setupStage,
      repo_summary: repoSummary,
      commit_context: ingest.commitContextLines,
      last_error: null,
      quality_gate_status: "pass",
      quality_fail_reasons: [],
      failed_stage_ids: [],
      dedupe_score: 0,
      grounding_score: 0,
      progress_percent: computeProgressPercent(0, syllabus.stageTarget, "syllabus"),
      current_phase: "syllabus",
      phase_message: "Syllabus compiled. Ready to hydrate stages.",
      queue_state: "queued",
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(jobRow.id))
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Failed to bootstrap generation job");
  }

  return updated as Record<string, unknown>;
}

async function runProgressiveGenerationChunk(context: AuthedRouteContext, jobId: string, chunkSize: number) {
  const { supabase, userId } = context;
  const { data, error: jobError } = await supabase
    .from("roadmap_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (jobError) {
    throw new Error(jobError.message);
  }
  if (!data) {
    throw new Error("Roadmap generation job not found");
  }
  let jobRow = data as Record<string, unknown>;

  const status = String(jobRow.status ?? "queued") as RoadmapGenerationJobStatus;
  if (status === "completed") {
    const generated = Number(jobRow.generated_stages ?? 0);
    const total = Number(jobRow.total_planned_stages ?? Math.max(generated, 1));
    const failedStageReports = await getFailedStageReports(supabase, jobId);
    const qualityGateMetrics = await getLatestQualityGateMetrics(supabase, jobId, {
      dedupeScore: Number(jobRow.dedupe_score ?? 0),
      groundingScore: Number(jobRow.grounding_score ?? 0),
    });
    return {
      status,
      generated_stages: generated,
      total_planned_stages: total,
      timeline: Array.isArray(jobRow.initial_timeline) ? jobRow.initial_timeline : [],
      repo_full_name: String(jobRow.repo_full_name),
      progress_percent: Number(jobRow.progress_percent ?? computeProgressPercent(generated, total, "complete")),
      current_phase: String(jobRow.current_phase ?? "complete"),
      phase_message: String(jobRow.phase_message ?? "Generation complete"),
      quality_gate_status: String(jobRow.quality_gate_status ?? "pass"),
      quality_fail_reasons: Array.isArray(jobRow.quality_fail_reasons) ? jobRow.quality_fail_reasons : [],
      failed_stage_ids: Array.isArray(jobRow.failed_stage_ids) ? jobRow.failed_stage_ids : [],
      dedupe_score: Number(jobRow.dedupe_score ?? 0),
      grounding_score: Number(jobRow.grounding_score ?? 0),
      failed_stage_reports: failedStageReports,
      quality_gate_metrics: qualityGateMetrics,
      chunk_status: "pass" as ChunkStatus,
    };
  }

  const usageSnapshot = await resolveUsageMode(supabase, userId, context.planTier);
  if (usageSnapshot.mode === "critical") {
    await updateGenerationJobQualityDiagnostics(supabase, jobId, {
      qualityGateStatus: "fail",
      qualityFailReasons: ["token_budget_exhausted"],
      failedStageIds: [],
      dedupeScore: Number(jobRow.dedupe_score ?? 0),
      groundingScore: Number(jobRow.grounding_score ?? 0),
    });
    await updateGenerationJobPhase(supabase, jobId, {
      phase: "hydrate",
      status: "failed",
      message: "Token budget is depleted.",
      lastError: "Token budget is depleted. Please try again after reset.",
      queueState: "failed",
    });
    throw new Error("Token budget is depleted. Please try again after reset.");
  }

  const needsBootstrap = Number(jobRow.total_planned_stages ?? 0) <= 0 ||
    String((jobRow.repo_summary as Record<string, unknown> | null)?.syllabus_id ?? "").length === 0;
  if (needsBootstrap) {
    jobRow = await bootstrapProgressiveJob(context, jobRow, usageSnapshot.mode);
  }

  const totalPlannedStages = Number(jobRow.total_planned_stages ?? 0);
  const generatedStages = Number(jobRow.generated_stages ?? 0);
  const stageStart = generatedStages + 1;
  const stageEnd = Math.min(totalPlannedStages, generatedStages + chunkSize);
  const stagesToGenerate = Math.max(stageEnd - stageStart + 1, 0);

  if (stagesToGenerate <= 0) {
    await updateGenerationJobPhase(supabase, jobId, {
      phase: "complete",
      status: "completed",
      generatedStages,
      totalStages: totalPlannedStages,
      message: "Generation complete.",
      lastError: null,
      queueState: "idle",
    });

    const failedStageReports = await getFailedStageReports(supabase, jobId);
    const qualityGateMetrics = await getLatestQualityGateMetrics(supabase, jobId, {
      dedupeScore: Number(jobRow.dedupe_score ?? 0),
      groundingScore: Number(jobRow.grounding_score ?? 0),
    });
    return {
      status: "completed" as RoadmapGenerationJobStatus,
      generated_stages: generatedStages,
      total_planned_stages: totalPlannedStages,
      timeline: Array.isArray(jobRow.initial_timeline) ? jobRow.initial_timeline : [],
      repo_full_name: String(jobRow.repo_full_name),
      progress_percent: 100,
      current_phase: "complete",
      phase_message: "Generation complete.",
      quality_gate_status: String(jobRow.quality_gate_status ?? "pass"),
      quality_fail_reasons: Array.isArray(jobRow.quality_fail_reasons) ? jobRow.quality_fail_reasons : [],
      failed_stage_ids: Array.isArray(jobRow.failed_stage_ids) ? jobRow.failed_stage_ids : [],
      dedupe_score: Number(jobRow.dedupe_score ?? 0),
      grounding_score: Number(jobRow.grounding_score ?? 0),
      failed_stage_reports: failedStageReports,
      quality_gate_metrics: qualityGateMetrics,
      chunk_status: "pass" as ChunkStatus,
    };
  }

  const currentTimeline = Array.isArray(jobRow.initial_timeline) ? (jobRow.initial_timeline as Record<string, unknown>[]) : [];
  const repoSummary = (jobRow.repo_summary ?? {}) as Record<string, unknown>;
  const syllabusId = String(repoSummary.syllabus_id ?? "");
  if (!syllabusId) {
    throw new Error("Syllabus is missing for roadmap generation job");
  }
  const syllabusNodes = await getSyllabusNodesById(supabase, syllabusId);
  if (syllabusNodes.length === 0) {
    throw new Error("Syllabus nodes not found");
  }

  const chunkNodes = syllabusNodes.slice(stageStart - 1, stageStart - 1 + stagesToGenerate);
  if (chunkNodes.length === 0) {
    throw new Error("No syllabus stages available for hydration");
  }

  const commitContextLines = Array.isArray(jobRow.commit_context)
    ? (jobRow.commit_context as unknown[]).map((line) => String(line))
    : [];
  const commitRefs = commitContextLines.map((line) => ({ sha: line.split(":")[0] ?? "" }));
  const ingestSnapshotKey = String(repoSummary.ingest_snapshot_key ?? "");
  let readmeExcerpt = "";
  let commitClusters: RepoIngestSnapshot["commitClusters"] = [];
  let ingestTreeStats: RepoIngestSnapshot["treeStats"] = {
    fileCount: 0,
    topLevelDirs: [],
    manifests: [],
    hotPaths: [],
    featureKeywords: [],
    architectureMap: {},
    apiConcepts: [],
    knownFiles: [],
    packageManager: "unknown",
    scripts: [],
    archetype: "utility-lib",
  };
  if (ingestSnapshotKey) {
    const { data: ingestSnapshot } = await supabase
      .from("repo_ingest_snapshots")
      .select("readme_excerpt,tree_stats")
      .eq("snapshot_key", ingestSnapshotKey)
      .maybeSingle();
    readmeExcerpt = String(ingestSnapshot?.readme_excerpt ?? "");
    const treeStatsRaw = (ingestSnapshot?.tree_stats ?? {}) as Record<string, unknown>;
    const archetypeRaw = String(treeStatsRaw.archetype ?? "utility-lib");
    ingestTreeStats = {
      fileCount: Number(treeStatsRaw.file_count ?? 0),
      topLevelDirs: Array.isArray(treeStatsRaw.top_level_dirs)
        ? treeStatsRaw.top_level_dirs.map((item) => String(item))
        : [],
      manifests: Array.isArray(treeStatsRaw.manifests)
        ? treeStatsRaw.manifests.map((item) => String(item))
        : [],
      hotPaths: Array.isArray(treeStatsRaw.hot_paths)
        ? treeStatsRaw.hot_paths.map((item) => String(item))
        : [],
      featureKeywords: Array.isArray(treeStatsRaw.feature_keywords)
        ? treeStatsRaw.feature_keywords.map((item) => String(item))
        : [],
      architectureMap: treeStatsRaw.architecture_map && typeof treeStatsRaw.architecture_map === "object"
        ? (treeStatsRaw.architecture_map as Record<string, unknown>)
        : {},
      apiConcepts: Array.isArray(treeStatsRaw.api_concepts)
        ? treeStatsRaw.api_concepts.map((item) => String(item))
        : [],
      knownFiles: Array.isArray(treeStatsRaw.known_files)
        ? treeStatsRaw.known_files.map((item) => String(item))
        : [],
      packageManager: (
        ["pnpm", "npm", "yarn", "bun", "unknown"].includes(String(treeStatsRaw.package_manager ?? "unknown"))
          ? String(treeStatsRaw.package_manager ?? "unknown")
          : "unknown"
      ) as RepoIngestSnapshot["treeStats"]["packageManager"],
      scripts: Array.isArray(treeStatsRaw.scripts)
        ? treeStatsRaw.scripts.map((item) => String(item))
        : [],
      archetype: (
        ["utility-lib", "sdk", "tooling", "saas-app", "infra"].includes(archetypeRaw)
          ? archetypeRaw
          : "utility-lib"
      ) as RepoArchetype,
    };

    const { data: clusterRows } = await supabase
      .from("repo_commit_clusters")
      .select("theme,commit_count,samples")
      .eq("snapshot_key", ingestSnapshotKey)
      .order("cluster_rank", { ascending: true });
    commitClusters = (clusterRows ?? []).map((row) => ({
      theme: String(row.theme ?? "product-iterations"),
      commit_count: Number(row.commit_count ?? 0),
      samples: Array.isArray(row.samples) ? row.samples.map((item: unknown) => String(item)) : [],
    }));
  }

  const stageEvidence = buildStageEvidenceRefs({
    nodes: chunkNodes,
    commitClusters,
    treeStats: ingestTreeStats,
    readmeExcerpt,
  });
  const stageEvidenceById = new Map(stageEvidence.map((item) => [item.stage_id, item]));
  const validationContext = {
    knownFiles: new Set(ingestTreeStats.knownFiles),
    packageManager: ingestTreeStats.packageManager,
    scripts: new Set(ingestTreeStats.scripts),
  };

  const prompt = buildStageHydrationPrompt({
    repoName: String(jobRow.repo_full_name),
    readmeExcerpt,
    commitClusters,
    nodes: chunkNodes,
    evidenceByStage: stageEvidence,
    treeStats: ingestTreeStats,
    existingTimeline: currentTimeline,
  });

  await updateGenerationJobPhase(supabase, jobId, {
    phase: "hydrate",
    status: "running",
    generatedStages,
    totalStages: totalPlannedStages,
    message: `Hydrating stages ${stageStart}-${stageEnd}...`,
    lastError: null,
    queueState: "processing",
  });

  let usageMeta = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  let hydratedSourceTimeline: unknown = [];
  try {
    const result = await callGeminiJson({
      prompt,
      maxOutputTokens: usageSnapshot.mode === "low" ? 1400 : 2200,
      responseMimeType: "application/json",
      temperature: 0.15,
      models: usageSnapshot.mode === "low"
        ? ["gemini-3.1-flash-lite-preview"]
        : ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview"],
      retries: 0,
      timeoutMs: 22_000,
    });
    usageMeta = { ...result.usage };
    hydratedSourceTimeline = result.parsed.timeline;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "stage hydration failed";
    await updateGenerationJobQualityDiagnostics(supabase, jobId, {
      qualityGateStatus: "fail",
      qualityFailReasons: [`hydration_model_failed: ${reason}`],
      failedStageIds: chunkNodes.map((node) => node.id),
      dedupeScore: 0,
      groundingScore: 0,
    });
    await updateGenerationJobPhase(supabase, jobId, {
      phase: "hydrate",
      status: "failed",
      generatedStages,
      totalStages: totalPlannedStages,
      message: "Hydration model failed.",
      lastError: reason,
      queueState: "failed",
    });
    throw new Error(`Hydration model failed: ${reason}`);
  }

  const hydrated = normalizeTimeline(hydratedSourceTimeline, chunkNodes.length, commitRefs).filter((stage) => stage.id !== "stage-setup");
  const hydratedByIndex = new Map(hydrated.map((stage) => [Number(stage.index), stage]));
  const initialStages = chunkNodes.map((node, idx) => {
    const candidate = hydratedByIndex.get(idx + 1) ?? hydrated[idx];
    return candidate
      ? mergeSyllabusNodeIntoStage(candidate, node)
      : mergeSyllabusNodeIntoStage({
        id: node.id,
        index: node.index,
        title: node.title,
        summary: node.summary,
        status: "not-started",
        eta: "45m",
        category: node.category,
        difficulty: node.difficulty,
        goals: node.goals,
        prerequisites: node.prerequisites,
        checkpoints: node.checkpoints,
        tasks: [],
        code_examples: [],
        resources: [],
        commit_window: commitRefs.length > 0 ? [commitRefs[commitRefs.length - 1].sha, commitRefs[0].sha] : [],
      }, node);
  });

  await updateGenerationJobPhase(supabase, jobId, {
    phase: "validate",
    status: "running",
    generatedStages,
    totalStages: totalPlannedStages,
    message: "Validating stage quality...",
    queueState: "processing",
  });

  const stageByNodeId = new Map<string, Record<string, unknown>>();
  const validationByNodeId = new Map<string, StageValidationReport>();
  const stageAttemptReports = new Map<string, StageRepairAttemptReport>();
  for (let idx = 0; idx < chunkNodes.length; idx += 1) {
    const node = chunkNodes[idx];
    const stage = initialStages[idx];
    stageByNodeId.set(node.id, stage);
    validationByNodeId.set(node.id, validateHydratedStageQuality(stage, node, stageEvidenceById.get(node.id), validationContext));
  }

  const failedNodes = chunkNodes
    .map((node) => ({
      node,
      validated: validationByNodeId.get(node.id),
    }))
    .filter((item) => !(item.validated?.ok ?? false));

  if (failedNodes.length > 0) {
    const repairModelByAttempt = GEMINI_ALLOW_PRO_MODELS
      ? ["gemini-3-flash-preview", "gemini-3.1-pro-preview"]
      : ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview"];
    for (const item of failedNodes) {
      const node = item.node;
      const evidence = stageEvidenceById.get(node.id);
      let currentValidation = validationByNodeId.get(node.id);
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (currentValidation?.ok) {
          break;
        }
        const model = repairModelByAttempt[Math.min(attempt - 1, repairModelByAttempt.length - 1)];
        const repairSeedTasks = buildEvidenceRecoveryTasks({
          node,
          evidence,
          knownFiles: validationContext.knownFiles,
          packageManager: validationContext.packageManager,
          scripts: validationContext.scripts,
        });
        try {
          const repairPrompt = buildIssueAwareStageRepairPrompt({
            repoName: String(jobRow.repo_full_name),
            readmeExcerpt,
            commitClusters,
            node,
            evidence,
            treeStats: ingestTreeStats,
            failCodes: currentValidation?.failCodes ?? ["missing_actionability"],
            failReasons: currentValidation?.failReasons ?? ["stage failed quality validation"],
            repairSeedTasks,
            attempt,
          });
          const repairResult = await callGeminiJson({
            prompt: repairPrompt,
            maxOutputTokens: usageSnapshot.mode === "low" ? 1200 : 2000,
            responseMimeType: "application/json",
            temperature: 0.1,
            models: [model],
            retries: 0,
            timeoutMs: 20_000,
          });
          usageMeta.promptTokens += repairResult.usage.promptTokens;
          usageMeta.completionTokens += repairResult.usage.completionTokens;
          usageMeta.totalTokens += repairResult.usage.totalTokens;

          const repairedStageRaw = repairResult.parsed.stage ??
            (Array.isArray(repairResult.parsed.timeline) ? repairResult.parsed.timeline[0] : null);
          if (!repairedStageRaw || typeof repairedStageRaw !== "object") {
            throw new Error("repair response missing stage object");
          }
          const normalizedStage = normalizeTimeline([repairedStageRaw], 1, commitRefs)
            .filter((stage) => stage.id !== "stage-setup")[0];
          if (!normalizedStage) {
            throw new Error("repair response could not be normalized");
          }
          const merged = mergeSyllabusNodeIntoStage(normalizedStage, node);
          const validated = validateHydratedStageQuality(merged, node, evidence, validationContext);
          stageByNodeId.set(node.id, merged);
          validationByNodeId.set(node.id, validated);
          currentValidation = validated;
          await recordStageRepairAttempt(supabase, {
            jobId,
            stageId: node.id,
            attemptNo: attempt,
            model,
            failCodes: validated.ok ? [] : validated.failCodes,
            failReasons: validated.ok ? [] : validated.failReasons,
            metrics: {
              quality_score: validated.qualityScore,
              grounding_score: validated.groundingScore,
              concept_coverage_score: validated.conceptCoverageScore,
              template_risk_score: validated.templateRiskScore,
            },
          });
          stageAttemptReports.set(node.id, {
            stage_id: node.id,
            attempt_count: attempt,
            fail_codes: validated.ok ? [] : validated.failCodes,
            fail_reasons: validated.ok ? [] : validated.failReasons,
            last_model: model,
          });
          if (validated.ok) {
            break;
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : "repair generation failed";
          const fallbackCodes = currentValidation?.failCodes?.length
            ? currentValidation.failCodes
            : ["missing_actionability"];
          const fallbackReasons = [
            ...(currentValidation?.failReasons ?? []),
            `repair_attempt_${attempt}_failed: ${reason}`,
          ];
          await recordStageRepairAttempt(supabase, {
            jobId,
            stageId: node.id,
            attemptNo: attempt,
            model,
            failCodes: fallbackCodes,
            failReasons: fallbackReasons,
            metrics: {
              quality_score: Number(currentValidation?.qualityScore ?? 0),
              grounding_score: Number(currentValidation?.groundingScore ?? 0),
              concept_coverage_score: Number(currentValidation?.conceptCoverageScore ?? 0),
              template_risk_score: Number(currentValidation?.templateRiskScore ?? 100),
            },
          });
          stageAttemptReports.set(node.id, {
            stage_id: node.id,
            attempt_count: attempt,
            fail_codes: fallbackCodes,
            fail_reasons: fallbackReasons,
            last_model: model,
          });
        }
      }
      if (!(currentValidation?.ok ?? false)) {
        const fallbackStage = stageByNodeId.get(node.id) ?? initialStages[idx];
        const fallbackValidated = currentValidation ?? validateHydratedStageQuality(
          fallbackStage,
          node,
          evidence,
          validationContext,
        );
        const failCodes = fallbackValidated.failCodes.length > 0
          ? fallbackValidated.failCodes
          : ["missing_actionability"];
        const failReasons = [
          ...fallbackValidated.failReasons,
          "stage_repair_exhausted_without_valid_output",
        ];
        const forcedFailure: StageValidationReport = {
          ...fallbackValidated,
          ok: false,
          failCodes: Array.from(new Set(failCodes)),
          failReasons: Array.from(new Set(failReasons)),
        };
        validationByNodeId.set(node.id, forcedFailure);
        currentValidation = forcedFailure;
        await recordStageRepairAttempt(supabase, {
          jobId,
          stageId: node.id,
          attemptNo: 99,
          model: "repair-exhausted",
          failCodes: forcedFailure.failCodes,
          failReasons: forcedFailure.failReasons,
          metrics: {
            quality_score: forcedFailure.qualityScore,
            grounding_score: forcedFailure.groundingScore,
            concept_coverage_score: forcedFailure.conceptCoverageScore,
            template_risk_score: forcedFailure.templateRiskScore,
          },
        });
        stageAttemptReports.set(node.id, {
          stage_id: node.id,
          attempt_count: 99,
          fail_codes: forcedFailure.failCodes,
          fail_reasons: forcedFailure.failReasons,
          last_model: "repair-exhausted",
        });
      }
    }
  }

  const unresolvedFailures = chunkNodes
    .map((node) => ({
      node,
      validated: validationByNodeId.get(node.id),
    }))
    .filter((item) => !(item.validated?.ok ?? false));

  const normalizedChunk = chunkNodes.map((node) => {
    const validated = validationByNodeId.get(node.id);
    const safeStage = validated?.stage ?? stageByNodeId.get(node.id) ?? {};
    return {
      ...safeStage,
      id: node.id,
      index: node.index,
    };
  });
  const qualityGate = evaluateChunkQuality({
    chunkNodes,
    chunkStages: normalizedChunk,
    existingTimeline: currentTimeline,
    validationByNodeId,
    archetype: ingestTreeStats.archetype,
    domainKeywords: [...ingestTreeStats.featureKeywords, ...ingestTreeStats.apiConcepts],
  });
  const failedStageIds = new Set<string>(qualityGate.failedStageIds);
  const qualityFailReasons: string[] = qualityGate.reasons.length > 0 ? [...qualityGate.reasons] : [];

  if (unresolvedFailures.length > 0) {
    const stageFailureReasons = unresolvedFailures.map((item) => {
      const reasons = item.validated?.failReasons ?? ["unknown quality failure"];
      return `${item.node.id}: ${reasons.join(", ")}`;
    });
    for (const item of unresolvedFailures) {
      failedStageIds.add(item.node.id);
    }
    qualityFailReasons.push(...stageFailureReasons);
  }

  await supabase
    .from("roadmap_generation_quality_runs")
    .insert({
      job_id: jobId,
      repo_full_name: String(jobRow.repo_full_name),
      novelty_score: qualityGate.noveltyScore,
      dedupe_score: qualityGate.dedupeScore,
      grounding_score: qualityGate.groundingScore,
      concept_coverage_score: qualityGate.conceptCoverageScore,
      template_risk_score: qualityGate.templateRiskScore,
      anti_template_pass: qualityGate.antiTemplatePass,
      reasons: qualityFailReasons,
    });

  if (failedStageIds.size > 0 || qualityGate.qualityGateStatus === "fail") {
    const stageReports = await getFailedStageReports(supabase, jobId);
    const synthesizedStageReports = Array.from(stageAttemptReports.values());
    const mergedStageReports = [...stageReports, ...synthesizedStageReports]
      .filter((report, index, list) =>
        list.findIndex((item) => item.stage_id === report.stage_id) === index)
      .sort((a, b) => a.stage_id.localeCompare(b.stage_id));
    const reason = qualityFailReasons.slice(0, 5).join(" | ") || "strict quality gate failed";
    await updateGenerationJobQualityDiagnostics(supabase, jobId, {
      qualityGateStatus: "fail",
      qualityFailReasons: [
        ...qualityFailReasons,
        ...mergedStageReports.flatMap((report) =>
          report.fail_reasons.map((detail) => `${report.stage_id}: ${detail}`)).slice(0, 20),
      ],
      failedStageIds: Array.from(failedStageIds),
      dedupeScore: qualityGate.dedupeScore,
      groundingScore: qualityGate.groundingScore,
    });
    await updateGenerationJobPhase(supabase, jobId, {
      phase: "validate",
      status: "failed",
      generatedStages,
      totalStages: totalPlannedStages,
      message: "Stage quality validation failed.",
      lastError: reason,
      queueState: "failed",
    });
    throw new Error(`Stage quality validation failed. ${reason}`);
  }

  await updateGenerationJobPhase(supabase, jobId, {
    phase: "persist",
    status: "running",
    generatedStages,
    totalStages: totalPlannedStages,
    message: "Persisting generated stages...",
    queueState: "processing",
  });

  const nextTimeline = [...currentTimeline, ...normalizedChunk];
  const nextGeneratedStages = generatedStages + normalizedChunk.length;
  const nextStatus: RoadmapGenerationJobStatus = nextGeneratedStages >= totalPlannedStages ? "completed" : "partial_ready";

  const { data: updatedJob, error: updateError } = await supabase
    .from("roadmap_generation_jobs")
    .update({
      status: nextStatus,
      generated_stages: nextGeneratedStages,
      initial_timeline: nextTimeline,
      last_error: null,
      quality_gate_status: "pass",
      quality_fail_reasons: [],
      failed_stage_ids: [],
      dedupe_score: qualityGate.dedupeScore,
      grounding_score: qualityGate.groundingScore,
      current_phase: nextStatus === "completed" ? "complete" : "hydrate",
      phase_message: nextStatus === "completed" ? "Generation complete." : "Ready to hydrate next stage window.",
      queue_state: "idle",
      progress_percent: computeProgressPercent(
        nextGeneratedStages,
        totalPlannedStages,
        nextStatus === "completed" ? "complete" : "hydrate",
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select("*")
    .single();

  if (updateError || !updatedJob) {
    throw new Error(updateError?.message ?? "Failed to update generation job");
  }

  await supabase.from("roadmap_generation_chunks").insert({
    job_id: jobId,
    chunk_index: Math.floor(generatedStages / Math.max(chunkSize, 1)) + 1,
    stage_start: stageStart,
    stage_end: stageEnd,
    stages_generated: normalizedChunk.length,
    timeline_chunk: normalizedChunk,
    prompt_tokens: usageMeta.promptTokens,
    completion_tokens: usageMeta.completionTokens,
    total_tokens: usageMeta.totalTokens,
  });

  const stageDetailsRows = normalizedChunk.map((stage) => ({
    job_id: jobId,
    syllabus_id: syllabusId,
    repo_full_name: String(jobRow.repo_full_name),
    stage_id: String(stage.id),
    stage_index: Number(stage.index),
    detail: stage,
    quality_score: scoreStageQuality(stage as Record<string, unknown>),
  }));
  await supabase
    .from("roadmap_stage_details")
    .upsert(stageDetailsRows, { onConflict: "job_id,stage_id" });

  const stageEvidenceRows = normalizedChunk.map((stage) => {
    const stageRecord = stage as Record<string, unknown>;
    const stageId = String(stageRecord.id ?? "");
    const evidence = stageEvidenceById.get(stageId);
    return {
      job_id: jobId,
      stage_id: stageId,
      evidence_refs: evidence ?? {
        stage_id: stageId,
        objective: String(stageRecord.summary ?? ""),
        themes: [],
        hot_paths: [],
        feature_keywords: [],
        readme_hints: [],
        api_concepts: [],
        archetype: ingestTreeStats.archetype,
      },
      created_at: new Date().toISOString(),
    };
  });
  await supabase
    .from("roadmap_generation_stage_evidence")
    .upsert(stageEvidenceRows, { onConflict: "job_id,stage_id" });

  const qualityRows = normalizedChunk.map((stage) => {
    const stageRecord = stage as Record<string, unknown>;
    return {
      job_id: jobId,
      repo_full_name: String(jobRow.repo_full_name),
      stage_id: String(stageRecord.id ?? ""),
      stage_index: Number(stageRecord.index ?? 0),
      quality_score: scoreStageQuality(stageRecord),
      checks: {
        has_tasks: Array.isArray(stageRecord.tasks) && stageRecord.tasks.length > 0,
        has_goals: Array.isArray(stageRecord.goals) && stageRecord.goals.length > 0,
        clone_free: JSON.stringify(stageRecord).toLowerCase().includes("git clone") === false,
      },
    };
  });
  await supabase.from("roadmap_quality_reports").insert(qualityRows);

  const peekRows = normalizedChunk.flatMap((stage) => {
    const stageRecord = stage as Record<string, unknown>;
    const optionalPeeks = Array.isArray(stageRecord.optional_peeks)
      ? stageRecord.optional_peeks.map((item: unknown) => String(item)).filter(Boolean)
      : [];
    return optionalPeeks.map((peek: string, idx: number) => ({
      job_id: jobId,
      repo_full_name: String(jobRow.repo_full_name),
      stage_id: String(stageRecord.id ?? ""),
      stage_index: Number(stageRecord.index ?? 0),
      peek_rank: idx + 1,
      peek_text: peek,
    }));
  });
  if (peekRows.length > 0) {
    await supabase.from("roadmap_reference_peeks").insert(peekRows);
  }

  const roadmapRow = await upsertProgressiveRoadmapRow({
    supabase,
    repoFullName: String(jobRow.repo_full_name),
    repoSummary,
    timeline: nextTimeline,
    jobState: nextStatus,
    lastGeneratedStage: nextGeneratedStages,
    timelineQuality: {
      novelty_score: qualityGate.noveltyScore,
      grounding_score: qualityGate.groundingScore,
      anti_template_pass: qualityGate.antiTemplatePass,
      evaluated_at: new Date().toISOString(),
    },
  });

  const fallbackTokens = estimateTokenUsage(prompt) + estimateTokenUsage(JSON.stringify(normalizedChunk));
  await recordTokenUsage(supabase, {
    kind: "roadmap_generate_progressive",
    userId,
    endpoint: "/api/v1/roadmap/generate-progressive",
    promptTokens: usageMeta.promptTokens || estimateTokenUsage(prompt),
    completionTokens: usageMeta.completionTokens || estimateTokenUsage(JSON.stringify(normalizedChunk)),
    totalTokens: usageMeta.totalTokens || fallbackTokens,
    metadata: {
      repo_full_name: String(jobRow.repo_full_name),
      mode: usageSnapshot.mode,
      plan_tier: usageSnapshot.planTier,
      chunk_size: stagesToGenerate,
      stage_start: stageStart,
      stage_end: stageEnd,
      global_remaining: usageSnapshot.globalUsage.remaining,
      user_remaining: usageSnapshot.userUsage.remaining,
    },
    userDailyLimit: usageSnapshot.userUsage.daily_limit,
  });

  await updateGenerationJobPhase(supabase, jobId, {
    phase: nextStatus === "completed" ? "complete" : "hydrate",
    status: nextStatus,
    generatedStages: nextGeneratedStages,
    totalStages: totalPlannedStages,
    message: nextStatus === "completed"
      ? "Generation complete."
      : `Generated ${nextGeneratedStages}/${totalPlannedStages} stages.`,
    lastError: null,
    timeline: nextTimeline,
    queueState: "idle",
  });

  return {
    status: nextStatus,
    generated_stages: nextGeneratedStages,
    total_planned_stages: totalPlannedStages,
    timeline: nextTimeline,
    repo_full_name: String(jobRow.repo_full_name),
    roadmap: mapRoadmapRow(roadmapRow, false),
    progress_percent: computeProgressPercent(
      nextGeneratedStages,
      totalPlannedStages,
      nextStatus === "completed" ? "complete" : "hydrate",
    ),
    current_phase: nextStatus === "completed" ? "complete" : "hydrate",
    phase_message: nextStatus === "completed"
      ? "Generation complete."
      : `Generated ${nextGeneratedStages}/${totalPlannedStages} stages.`,
    quality_gate_status: "pass",
    quality_fail_reasons: [],
    failed_stage_ids: [],
    dedupe_score: qualityGate.dedupeScore,
    grounding_score: qualityGate.groundingScore,
    failed_stage_reports: [],
    quality_gate_metrics: {
      dedupe_score: qualityGate.dedupeScore,
      grounding_score: qualityGate.groundingScore,
      concept_coverage_score: qualityGate.conceptCoverageScore,
      template_risk_score: qualityGate.templateRiskScore,
    },
    chunk_status: qualityGate.chunkStatus,
  };
}

async function getRoadmapJobSnapshot(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("roadmap_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  const failedStageReports = await getFailedStageReports(supabase, jobId);
  const qualityGateMetrics = await getLatestQualityGateMetrics(supabase, jobId, {
    dedupeScore: Number(data.dedupe_score ?? 0),
    groundingScore: Number(data.grounding_score ?? 0),
  });
  let chunkStatus: ChunkStatus = "pass";
  if (String(data.status ?? "") === "failed") {
    chunkStatus = "fail";
  } else if (failedStageReports.length > 0 && String(data.status ?? "") !== "completed") {
    chunkStatus = "partial_pass";
  }
  return {
    status: String(data.status ?? "queued"),
    generated_stages: Number(data.generated_stages ?? 0),
    total_planned_stages: Number(data.total_planned_stages ?? 0),
    last_error: data.last_error ?? null,
    updated_at: String(data.updated_at ?? new Date().toISOString()),
    progress_percent: Number(data.progress_percent ?? 0),
    current_phase: String(data.current_phase ?? "ingest"),
    phase_message: String(data.phase_message ?? ""),
    quality_gate_status: String(data.quality_gate_status ?? "pass"),
    quality_fail_reasons: Array.isArray(data.quality_fail_reasons) ? data.quality_fail_reasons : [],
    failed_stage_ids: Array.isArray(data.failed_stage_ids) ? data.failed_stage_ids : [],
    dedupe_score: Number(data.dedupe_score ?? 0),
    grounding_score: Number(data.grounding_score ?? 0),
    failed_stage_reports: failedStageReports,
    quality_gate_metrics: qualityGateMetrics,
    chunk_status: chunkStatus,
    queue_state: String(data.queue_state ?? "idle"),
    worker_attempts: Number(data.worker_attempts ?? 0),
    last_worker_at: data.last_worker_at ? String(data.last_worker_at) : null,
    timeline: Array.isArray(data.initial_timeline) ? data.initial_timeline : [],
  };
}

async function enqueueRoadmapJobTask(
  context: AuthedRouteContext,
  options: {
    jobId: string;
    type: "bootstrap" | "hydrate_chunk";
    chunkSize?: number;
  },
) {
  const { data: jobRow, error } = await context.supabase
    .from("roadmap_generation_jobs")
    .select("id,user_id,status,queue_state,repo_full_name,last_error,last_worker_at")
    .eq("id", options.jobId)
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!jobRow) {
    throw new Error("Roadmap generation job not found");
  }

  const queueState = String(jobRow.queue_state ?? "idle");
  const nowMs = Date.now();
  const lastWorkerMs = jobRow.last_worker_at ? Date.parse(String(jobRow.last_worker_at)) : NaN;
  const queueStale = !Number.isFinite(lastWorkerMs) || (nowMs - lastWorkerMs) > 120_000;
  const alreadyQueued = queueState === "queued" || queueState === "processing";

  if (alreadyQueued && !queueStale) {
    triggerWorkerDrain(context, 1);
    return;
  }

  if (!alreadyQueued || queueStale) {
    await context.supabase
      .from("roadmap_generation_jobs")
      .update({
        queue_state: "queued",
        current_phase: options.type === "bootstrap" ? "ingest" : "hydrate",
        phase_message: options.type === "bootstrap"
          ? (queueStale ? "Re-queued. Preparing ingest artifacts..." : "Queued. Preparing ingest artifacts...")
          : (queueStale ? "Re-queued for stage hydration." : "Queued for stage hydration."),
        last_error: String(jobRow.status ?? "") === "failed" ? null : jobRow.last_error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", options.jobId)
      .eq("user_id", context.userId);
  }

  await enqueueRoadmapTask(context.supabase, {
    type: options.type,
    job_id: options.jobId,
    user_id: context.userId,
    plan_tier: context.planTier,
    repo_full_name: String(jobRow.repo_full_name ?? ""),
    chunk_size: options.type === "hydrate_chunk"
      ? Math.max(1, Math.min(8, Math.floor(options.chunkSize ?? 3)))
      : undefined,
  });

  triggerWorkerDrain(context, 1);
}

function parseStageIndex(stageId: string) {
  const match = stageId.match(/^stage-(\d+)$/);
  if (!match) {
    return null;
  }
  const index = Number(match[1]);
  return Number.isFinite(index) && index > 0 ? index : null;
}

async function regenerateApprovedStageFlag(
  context: RouteContext,
  task: RoadmapWorkerTaskPayload,
) {
  const flagId = typeof task.flag_id === "string" ? task.flag_id : "";
  if (!flagId) {
    throw new Error("Missing flag_id for regenerate_stage task");
  }

  const { data: flagRow, error: flagError } = await context.supabase
    .from("roadmap_stage_regen_flags")
    .select("*")
    .eq("id", flagId)
    .maybeSingle();
  if (flagError || !flagRow) {
    throw new Error(flagError?.message ?? "Stage regeneration flag not found");
  }

  const status = String(flagRow.status ?? "pending") as StageRegenerationFlagStatus;
  if (!(status === "approved" || status === "processing")) {
    throw new Error(`Stage regeneration flag is not approved (status: ${status})`);
  }

  const stageId = String(flagRow.stage_id ?? "");
  const stageIndex = parseStageIndex(stageId);
  if (!stageIndex) {
    throw new Error("Invalid stage id for regeneration");
  }
  const repoFullName = String(flagRow.repo_full_name ?? "");
  const requestedBy = String(flagRow.requested_by ?? "");
  if (!(repoFullName && requestedBy)) {
    throw new Error("Flag is missing repo_full_name or requested_by");
  }

  const [owner, repo] = repoFullName.split("/");
  if (!(owner && repo)) {
    throw new Error("Invalid repo_full_name for stage regeneration");
  }

  const { data: roadmapRow, error: roadmapError } = await context.supabase
    .from("generated_roadmaps")
    .select("timeline,repo_summary,job_state,last_generated_stage,timeline_quality")
    .eq("repo_full_name", repoFullName)
    .maybeSingle();
  if (roadmapError || !roadmapRow) {
    throw new Error(roadmapError?.message ?? "Roadmap not found for stage regeneration");
  }
  const canonicalTimeline = Array.isArray(roadmapRow.timeline)
    ? (roadmapRow.timeline as Record<string, unknown>[])
    : [];
  if (canonicalTimeline.length === 0) {
    throw new Error("Roadmap timeline is empty");
  }

  const workerAuthContext: AuthedRouteContext = {
    ...context,
    userId: requestedBy,
    planTier: normalizePlanTier(task.plan_tier ?? "free"),
    authPayload: {
      sub: requestedBy,
    } as JWTPayload,
  };
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const seedJob = await getOrCreateProgressiveJob(workerAuthContext, repoUrl, true, {
    quickStart: false,
  });
  const seedJobId = String(seedJob.id ?? "");
  if (!seedJobId) {
    throw new Error("Failed to initialize stage regeneration job");
  }

  const prefixTimeline = canonicalTimeline
    .filter((stage) => stage && typeof stage.id === "string")
    .filter((stage) => {
      const id = String(stage.id);
      if (id === "stage-setup") {
        return true;
      }
      const index = parseStageIndex(id);
      return index !== null && index < stageIndex;
    });

  await context.supabase
    .from("roadmap_generation_jobs")
    .update({
      status: "partial_ready",
      generated_stages: Math.max(0, stageIndex - 1),
      initial_timeline: prefixTimeline,
      queue_state: "processing",
      current_phase: "hydrate",
      phase_message: `Regenerating ${stageId}...`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", seedJobId)
    .eq("user_id", requestedBy);

  const regenerationSnapshot = await runProgressiveGenerationChunk(workerAuthContext, seedJobId, 1);
  const regeneratedTimeline = Array.isArray(regenerationSnapshot.timeline)
    ? (regenerationSnapshot.timeline as Record<string, unknown>[])
    : [];
  const regeneratedStage = regeneratedTimeline.find((stage) => String(stage.id ?? "") === stageId);
  if (!regeneratedStage) {
    throw new Error(`Regenerated stage ${stageId} is missing from worker output`);
  }

  const nextCanonicalTimeline = canonicalTimeline.map((stage) =>
    String(stage.id ?? "") === stageId ? regeneratedStage : stage
  );
  const qualityMeta = (roadmapRow.timeline_quality && typeof roadmapRow.timeline_quality === "object")
    ? (roadmapRow.timeline_quality as Record<string, unknown>)
    : {};
  const { error: updateRoadmapError } = await context.supabase
    .from("generated_roadmaps")
    .update({
      timeline: nextCanonicalTimeline,
      last_generated_stage: Math.max(Number(roadmapRow.last_generated_stage ?? 0), stageIndex),
      job_state: String(roadmapRow.job_state ?? "partial_ready"),
      timeline_quality: {
        ...qualityMeta,
        evaluated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("repo_full_name", repoFullName);
  if (updateRoadmapError) {
    throw new Error(updateRoadmapError.message);
  }

  const { error: stageDetailError } = await context.supabase
    .from("roadmap_stage_details")
    .upsert({
      job_id: seedJobId,
      syllabus_id: String((seedJob.repo_summary as Record<string, unknown> | undefined)?.syllabus_id ?? ""),
      repo_full_name: repoFullName,
      stage_id: stageId,
      stage_index: stageIndex,
      detail: regeneratedStage,
      quality_score: scoreStageQuality(regeneratedStage),
      updated_at: new Date().toISOString(),
    }, { onConflict: "job_id,stage_id" });
  if (stageDetailError) {
    console.error("Unable to persist regenerated stage detail:", stageDetailError.message);
  }

  await context.supabase
    .from("roadmap_stage_regen_flags")
    .update({
      status: "completed",
      admin_note: "Regeneration completed and stage updated.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", flagId);
}

async function processRoadmapWorkerTask(
  context: RouteContext,
  message: RoadmapWorkerQueueMessage,
) {
  const startedAt = Date.now();
  const task = message.message;
  const workerRunBase = {
    msg_id: message.msg_id,
    task_type: task.type,
    job_id: task.job_id ?? null,
    repo_full_name: task.repo_full_name ?? null,
    attempts: Math.max(1, message.read_ct),
    payload: task,
  };

  await context.supabase
    .from("roadmap_worker_runs")
    .insert({
      ...workerRunBase,
      status: "processing",
      duration_ms: null,
      error_detail: null,
      updated_at: new Date().toISOString(),
    });

  try {
    if (task.type === "bootstrap" || task.type === "hydrate_chunk") {
      const jobId = typeof task.job_id === "string" ? task.job_id : "";
      const userId = typeof task.user_id === "string" ? task.user_id : "";
      if (!(jobId && userId)) {
        throw new Error("Queue task missing job_id or user_id");
      }
      await context.supabase
        .from("roadmap_generation_jobs")
        .update({
          queue_state: "processing",
          worker_attempts: Math.max(1, message.read_ct),
          last_worker_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("user_id", userId);

      const workerAuthContext: AuthedRouteContext = {
        ...context,
        userId,
        planTier: normalizePlanTier(task.plan_tier ?? "free"),
        authPayload: { sub: userId } as JWTPayload,
      };
      const chunkSize = task.type === "bootstrap"
        ? Math.max(3, Math.min(6, Math.floor(task.chunk_size ?? 4)))
        : Math.max(1, Math.min(8, Math.floor(task.chunk_size ?? 3)));
      await runProgressiveGenerationChunk(workerAuthContext, jobId, chunkSize);
    } else if (task.type === "regenerate_stage") {
      await regenerateApprovedStageFlag(context, task);
    } else if (task.type === "translate_prefetch") {
      // Translation prefetch is non-critical for roadmap correctness and is intentionally no-op here.
    } else {
      throw new Error(`Unsupported worker task type: ${task.type}`);
    }

    await context.supabase
      .from("roadmap_worker_runs")
      .insert({
        ...workerRunBase,
        status: "completed",
        duration_ms: Date.now() - startedAt,
        error_detail: null,
        updated_at: new Date().toISOString(),
      });

    await archiveRoadmapTask(context.supabase, message.msg_id);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Worker task failed";
    const providerLimited = PROVIDER_RATE_LIMIT_REGEX.test(detail);
    await context.supabase
      .from("roadmap_worker_runs")
      .insert({
        ...workerRunBase,
        status: "failed",
        duration_ms: Date.now() - startedAt,
        error_detail: detail.slice(0, 2000),
        updated_at: new Date().toISOString(),
      });

    if (typeof task.job_id === "string" && task.job_id.length > 0 && typeof task.user_id === "string" && task.user_id.length > 0) {
      await context.supabase
        .from("roadmap_generation_jobs")
        .update({
          queue_state: providerLimited
            ? "queued"
            : message.read_ct >= WORKER_MAX_RETRIES
              ? "failed"
              : "queued",
          worker_attempts: Math.max(1, message.read_ct),
          last_worker_at: new Date().toISOString(),
          last_error: detail.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.job_id)
        .eq("user_id", task.user_id);
    }

    if (task.type === "regenerate_stage" && typeof task.flag_id === "string") {
      await context.supabase
        .from("roadmap_stage_regen_flags")
        .update({
          status: "failed",
          admin_note: detail.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.flag_id);
    }

    if (message.read_ct >= WORKER_MAX_RETRIES && !providerLimited) {
      await archiveRoadmapTask(context.supabase, message.msg_id);
    } else {
      const baseSeconds = providerLimited
        ? 180 * Math.max(1, message.read_ct)
        : 20 * Math.max(1, message.read_ct);
      await setRoadmapTaskVisibility(context.supabase, message.msg_id, Math.min(baseSeconds, 1800));
    }
  }
}

async function handleInternalWorkerDrain(context: RouteContext) {
  if (!isWorkerAuthorized(context.req)) {
    return routeError(401, "Unauthorized worker request.");
  }
  const body = await readJsonBody(context.req);
  const requestedMaxTasks = Number(body.max_tasks ?? context.url.searchParams.get("max_tasks") ?? WORKER_DEFAULT_BATCH_SIZE);
  const maxTasks = Math.max(1, Math.min(WORKER_MAX_BATCH_SIZE, Math.floor(requestedMaxTasks)));
  const asyncModeRaw = body.async_mode ?? context.url.searchParams.get("async_mode") ?? true;
  const asyncMode = typeof asyncModeRaw === "boolean"
    ? asyncModeRaw
    : ["1", "true", "yes", "on"].includes(String(asyncModeRaw).toLowerCase());
  const messages = await readRoadmapTasks(context.supabase, maxTasks);
  if (asyncMode) {
    const task = (async () => {
      for (const message of messages) {
        await processRoadmapWorkerTask(context, message);
      }
    })().catch((error) => {
      console.error("Async worker drain failed:", error instanceof Error ? error.message : String(error));
    });
    scheduleBackgroundTask(task);
    return toJsonResponse({
      ok: true,
      processed: 0,
      queued_for_processing: messages.length,
      max_tasks: maxTasks,
      async_mode: true,
    }, 202);
  }
  for (const message of messages) {
    await processRoadmapWorkerTask(context, message);
  }
  return toJsonResponse({
    ok: true,
    processed: messages.length,
    max_tasks: maxTasks,
    async_mode: false,
  });
}

async function handleGenerateRoadmapProgressive(context: AuthedRouteContext) {
  const body = await readJsonBody(context.req);
  const repoUrl = typeof body.repo_url === "string" ? body.repo_url : "";
  const forceRefresh = Boolean(body.force_refresh);

  if (!repoUrl) {
    return routeError(400, "repo_url is required");
  }

  try {
    const job = await getOrCreateProgressiveJob(context, repoUrl, forceRefresh, { quickStart: true });
    const jobId = String(job.id);
    await enqueueRoadmapJobTask(context, {
      jobId,
      type: "bootstrap",
      chunkSize: 4,
    });
    const snapshot = await getRoadmapJobSnapshot(context.supabase, context.userId, jobId);
    if (!snapshot) {
      return routeError(404, "Roadmap generation job not found", "job_not_found");
    }

    return toJsonResponse({
      job_id: jobId,
      repo_full_name: String(job.repo_full_name ?? ""),
      status: snapshot.status,
      initial_timeline: snapshot.timeline,
      generated_stages: snapshot.generated_stages,
      total_planned_stages: snapshot.total_planned_stages,
      progress_percent: snapshot.progress_percent,
      current_phase: snapshot.current_phase,
      phase_message: snapshot.phase_message,
      quality_gate_status: snapshot.quality_gate_status,
      quality_fail_reasons: snapshot.quality_fail_reasons,
      failed_stage_ids: snapshot.failed_stage_ids,
      dedupe_score: snapshot.dedupe_score,
      grounding_score: snapshot.grounding_score,
      failed_stage_reports: snapshot.failed_stage_reports,
      quality_gate_metrics: snapshot.quality_gate_metrics,
      chunk_status: snapshot.chunk_status,
      queue_state: snapshot.queue_state,
      worker_attempts: snapshot.worker_attempts,
      last_worker_at: snapshot.last_worker_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Progressive roadmap generation failed";
    if (message.includes("Token budget is depleted")) {
      return routeError(429, message, "token_budget_exhausted");
    }
    if (message.includes("Connect GitHub")) {
      return routeError(403, message, "github_not_connected");
    }
    return routeError(502, message, "progressive_generation_failed");
  }
}

async function handleRoadmapJobStatus(context: AuthedRouteContext, jobId: string) {
  const snapshot = await getRoadmapJobSnapshot(context.supabase, context.userId, jobId);
  if (!snapshot) {
    return routeError(404, "Roadmap generation job not found", "job_not_found");
  }

  return toJsonResponse({
    status: snapshot.status,
    generated_stages: snapshot.generated_stages,
    total_planned_stages: snapshot.total_planned_stages,
    last_error: snapshot.last_error,
    updated_at: snapshot.updated_at,
    progress_percent: snapshot.progress_percent,
    current_phase: snapshot.current_phase,
    phase_message: snapshot.phase_message,
    quality_gate_status: snapshot.quality_gate_status,
    quality_fail_reasons: snapshot.quality_fail_reasons,
    failed_stage_ids: snapshot.failed_stage_ids,
    dedupe_score: snapshot.dedupe_score,
    grounding_score: snapshot.grounding_score,
    failed_stage_reports: snapshot.failed_stage_reports,
    quality_gate_metrics: snapshot.quality_gate_metrics,
    chunk_status: snapshot.chunk_status,
    queue_state: snapshot.queue_state,
    worker_attempts: snapshot.worker_attempts,
    last_worker_at: snapshot.last_worker_at,
  });
}

async function handleRoadmapJobContinue(context: AuthedRouteContext, jobId: string) {
  try {
    const existingSnapshot = await getRoadmapJobSnapshot(context.supabase, context.userId, jobId);
    if (!existingSnapshot) {
      return routeError(404, "Roadmap generation job not found", "job_not_found");
    }
    if (existingSnapshot.status === "completed") {
      return toJsonResponse({
        status: existingSnapshot.status,
        generated_stages: existingSnapshot.generated_stages,
        total_planned_stages: existingSnapshot.total_planned_stages,
        last_error: existingSnapshot.last_error,
        updated_at: existingSnapshot.updated_at,
        progress_percent: existingSnapshot.progress_percent,
        current_phase: existingSnapshot.current_phase,
        phase_message: existingSnapshot.phase_message,
        quality_gate_status: existingSnapshot.quality_gate_status,
        quality_fail_reasons: existingSnapshot.quality_fail_reasons,
        failed_stage_ids: existingSnapshot.failed_stage_ids,
        dedupe_score: existingSnapshot.dedupe_score,
        grounding_score: existingSnapshot.grounding_score,
        failed_stage_reports: existingSnapshot.failed_stage_reports,
        quality_gate_metrics: existingSnapshot.quality_gate_metrics,
        chunk_status: existingSnapshot.chunk_status,
        queue_state: existingSnapshot.queue_state,
        worker_attempts: existingSnapshot.worker_attempts,
        last_worker_at: existingSnapshot.last_worker_at,
      });
    }

    await enqueueRoadmapJobTask(context, {
      jobId,
      type: "hydrate_chunk",
      chunkSize: 3,
    });
    const snapshot = await getRoadmapJobSnapshot(context.supabase, context.userId, jobId);
    if (!snapshot) {
      return routeError(404, "Roadmap generation job not found", "job_not_found");
    }
    return toJsonResponse({
      status: snapshot.status,
      generated_stages: snapshot.generated_stages,
      total_planned_stages: snapshot.total_planned_stages,
      last_error: null,
      updated_at: new Date().toISOString(),
      progress_percent: snapshot.progress_percent,
      current_phase: snapshot.current_phase,
      phase_message: snapshot.phase_message,
      quality_gate_status: snapshot.quality_gate_status,
      quality_fail_reasons: snapshot.quality_fail_reasons,
      failed_stage_ids: snapshot.failed_stage_ids,
      dedupe_score: snapshot.dedupe_score,
      grounding_score: snapshot.grounding_score,
      failed_stage_reports: snapshot.failed_stage_reports,
      quality_gate_metrics: snapshot.quality_gate_metrics,
      chunk_status: snapshot.chunk_status,
      queue_state: snapshot.queue_state,
      worker_attempts: snapshot.worker_attempts,
      last_worker_at: snapshot.last_worker_at,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to continue roadmap generation";
    const snapshot = await getRoadmapJobSnapshot(context.supabase, context.userId, jobId);
    if (snapshot) {
      return toJsonResponse({
        status: snapshot.status,
        generated_stages: snapshot.generated_stages,
        total_planned_stages: snapshot.total_planned_stages,
        last_error: snapshot.last_error ?? detail,
        updated_at: snapshot.updated_at,
        progress_percent: snapshot.progress_percent,
        current_phase: snapshot.current_phase,
        phase_message: snapshot.phase_message,
        quality_gate_status: snapshot.quality_gate_status,
        quality_fail_reasons: snapshot.quality_fail_reasons,
        failed_stage_ids: snapshot.failed_stage_ids,
        dedupe_score: snapshot.dedupe_score,
        grounding_score: snapshot.grounding_score,
        failed_stage_reports: snapshot.failed_stage_reports,
        quality_gate_metrics: snapshot.quality_gate_metrics,
        chunk_status: "fail",
        queue_state: snapshot.queue_state,
        worker_attempts: snapshot.worker_attempts,
        last_worker_at: snapshot.last_worker_at,
      });
    }
    return routeError(detail.includes("not found") ? 404 : 502, detail, detail.includes("not found") ? "job_not_found" : "continue_generation_failed");
  }
}

async function handleRoadmapJobHydrateNext(context: AuthedRouteContext, jobId: string) {
  const body = await readJsonBody(context.req);
  const requestedChunkSize = Number(body.chunk_size ?? 3);
  const chunkSize = Number.isFinite(requestedChunkSize)
    ? Math.max(1, Math.min(8, Math.floor(requestedChunkSize)))
    : 3;
  try {
    await enqueueRoadmapJobTask(context, {
      jobId,
      type: "hydrate_chunk",
      chunkSize,
    });
    const snapshot = await getRoadmapJobSnapshot(context.supabase, context.userId, jobId);
    if (!snapshot) {
      return routeError(404, "Roadmap generation job not found", "job_not_found");
    }
    return toJsonResponse({
      status: snapshot.status,
      generated_stages: snapshot.generated_stages,
      total_planned_stages: snapshot.total_planned_stages,
      timeline: snapshot.timeline,
      updated_at: new Date().toISOString(),
      last_error: null,
      progress_percent: snapshot.progress_percent,
      current_phase: snapshot.current_phase,
      phase_message: snapshot.phase_message,
      quality_gate_status: snapshot.quality_gate_status,
      quality_fail_reasons: snapshot.quality_fail_reasons,
      failed_stage_ids: snapshot.failed_stage_ids,
      dedupe_score: snapshot.dedupe_score,
      grounding_score: snapshot.grounding_score,
      failed_stage_reports: snapshot.failed_stage_reports,
      quality_gate_metrics: snapshot.quality_gate_metrics,
      chunk_status: snapshot.chunk_status,
      queue_state: snapshot.queue_state,
      worker_attempts: snapshot.worker_attempts,
      last_worker_at: snapshot.last_worker_at,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to hydrate next roadmap chunk";
    const snapshot = await getRoadmapJobSnapshot(context.supabase, context.userId, jobId);
    if (snapshot) {
      return toJsonResponse({
        status: snapshot.status,
        generated_stages: snapshot.generated_stages,
        total_planned_stages: snapshot.total_planned_stages,
        timeline: snapshot.timeline,
        updated_at: snapshot.updated_at,
        last_error: snapshot.last_error ?? detail,
        progress_percent: snapshot.progress_percent,
        current_phase: snapshot.current_phase,
        phase_message: snapshot.phase_message,
        quality_gate_status: snapshot.quality_gate_status,
        quality_fail_reasons: snapshot.quality_fail_reasons,
        failed_stage_ids: snapshot.failed_stage_ids,
        dedupe_score: snapshot.dedupe_score,
        grounding_score: snapshot.grounding_score,
        failed_stage_reports: snapshot.failed_stage_reports,
        quality_gate_metrics: snapshot.quality_gate_metrics,
        chunk_status: "fail",
        queue_state: snapshot.queue_state,
        worker_attempts: snapshot.worker_attempts,
        last_worker_at: snapshot.last_worker_at,
      });
    }
    return routeError(detail.includes("not found") ? 404 : 502, detail, detail.includes("not found") ? "job_not_found" : "hydrate_next_failed");
  }
}

async function handleGenerateSyllabus(context: AuthedRouteContext) {
  const body = await readJsonBody(context.req);
  const repoUrl = typeof body.repo_url === "string" ? body.repo_url : "";
  const forceRefresh = Boolean(body.force_refresh);
  if (!repoUrl) {
    return routeError(400, "repo_url is required");
  }

  try {
    const job = await getOrCreateProgressiveJob(context, repoUrl, forceRefresh);
    const jobId = String(job.id);
    let snapshot = {
      status: String(job.status ?? "queued") as RoadmapGenerationJobStatus,
      generated_stages: Number(job.generated_stages ?? 0),
      total_planned_stages: Number(job.total_planned_stages ?? 0),
      timeline: Array.isArray(job.initial_timeline) ? job.initial_timeline : [],
      repo_full_name: String(job.repo_full_name),
    };

    if (snapshot.generated_stages === 0) {
      await enqueueRoadmapJobTask(context, {
        jobId,
        type: "bootstrap",
        chunkSize: 4,
      });
      const latestSnapshot = await getRoadmapJobSnapshot(context.supabase, context.userId, jobId);
      if (latestSnapshot) {
        snapshot = {
          status: latestSnapshot.status as RoadmapGenerationJobStatus,
          generated_stages: latestSnapshot.generated_stages,
          total_planned_stages: latestSnapshot.total_planned_stages,
          timeline: latestSnapshot.timeline,
          repo_full_name: String(job.repo_full_name),
        };
      }
    }

    const repoSummary = (job.repo_summary ?? {}) as Record<string, unknown>;
    const syllabusId = String(repoSummary.syllabus_id ?? "");
    const syllabusNodes = syllabusId ? await getSyllabusNodesById(context.supabase, syllabusId) : [];

    return toJsonResponse({
      job_id: jobId,
      repo_full_name: snapshot.repo_full_name,
      status: snapshot.status,
      syllabus: syllabusNodes,
      initial_stage_details: snapshot.timeline,
      generated_stage_count: snapshot.generated_stages,
      total_stage_count: snapshot.total_planned_stages,
      logical_stage_target: Number(repoSummary.logical_stage_target ?? snapshot.total_planned_stages),
      curriculum_mode: String(repoSummary.curriculum_mode ?? "single_track"),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to generate syllabus";
    return routeError(502, detail, "syllabus_generate_failed");
  }
}

async function handleGetSyllabus(context: RouteContext, owner: string, repo: string) {
  const repoFullName = `${owner}/${repo}`;
  const { data: cachedRoadmap } = await context.supabase
    .from("generated_roadmaps")
    .select("repo_full_name,job_state,last_generated_stage,timeline,repo_summary,generated_at")
    .eq("repo_full_name", repoFullName)
    .maybeSingle();

  const { data: latestSyllabus } = await context.supabase
    .from("roadmap_syllabi")
    .select("*")
    .eq("repo_full_name", repoFullName)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSyllabus) {
    return routeError(404, "Syllabus not found", "syllabus_not_found");
  }
  const nodes = await getSyllabusNodesById(context.supabase, String(latestSyllabus.id));

  return toJsonResponse({
    repo_full_name: repoFullName,
    syllabus: nodes,
    stage_target: Number(latestSyllabus.stage_target ?? nodes.length),
    logical_stage_target: Number(latestSyllabus.logical_stage_target ?? nodes.length),
    curriculum_mode: String(latestSyllabus.curriculum_mode ?? "single_track"),
    generated_stage_count: Number(cachedRoadmap?.last_generated_stage ?? 0),
    generated_at: String(cachedRoadmap?.generated_at ?? latestSyllabus.updated_at ?? new Date().toISOString()),
  });
}

async function handleHydrateSpecificStage(context: AuthedRouteContext, stageId: string) {
  const body = await readJsonBody(context.req);
  const jobId = typeof body.job_id === "string" ? body.job_id : "";
  if (!jobId) {
    return routeError(400, "job_id is required", "missing_job_id");
  }
  const stageIndexMatch = stageId.match(/^stage-(\d+)$/);
  if (!stageIndexMatch) {
    return routeError(400, "Invalid stage_id format", "invalid_stage_id");
  }
  const targetIndex = Number(stageIndexMatch[1]);
  if (!Number.isFinite(targetIndex) || targetIndex <= 0) {
    return routeError(400, "Invalid stage_id index", "invalid_stage_id");
  }

  try {
    let attempts = 0;
    while (attempts < 40) {
      const snapshot = await getRoadmapJobSnapshot(context.supabase, context.userId, jobId);
      if (!snapshot) {
        return routeError(404, "Roadmap generation job not found", "job_not_found");
      }
      const generated = Number(snapshot.generated_stages ?? 0);
      const status = snapshot.status as RoadmapGenerationJobStatus;
      if (generated >= targetIndex || status === "completed") {
        break;
      }
      if (status === "failed") {
        return routeError(502, snapshot.last_error ?? "Hydration failed", "stage_hydrate_failed");
      }
      if (!(snapshot.queue_state === "queued" || snapshot.queue_state === "processing")) {
        await enqueueRoadmapJobTask(context, {
          jobId,
          type: "hydrate_chunk",
          chunkSize: 3,
        });
      }
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    const { data: detailRow } = await context.supabase
      .from("roadmap_stage_details")
      .select("*")
      .eq("job_id", jobId)
      .eq("stage_id", stageId)
      .maybeSingle();
    if (!detailRow) {
      return routeError(404, "Stage detail not found", "stage_detail_not_found");
    }

    return toJsonResponse({
      job_id: jobId,
      stage_id: stageId,
      detail: detailRow.detail,
      quality_score: detailRow.quality_score,
      hydrated_at: detailRow.updated_at ?? detailRow.created_at,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to hydrate stage";
    return routeError(502, detail, "stage_hydrate_failed");
  }
}

function toTranslatableStagePayload(stage: Record<string, unknown>) {
  const tasks = Array.isArray(stage.tasks) ? stage.tasks : [];
  const resources = Array.isArray(stage.resources) ? stage.resources : [];
  const codeExamples = Array.isArray(stage.code_examples) ? stage.code_examples : [];
  return {
    stage_id: String(stage.id ?? ""),
    title: String(stage.title ?? ""),
    summary: String(stage.summary ?? ""),
    goals: Array.isArray(stage.goals) ? stage.goals.map((item) => String(item)) : [],
    prerequisites: Array.isArray(stage.prerequisites)
      ? stage.prerequisites.map((item) => String(item))
      : [],
    checkpoints: Array.isArray(stage.checkpoints)
      ? stage.checkpoints.map((item) => String(item))
      : [],
    tasks: tasks.map((task) => ({
      label: String((task as Record<string, unknown>).label ?? ""),
      steps: Array.isArray((task as Record<string, unknown>).steps)
        ? ((task as Record<string, unknown>).steps as unknown[]).map((item) => String(item))
        : [],
    })),
    resources: resources.map((resource) => ({
      label: String((resource as Record<string, unknown>).label ?? ""),
    })),
    code_examples: codeExamples.map((example) => ({
      description: String((example as Record<string, unknown>).description ?? ""),
    })),
  };
}

function buildStageSourceHash(stage: Record<string, unknown>) {
  return hashText(JSON.stringify(toTranslatableStagePayload(stage)));
}

function mergeTranslatedStage(
  original: Record<string, unknown>,
  translated: Record<string, unknown>,
) {
  const originalTasks = Array.isArray(original.tasks) ? original.tasks : [];
  const translatedTasks = Array.isArray(translated.tasks) ? translated.tasks : [];
  const mergedTasks = originalTasks.map((rawTask, index) => {
    const sourceTask = (rawTask && typeof rawTask === "object") ? (rawTask as Record<string, unknown>) : {};
    const translatedTask = (translatedTasks[index] && typeof translatedTasks[index] === "object")
      ? (translatedTasks[index] as Record<string, unknown>)
      : null;
    const translatedLabel = translatedTask && typeof translatedTask.label === "string"
      ? translatedTask.label.trim()
      : "";
    const translatedSteps = translatedTask && Array.isArray(translatedTask.steps)
      ? translatedTask.steps
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    return {
      ...sourceTask,
      label: translatedLabel || String(sourceTask.label ?? ""),
      steps: translatedSteps.length > 0
        ? translatedSteps
        : (Array.isArray(sourceTask.steps) ? sourceTask.steps : []),
      // Keep canonical files/commands executable.
      files: Array.isArray(sourceTask.files) ? sourceTask.files : [],
      commands: Array.isArray(sourceTask.commands) ? sourceTask.commands : [],
    };
  });

  const originalResources = Array.isArray(original.resources) ? original.resources : [];
  const translatedResources = Array.isArray(translated.resources) ? translated.resources : [];
  const mergedResources = originalResources.map((resource, index) => {
    const source = (resource && typeof resource === "object") ? (resource as Record<string, unknown>) : {};
    const translatedResource = (translatedResources[index] && typeof translatedResources[index] === "object")
      ? (translatedResources[index] as Record<string, unknown>)
      : null;
    return {
      ...source,
      label: translatedResource && typeof translatedResource.label === "string" && translatedResource.label.trim().length > 0
        ? translatedResource.label.trim()
        : String(source.label ?? ""),
    };
  });

  const originalExamples = Array.isArray(original.code_examples) ? original.code_examples : [];
  const translatedExamples = Array.isArray(translated.code_examples) ? translated.code_examples : [];
  const mergedExamples = originalExamples.map((example, index) => {
    const source = (example && typeof example === "object") ? (example as Record<string, unknown>) : {};
    const translatedExample = (translatedExamples[index] && typeof translatedExamples[index] === "object")
      ? (translatedExamples[index] as Record<string, unknown>)
      : null;
    return {
      ...source,
      description: translatedExample &&
          typeof translatedExample.description === "string" &&
          translatedExample.description.trim().length > 0
        ? translatedExample.description.trim()
        : String(source.description ?? ""),
    };
  });

  const translateArray = (value: unknown, fallback: unknown[]) => {
    if (!Array.isArray(value)) {
      return fallback;
    }
    const next = value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
    return next.length > 0 ? next : fallback;
  };

  return {
    ...original,
    title: typeof translated.title === "string" && translated.title.trim().length > 0
      ? translated.title.trim()
      : String(original.title ?? ""),
    summary: typeof translated.summary === "string" && translated.summary.trim().length > 0
      ? translated.summary.trim()
      : String(original.summary ?? ""),
    goals: translateArray(translated.goals, Array.isArray(original.goals) ? original.goals : []),
    prerequisites: translateArray(
      translated.prerequisites,
      Array.isArray(original.prerequisites) ? original.prerequisites : [],
    ),
    checkpoints: translateArray(
      translated.checkpoints,
      Array.isArray(original.checkpoints) ? original.checkpoints : [],
    ),
    tasks: mergedTasks,
    resources: mergedResources,
    code_examples: mergedExamples,
  };
}

function buildStageTranslationPrompt(
  targetLanguage: RoadmapTranslationLanguage,
  stages: Array<Record<string, unknown>>,
) {
  return `Translate the stage payloads to ${ROADMAP_TRANSLATION_LANGUAGE_LABELS[targetLanguage]}.

Rules:
- Preserve stage_id exactly.
- Keep technical meaning and beginner tone.
- Translate only natural-language text fields.
- Do not translate file paths, shell commands, package names, code snippets, or IDs.
- Return valid JSON only in this schema:
{
  "translated": [
    {
      "stage_id": "stage-1",
      "title": "...",
      "summary": "...",
      "goals": ["..."],
      "prerequisites": ["..."],
      "checkpoints": ["..."],
      "tasks": [{"label":"...","steps":["..."]}],
      "resources": [{"label":"..."}],
      "code_examples": [{"description":"..."}]
    }
  ]
}

Stage payloads:
${JSON.stringify(stages)}`;
}

async function handleTranslateStages(context: RouteContext) {
  const body = await readJsonBody(context.req);
  const repoFullName = typeof body.repo_full_name === "string" ? body.repo_full_name.trim() : "";
  const targetLanguage = normalizePreferredLanguage(body.target_language);
  const stageIds = Array.isArray(body.stage_ids)
    ? body.stage_ids
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim())
    : [];
  const sourceHashesRaw = (body.source_hashes && typeof body.source_hashes === "object")
    ? (body.source_hashes as Record<string, unknown>)
    : null;

  if (!repoFullName) {
    return routeError(400, "repo_full_name is required", "missing_repo_full_name");
  }
  if (stageIds.length === 0) {
    return routeError(400, "stage_ids is required", "missing_stage_ids");
  }

  const { data: roadmapRow, error: roadmapError } = await context.supabase
    .from("generated_roadmaps")
    .select("repo_full_name,timeline,is_catalog_visible")
    .eq("repo_full_name", repoFullName)
    .maybeSingle();

  if (roadmapError) {
    return routeError(500, roadmapError.message, "roadmap_lookup_failed");
  }
  if (!roadmapRow) {
    return routeError(404, "Roadmap not found", "roadmap_not_found");
  }

  if (!Boolean(roadmapRow.is_catalog_visible)) {
    let userId: string | null = null;
    try {
      userId = await getAuthedUserId(context.req, false);
    } catch {
      userId = null;
    }
    if (!userId) {
      return routeError(403, "Roadmap is private", "roadmap_private");
    }
    const { data: hasAccess } = await context.supabase
      .from("user_synced_repos")
      .select("repo_full_name")
      .eq("user_id", userId)
      .eq("repo_full_name", repoFullName)
      .eq("is_archived", false)
      .maybeSingle();
    if (!hasAccess) {
      return routeError(403, "Roadmap is private", "roadmap_private");
    }
  }

  const timeline = Array.isArray(roadmapRow.timeline)
    ? (roadmapRow.timeline as Array<Record<string, unknown>>)
    : [];
  const stageById = new Map(
    timeline
      .filter((stage) => stage && typeof stage.id === "string")
      .map((stage) => [String(stage.id), stage]),
  );
  const requestedStages = stageIds
    .map((stageId) => {
      const stage = stageById.get(stageId);
      if (!stage) {
        return null;
      }
      const sourceHashFromClient = sourceHashesRaw && typeof sourceHashesRaw[stageId] === "string"
        ? String(sourceHashesRaw[stageId])
        : null;
      const sourceHash = sourceHashFromClient && sourceHashFromClient.trim().length > 0
        ? sourceHashFromClient
        : buildStageSourceHash(stage);
      return {
        stageId,
        stage,
        sourceHash,
      };
    })
    .filter((item): item is { stageId: string; stage: Record<string, unknown>; sourceHash: string } => Boolean(item));

  if (requestedStages.length === 0) {
    return routeError(404, "No matching stages found", "stage_not_found");
  }

  const responseRows = requestedStages.map(({ stageId, stage, sourceHash }) => ({
    stage_id: stageId,
    source_hash: sourceHash,
    translated_payload: stage,
    quality_score: scoreStageQuality(stage),
    cache_hit: targetLanguage === "en",
  }));

  if (targetLanguage !== "en") {
    const { data: cachedRows } = await context.supabase
      .from("roadmap_stage_translations")
      .select("stage_id,source_hash,translated_payload,quality_score")
      .eq("repo_full_name", repoFullName)
      .eq("target_language", targetLanguage)
      .in("stage_id", requestedStages.map((item) => item.stageId));

    const cacheByStage = new Map<string, Record<string, unknown>>();
    for (const row of cachedRows ?? []) {
      cacheByStage.set(`${row.stage_id}::${row.source_hash}`, row as Record<string, unknown>);
    }

    const missingStages: Array<{
      stageId: string;
      sourceHash: string;
      stage: Record<string, unknown>;
    }> = [];

    for (let idx = 0; idx < requestedStages.length; idx += 1) {
      const item = requestedStages[idx];
      const cacheKey = `${item.stageId}::${item.sourceHash}`;
      const cached = cacheByStage.get(cacheKey);
      if (cached && cached.translated_payload && typeof cached.translated_payload === "object") {
        responseRows[idx] = {
          stage_id: item.stageId,
          source_hash: item.sourceHash,
          translated_payload: cached.translated_payload as Record<string, unknown>,
          quality_score: Number(cached.quality_score ?? scoreStageQuality(item.stage)),
          cache_hit: true,
        };
      } else {
        missingStages.push(item);
      }
    }

    if (missingStages.length > 0) {
      const translatedRowsToPersist: Array<Record<string, unknown>> = [];
      for (let offset = 0; offset < missingStages.length; offset += 3) {
        const batch = missingStages.slice(offset, offset + 3);
        const prompt = buildStageTranslationPrompt(
          targetLanguage,
          batch.map((item) => ({
            ...toTranslatableStagePayload(item.stage),
          })),
        );
        const result = await callGeminiJson({
          prompt,
          maxOutputTokens: 2200,
          responseMimeType: "application/json",
          temperature: 0.1,
          models: GEMINI_MODELS_TRANSLATE,
          retries: 1,
        });
        const translatedItems = Array.isArray(result.parsed.translated)
          ? result.parsed.translated
          : [];
        const translatedById = new Map<string, Record<string, unknown>>();
        for (const item of translatedItems) {
          if (item && typeof item === "object") {
            const row = item as Record<string, unknown>;
            const stageId = typeof row.stage_id === "string" ? row.stage_id : "";
            if (stageId) {
              translatedById.set(stageId, row);
            }
          }
        }

        for (const item of batch) {
          const translated = translatedById.get(item.stageId) ?? {};
          const merged = mergeTranslatedStage(item.stage, translated);
          const qualityScore = scoreStageQuality(merged);
          translatedRowsToPersist.push({
            repo_full_name: repoFullName,
            stage_id: item.stageId,
            target_language: targetLanguage,
            source_hash: item.sourceHash,
            translated_payload: merged,
            quality_score: qualityScore,
          });
          const rowIndex = responseRows.findIndex((row) => row.stage_id === item.stageId);
          if (rowIndex >= 0) {
            responseRows[rowIndex] = {
              stage_id: item.stageId,
              source_hash: item.sourceHash,
              translated_payload: merged,
              quality_score: qualityScore,
              cache_hit: false,
            };
          }
        }
      }

      if (translatedRowsToPersist.length > 0) {
        await context.supabase
          .from("roadmap_stage_translations")
          .upsert(translatedRowsToPersist, {
            onConflict: "repo_full_name,stage_id,target_language,source_hash",
          });
      }
    }
  }

  const translated = responseRows.map((row) => {
    const payload = row.translated_payload as Record<string, unknown>;
    return {
      stage_id: row.stage_id,
      title: String(payload.title ?? ""),
      summary: String(payload.summary ?? ""),
      goals: Array.isArray(payload.goals) ? payload.goals : [],
      prerequisites: Array.isArray(payload.prerequisites) ? payload.prerequisites : [],
      checkpoints: Array.isArray(payload.checkpoints) ? payload.checkpoints : [],
      tasks: Array.isArray(payload.tasks) ? payload.tasks : [],
      quality_score: Number(row.quality_score ?? scoreStageQuality(payload)),
      source_hash: String(row.source_hash),
    };
  });

  const cacheHits = responseRows.filter((row) => row.cache_hit).length;
  return toJsonResponse({
    repo_full_name: repoFullName,
    target_language: targetLanguage,
    translated,
    cache_hit_ratio: translated.length > 0 ? Number((cacheHits / translated.length).toFixed(3)) : 0,
  });
}

async function handleBugReport(context: AuthedRouteContext) {
  const body = await readJsonBody(context.req);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const routePath = typeof body.route_path === "string" ? body.route_path.trim() : "";
  const userAgent = typeof body.user_agent === "string" ? body.user_agent.trim() : "";

  if (!title || !description) {
    return routeError(400, "title and description are required", "invalid_bug_report");
  }

  const { error } = await context.supabase
    .from("bug_reports")
    .insert({
      user_id: context.userId,
      title: title.slice(0, 180),
      description: description.slice(0, 8000),
      route_path: routePath.slice(0, 500),
      user_agent: userAgent.slice(0, 500),
      status: "open",
      metadata: {
        source: "dashboard_modal",
      },
    });
  if (error) {
    return routeError(500, error.message, "bug_report_persist_failed");
  }

  return toNoContentResponse();
}

async function handleRoadmapView(context: RouteContext, owner: string, repo: string) {
  const fullName = `${owner}/${repo}`;
  let userId: string | null = null;
  try {
    userId = await getAuthedUserId(context.req, false);
  } catch {
    userId = null;
  }

  const incrementView = async () => {
    const { data: roadmap } = await context.supabase
      .from("generated_roadmaps")
      .select("view_count")
      .eq("repo_full_name", fullName)
      .maybeSingle();

    const nextCount = Number(roadmap?.view_count ?? 0) + 1;
    await context.supabase
      .from("generated_roadmaps")
      .update({ view_count: nextCount })
      .eq("repo_full_name", fullName);
  };

  if (!userId) {
    await incrementView();
    return toNoContentResponse();
  }

  const { data: tracker } = await context.supabase
    .from("roadmap_view_tracker")
    .select("id, viewed_at")
    .eq("repo_full_name", fullName)
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  if (!tracker) {
    await context.supabase
      .from("roadmap_view_tracker")
      .insert({ repo_full_name: fullName, user_id: userId, viewed_at: now.toISOString() });
    await incrementView();
    return toNoContentResponse();
  }

  const viewedAt = new Date(String(tracker.viewed_at));
  if (viewedAt <= dayAgo) {
    await context.supabase
      .from("roadmap_view_tracker")
      .update({ viewed_at: now.toISOString() })
      .eq("id", tracker.id);
    await incrementView();
  }

  return toNoContentResponse();
}

async function handleListUserRepos(context: AuthedRouteContext, archived = false) {
  const { data, error } = await context.supabase
    .from("user_synced_repos")
    .select("*")
    .eq("user_id", context.userId)
    .eq("is_archived", archived)
    .order("pinned_at", { ascending: false });

  if (error) {
    return routeError(500, error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const fullNames = rows.map((row) => String(row.repo_full_name));
  let roadmapMap = new Map<string, Record<string, unknown>>();

  if (fullNames.length > 0) {
    const { data: roadmaps } = await context.supabase
      .from("generated_roadmaps")
      .select("*")
      .in("repo_full_name", fullNames);

    roadmapMap = new Map((roadmaps ?? []).map((row) => [String(row.repo_full_name), row as Record<string, unknown>]));
  }

  const payload = rows.map((row) => {
    const fullName = String(row.repo_full_name);
    const roadmap = roadmapMap.get(fullName);
    return {
      repo_full_name: fullName,
      status: String(row.status ?? "synced"),
      is_archived: Boolean(row.is_archived),
      progress_percent: Number(row.progress_percent ?? 0),
      pinned_at: row.pinned_at,
      repo: roadmap ? buildRepoSummaryFromRow(roadmap) : null,
    };
  });

  return toJsonResponse(payload as unknown as JsonObject);
}

async function handleSyncRepo(context: AuthedRouteContext, owner: string, repo: string) {
  const fullName = `${owner}/${repo}`;

  const { data: roadmap } = await context.supabase
    .from("generated_roadmaps")
    .select("*")
    .eq("repo_full_name", fullName)
    .maybeSingle();

  if (!roadmap) {
    return routeError(404, "Roadmap has not been generated for this repository.");
  }

  const { data: existingState } = await context.supabase
    .from("user_synced_repos")
    .select("id")
    .eq("user_id", context.userId)
    .eq("repo_full_name", fullName)
    .maybeSingle();

  await context.supabase
    .from("user_synced_repos")
    .upsert(
      {
        user_id: context.userId,
        repo_full_name: fullName,
        status: "synced",
        is_archived: false,
        progress_percent: 0,
      },
      { onConflict: "user_id,repo_full_name" },
    );

  if (!existingState) {
    const nextSyncCount = Math.max(0, Number(roadmap.sync_count ?? 0) + 1);
    await context.supabase
      .from("generated_roadmaps")
      .update({ sync_count: nextSyncCount })
      .eq("repo_full_name", fullName);
  }

  const response = {
    repo_full_name: fullName,
    status: "synced",
    is_archived: false,
    progress_percent: 0,
    pinned_at: new Date().toISOString(),
    repo: buildRepoSummaryFromRow(roadmap as Record<string, unknown>),
  };

  return toJsonResponse(response as unknown as JsonObject);
}

async function handleDesyncRepo(context: AuthedRouteContext, owner: string, repo: string) {
  const fullName = `${owner}/${repo}`;

  const { data: roadmap } = await context.supabase
    .from("generated_roadmaps")
    .select("sync_count")
    .eq("repo_full_name", fullName)
    .maybeSingle();

  const { data: existingState } = await context.supabase
    .from("user_synced_repos")
    .select("id")
    .eq("user_id", context.userId)
    .eq("repo_full_name", fullName)
    .maybeSingle();

  await context.supabase
    .from("user_synced_repos")
    .delete()
    .eq("user_id", context.userId)
    .eq("repo_full_name", fullName);

  await context.supabase
    .from("guide_chat_sessions")
    .delete()
    .eq("user_id", context.userId)
    .eq("repo_full_name", fullName);

  if (existingState && roadmap) {
    const nextSyncCount = Math.max(0, Number(roadmap.sync_count ?? 0) - 1);
    await context.supabase
      .from("generated_roadmaps")
      .update({ sync_count: nextSyncCount })
      .eq("repo_full_name", fullName);
  }

  return toNoContentResponse();
}

async function handleArchiveRepo(context: AuthedRouteContext, owner: string, repo: string, archived: boolean) {
  const fullName = `${owner}/${repo}`;
  const { data: existingState } = await context.supabase
    .from("user_synced_repos")
    .select("*")
    .eq("user_id", context.userId)
    .eq("repo_full_name", fullName)
    .maybeSingle();

  if (!existingState) {
    return routeError(404, archived ? "Repository is not synced for this user." : "Repository is not archived for this user.");
  }

  await context.supabase
    .from("user_synced_repos")
    .update({ is_archived: archived, status: "synced" })
    .eq("user_id", context.userId)
    .eq("repo_full_name", fullName);

  const { data: roadmap } = await context.supabase
    .from("generated_roadmaps")
    .select("*")
    .eq("repo_full_name", fullName)
    .maybeSingle();

  const response = {
    repo_full_name: fullName,
    status: "synced",
    is_archived: archived,
    progress_percent: Number(existingState.progress_percent ?? 0),
    pinned_at: existingState.pinned_at,
    repo: roadmap ? buildRepoSummaryFromRow(roadmap as Record<string, unknown>) : null,
  };

  return toJsonResponse(response as unknown as JsonObject);
}

async function handleSetRating(context: AuthedRouteContext, owner: string, repo: string) {
  const fullName = `${owner}/${repo}`;
  const body = await readJsonBody(context.req);
  const rating = Number(body.rating ?? 0);
  if (!(Number.isFinite(rating) && rating >= 1 && rating <= 5)) {
    return routeError(400, "rating must be between 1 and 5");
  }

  const { data: ratingRow, error: ratingError } = await context.supabase
    .from("roadmap_ratings")
    .upsert(
      {
        user_id: context.userId,
        repo_full_name: fullName,
        rating,
      },
      { onConflict: "user_id,repo_full_name" },
    )
    .select("*")
    .single();

  if (ratingError) {
    return routeError(500, ratingError.message);
  }

  const { data: allRatings } = await context.supabase
    .from("roadmap_ratings")
    .select("rating")
    .eq("repo_full_name", fullName);

  const ratings = (allRatings ?? []).map((item) => Number(item.rating ?? 0)).filter((item) => Number.isFinite(item) && item > 0);
  const ratingCount = ratings.length;
  const ratingSum = ratings.reduce((acc, current) => acc + current, 0);

  await context.supabase
    .from("generated_roadmaps")
    .update({ rating_count: ratingCount, rating_sum: ratingSum })
    .eq("repo_full_name", fullName);

  return toJsonResponse(ratingRow as unknown as JsonObject);
}

async function handleGetRating(context: AuthedRouteContext, owner: string, repo: string) {
  const fullName = `${owner}/${repo}`;
  const { data, error } = await context.supabase
    .from("roadmap_ratings")
    .select("*")
    .eq("user_id", context.userId)
    .eq("repo_full_name", fullName)
    .maybeSingle();

  if (error) {
    return routeError(500, error.message);
  }

  return toJsonResponse((data ?? null) as unknown as JsonObject);
}

async function handleChat(context: RouteContext) {
  let userId: string | null = null;
  let planTier: PlanTier = "free";
  try {
    const auth = await getAuthContext(context.req, false);
    userId = auth.userId;
    planTier = auth.planTier;
  } catch {
    userId = null;
    planTier = "free";
  }

  const usageSnapshot = await resolveUsageMode(context.supabase, userId, planTier);
  if (usageSnapshot.mode === "critical") {
    return toTextResponse(`0:${JSON.stringify("Token budget is exhausted right now. Please try again later.")}\n`, 200, {
      "X-Vercel-AI-Data-Stream": "v1",
      "Cache-Control": "no-cache",
    });
  }

  if (!GEMINI_API_KEY) {
    return routeError(500, "Gemini API key not configured.");
  }

  const body = await readJsonBody(context.req);
  const repoFullName = typeof body.repo_full_name === "string" ? body.repo_full_name : "";
  const stageId = typeof body.stage_id === "string" ? body.stage_id : null;
  const preferredLanguage = normalizePreferredLanguage(body.preferred_language);

  const messages = Array.isArray(body.messages)
    ? body.messages.filter((message) => message && typeof message === "object")
    : [];

  const userQuery = (() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1] as Record<string, unknown>;
      return String(last.content ?? "").trim();
    }
    if (typeof body.message === "string") {
      return body.message.trim();
    }
    return "";
  })();

  if (!repoFullName || !userQuery) {
    return routeError(400, "repo_full_name and a user message are required.");
  }

  const inferredMessageLanguage = detectLikelyLanguage(userQuery);
  const responseLanguage = inferredMessageLanguage ?? preferredLanguage;

  const { data: roadmap } = await context.supabase
    .from("generated_roadmaps")
    .select("timeline,repo_summary")
    .eq("repo_full_name", repoFullName)
    .maybeSingle();

  if (!roadmap) {
    return toTextResponse(`0:${JSON.stringify("I don't have a roadmap for this repository yet. Please generate one first.")}\n`, 200, {
      "X-Vercel-AI-Data-Stream": "v1",
      "Cache-Control": "no-cache",
    });
  }

  const timeline = Array.isArray(roadmap.timeline) ? roadmap.timeline : [];
  const selectedStage = stageId
    ? timeline.find((stage) => stage && typeof stage === "object" && (stage as Record<string, unknown>).id === stageId)
    : null;
  let persistedStageDetail: Record<string, unknown> | null = null;
  if (stageId) {
    const { data: detailRow } = await context.supabase
      .from("roadmap_stage_details")
      .select("detail,quality_score")
      .eq("repo_full_name", repoFullName)
      .eq("stage_id", stageId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (detailRow?.detail && typeof detailRow.detail === "object") {
      persistedStageDetail = {
        ...(detailRow.detail as Record<string, unknown>),
        quality_score: Number(detailRow.quality_score ?? 0),
      };
    }
  }

  const roadmapSummary = selectedStage
    ? JSON.stringify({
      stage: selectedStage,
      persisted_detail: persistedStageDetail,
      instruction: "Answer using this stage context first.",
    })
    : JSON.stringify({
      repo: roadmap.repo_summary,
      stages: timeline.slice(0, 8),
    });

  const prompt = buildChatPrompt({
    repoName: repoFullName,
    roadmapSummary,
    userQuery,
    mode: usageSnapshot.mode,
    responseLanguage,
  });

  const maxOutputTokens = usageSnapshot.mode === "low" ? 768 : 1200;

  try {
    const result = await callGemini({
      prompt,
      maxOutputTokens,
      temperature: 0.35,
      models: GEMINI_MODELS_CHAT,
    });

    const responseText = extractGeminiText(result) || "I couldn't generate a response right now.";
    const usageMeta = extractUsageMetadata(result);

    const fallbackTokens = estimateTokenUsage(prompt) + estimateTokenUsage(responseText);
    await recordTokenUsage(context.supabase, {
      kind: "chat",
      userId,
      endpoint: "/api/v1/roadmap/chat",
      promptTokens: usageMeta.promptTokens || estimateTokenUsage(prompt),
      completionTokens: usageMeta.completionTokens || estimateTokenUsage(responseText),
      totalTokens: usageMeta.totalTokens || fallbackTokens,
      metadata: {
        repo_full_name: repoFullName,
        mode: usageSnapshot.mode,
        plan_tier: usageSnapshot.planTier,
        response_language: responseLanguage,
        global_remaining: usageSnapshot.globalUsage.remaining,
        user_remaining: usageSnapshot.userUsage.remaining,
      },
      userDailyLimit: usageSnapshot.userUsage.daily_limit,
    });

    return toTextResponse(`0:${JSON.stringify(responseText)}\n`, 200, {
      "X-Vercel-AI-Data-Stream": "v1",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
  } catch (error) {
    return toTextResponse(`0:${JSON.stringify(`Error: ${error instanceof Error ? error.message : "chat failed"}`)}\n`, 200, {
      "X-Vercel-AI-Data-Stream": "v1",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
  }
}

async function handleChatHistoryGet(context: AuthedRouteContext) {
  const repoFullName = context.url.searchParams.get("repo_full_name") ?? "";
  const stageId = context.url.searchParams.get("stage_id");

  if (!repoFullName) {
    return routeError(400, "repo_full_name is required");
  }

  let query = context.supabase
    .from("guide_chat_sessions")
    .select("repo_full_name,stage_id,messages")
    .eq("user_id", context.userId)
    .eq("repo_full_name", repoFullName);

  query = stageId ? query.eq("stage_id", stageId) : query.is("stage_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) {
    return routeError(500, error.message);
  }

  return toJsonResponse({
    repo_full_name: repoFullName,
    stage_id: stageId,
    messages: data?.messages ?? [],
  });
}

async function handleChatHistorySave(context: AuthedRouteContext) {
  const body = await readJsonBody(context.req);
  const repoFullName = typeof body.repo_full_name === "string" ? body.repo_full_name : "";
  const stageId = typeof body.stage_id === "string" ? body.stage_id : null;
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!repoFullName) {
    return routeError(400, "repo_full_name is required");
  }

  const { data: existing } = await context.supabase
    .from("guide_chat_sessions")
    .select("id")
    .eq("user_id", context.userId)
    .eq("repo_full_name", repoFullName)
    [stageId ? "eq" : "is"]("stage_id", stageId as never)
    .maybeSingle();

  if (existing) {
    const { error } = await context.supabase
      .from("guide_chat_sessions")
      .update({ messages })
      .eq("id", existing.id);

    if (error) {
      return routeError(500, error.message);
    }
  } else {
    const { error } = await context.supabase
      .from("guide_chat_sessions")
      .insert({
        user_id: context.userId,
        repo_full_name: repoFullName,
        stage_id: stageId,
        messages,
      });

    if (error) {
      return routeError(500, error.message);
    }
  }

  return toNoContentResponse();
}

async function createOAuthState(supabase: SupabaseClient, userId: string, redirect: string | null) {
  const random = crypto.getRandomValues(new Uint8Array(24));
  const state = btoa(String.fromCharCode(...random)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabase
    .from("github_oauth_states")
    .insert({
      state,
      user_id: userId,
      redirect,
      expires_at: expiresAt,
    });

  return state;
}

function buildGitHubAuthorizeUrl(state: string) {
  if (!GITHUB_OAUTH_CLIENT_ID) {
    throw new Error("GitHub OAuth client ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: GITHUB_OAUTH_CLIENT_ID,
    scope: GITHUB_OAUTH_SCOPE,
    state,
  });

  if (GITHUB_OAUTH_REDIRECT_URI) {
    params.set("redirect_uri", GITHUB_OAUTH_REDIRECT_URI);
  }

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

async function exchangeGitHubCode(code: string) {
  if (!(GITHUB_OAUTH_CLIENT_ID && GITHUB_OAUTH_CLIENT_SECRET)) {
    throw new Error("GitHub OAuth credentials are not configured");
  }

  const body = new URLSearchParams({
    client_id: GITHUB_OAUTH_CLIENT_ID,
    client_secret: GITHUB_OAUTH_CLIENT_SECRET,
    code,
  });

  if (GITHUB_OAUTH_REDIRECT_URI) {
    body.set("redirect_uri", GITHUB_OAUTH_REDIRECT_URI);
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub token exchange failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  if (!payload.access_token || typeof payload.access_token !== "string") {
    throw new Error("GitHub did not return an access token");
  }

  return {
    access_token: payload.access_token,
    token_type: typeof payload.token_type === "string" ? payload.token_type : "bearer",
    scope: typeof payload.scope === "string" ? payload.scope : GITHUB_OAUTH_SCOPE,
  };
}

async function fetchGitHubUser(accessToken: string) {
  return await githubRequest<Record<string, unknown>>("/user", accessToken);
}

async function handleGitHubOAuthStart(context: AuthedRouteContext) {
  const body = await readJsonBody(context.req);
  const returnTo = typeof body.return_to === "string" ? body.return_to : null;

  const state = await createOAuthState(context.supabase, context.userId, returnTo);
  const authorizeUrl = buildGitHubAuthorizeUrl(state);

  return toJsonResponse({ authorize_url: authorizeUrl });
}

async function handleGitHubOAuthStatus(context: AuthedRouteContext) {
  const { data } = await context.supabase
    .from("github_credentials")
    .select("github_login,github_avatar_url")
    .eq("clerk_user_id", context.userId)
    .maybeSingle();

  if (!data) {
    return toJsonResponse({ connected: false, github_login: null, avatar_url: null });
  }

  return toJsonResponse({
    connected: true,
    github_login: data.github_login,
    avatar_url: data.github_avatar_url,
  });
}

async function handleGitHubOAuthDelete(context: AuthedRouteContext) {
  await context.supabase
    .from("github_credentials")
    .delete()
    .eq("clerk_user_id", context.userId);

  return toNoContentResponse();
}

function mapOAuthCallbackErrorCode(rawMessage: string) {
  const message = rawMessage.toLowerCase();
  if (message.includes("redirect_uri")) {
    return "redirect_uri_mismatch";
  }
  if (message.includes("state")) {
    return "invalid_state";
  }
  if (message.includes("unauthorized party")) {
    return "unauthorized_party";
  }
  return "oauth_callback_failed";
}

function buildOAuthErrorRedirect(target: string, code: string, detail: string) {
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}status=error&error=${encodeURIComponent(code)}&detail=${encodeURIComponent(detail)}`;
}

async function handleGitHubOAuthCallback(context: RouteContext) {
  const state = context.url.searchParams.get("state") ?? "";
  const code = context.url.searchParams.get("code") ?? "";
  const fallbackRedirect = GITHUB_OAUTH_SUCCESS_REDIRECT || "/";

  if (!(state && code)) {
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: buildOAuthErrorRedirect(fallbackRedirect, "invalid_request", "state and code are required"),
      },
    });
  }

  const now = new Date().toISOString();
  const { data: stateRow, error: stateError } = await context.supabase
    .from("github_oauth_states")
    .select("state,user_id,redirect,expires_at")
    .eq("state", state)
    .gt("expires_at", now)
    .maybeSingle();

  if (stateError || !stateRow) {
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: buildOAuthErrorRedirect(fallbackRedirect, "invalid_state", "Invalid or expired OAuth state"),
      },
    });
  }

  try {
    const tokenPayload = await exchangeGitHubCode(code);
    const userPayload = await fetchGitHubUser(tokenPayload.access_token);

    const credential = {
      clerk_user_id: stateRow.user_id,
      access_token: tokenPayload.access_token,
      token_type: tokenPayload.token_type,
      scope: tokenPayload.scope,
      github_user_id: Number(userPayload.id ?? 0),
      github_login: String(userPayload.login ?? "unknown"),
      github_avatar_url: String(userPayload.avatar_url ?? ""),
      github_name: String(userPayload.name ?? ""),
    };

    await context.supabase
      .from("github_credentials")
      .upsert(credential, { onConflict: "clerk_user_id" });

    await context.supabase
      .from("github_oauth_states")
      .delete()
      .eq("state", state);

    const redirectTarget = stateRow.redirect || GITHUB_OAUTH_SUCCESS_REDIRECT || "/";
    const separator = redirectTarget.includes("?") ? "&" : "?";

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${redirectTarget}${separator}status=success`,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "OAuth callback failed";
    const errorCode = mapOAuthCallbackErrorCode(detail);
    const redirectTarget = stateRow.redirect || fallbackRedirect;
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: buildOAuthErrorRedirect(redirectTarget, errorCode, detail),
      },
    });
  }
}

async function handleAuthPing(context: AuthedRouteContext) {
  return toJsonResponse({
    status: "ok",
    user_id: context.userId,
  });
}

async function withAuth(context: RouteContext, handler: (authedContext: AuthedRouteContext) => Promise<Response>) {
  try {
    const auth = await getAuthContext(context.req, true);
    if (!auth.userId || !auth.payload) {
      throw new Error("User ID missing in token");
    }
    return await handler({
      ...context,
      userId: auth.userId,
      planTier: auth.planTier,
      authPayload: auth.payload,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid authentication token";
    return routeError(401, detail, mapAuthErrorCode(detail));
  }
}

function extractOwnerRepo(path: string, prefix: string) {
  const match = path.match(new RegExp(`^${prefix}/([^/]+)/([^/]+)$`));
  if (!match) {
    return null;
  }
  return { owner: decodeURIComponent(match[1]), repo: decodeURIComponent(match[2]) };
}

export type ApiScope =
  | "all"
  | "roadmap"
  | "chat"
  | "github"
  | "user"
  | "feedback"
  | "admin"
  | "worker";

const SCOPE_PREFIXES: Record<Exclude<ApiScope, "all">, string[]> = {
  roadmap: [
    "/api/v1/roadmap/",
  ],
  chat: [
    "/api/v1/roadmap/chat",
  ],
  github: [
    "/api/v1/github/",
  ],
  user: [
    "/api/v1/preferences",
    "/api/v1/usage/global",
    "/api/v1/auth/ping",
  ],
  feedback: [
    "/api/v1/waitlist",
    "/api/v1/feedback/",
  ],
  admin: [
    "/api/v1/admin/",
  ],
  worker: [
    "/api/v1/internal/worker/",
  ],
};

function scopeAllowsPath(scope: ApiScope, path: string) {
  if (scope === "all") {
    return true;
  }
  const prefixes = SCOPE_PREFIXES[scope];
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

export async function handleApiRequest(req: Request, scope: ApiScope = "all") {
  if (req.method === "OPTIONS") {
    return toNoContentResponse();
  }

  let supabase: SupabaseClient;
  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    return routeError(500, error instanceof Error ? error.message : "Supabase is not configured");
  }

  const url = new URL(req.url);
  const path = normalizePath(extractApiPath(url.pathname));
  if (!scopeAllowsPath(scope, path)) {
    return routeError(404, `No route found for ${req.method} ${path}`);
  }

  const context: RouteContext = {
    supabase,
    req,
    path,
    url,
  };

  try {
    if (path === "/api/v1/waitlist/count" && req.method === "GET") {
      return await handleWaitlistCount(context);
    }
    if (path === "/api/v1/waitlist" && req.method === "POST") {
      return await handleWaitlistJoin(context);
    }
    if (path === "/api/v1/usage/global" && req.method === "GET") {
      return await handleUsageGlobal(context);
    }
    if (path === "/api/v1/internal/worker/drain" && req.method === "POST") {
      return await handleInternalWorkerDrain(context);
    }
    if (path === "/api/v1/admin/catalog/soft-reset" && req.method === "POST") {
      return await handleAdminCatalogSoftReset(context);
    }
    if (path === "/api/v1/admin/catalog/hide-repo" && req.method === "POST") {
      return await handleAdminCatalogHideRepo(context);
    }
    if (path === "/api/v1/admin/stage-regen-flags" && req.method === "GET") {
      return await handleAdminListStageRegenFlags(context);
    }
    if (path === "/api/v1/preferences" && req.method === "GET") {
      return await withAuth(context, handleGetPreferences);
    }
    if (path === "/api/v1/preferences" && (req.method === "PUT" || req.method === "PATCH")) {
      return await withAuth(context, handleUpsertPreferences);
    }
    if (path === "/api/v1/roadmap/catalog" && req.method === "GET") {
      return await handleCatalog(context);
    }
    if (path === "/api/v1/roadmap/generate" && req.method === "POST") {
      return await withAuth(context, handleGenerateRoadmap);
    }
    if (path === "/api/v1/roadmap/generate/stream" && req.method === "GET") {
      return await withAuth(context, handleGenerateRoadmapStream);
    }
    if (path === "/api/v1/roadmap/generate-progressive" && req.method === "POST") {
      return await withAuth(context, handleGenerateRoadmapProgressive);
    }
    if (path === "/api/v1/roadmap/syllabus/generate" && req.method === "POST") {
      return await withAuth(context, handleGenerateSyllabus);
    }
    if (path === "/api/v1/roadmap/user-repos" && req.method === "GET") {
      return await withAuth(context, (authContext) => handleListUserRepos(authContext, false));
    }
    if (path === "/api/v1/roadmap/archived" && req.method === "GET") {
      return await withAuth(context, (authContext) => handleListUserRepos(authContext, true));
    }
    if (path === "/api/v1/roadmap/chat" && req.method === "POST") {
      return await handleChat(context);
    }
    if (path === "/api/v1/roadmap/translate-stages" && req.method === "POST") {
      return await handleTranslateStages(context);
    }
    if (path === "/api/v1/roadmap/chat/history" && req.method === "GET") {
      return await withAuth(context, handleChatHistoryGet);
    }
    if (path === "/api/v1/roadmap/chat/history" && req.method === "POST") {
      return await withAuth(context, handleChatHistorySave);
    }
    if (path === "/api/v1/feedback/bug" && req.method === "POST") {
      return await withAuth(context, handleBugReport);
    }
    if (path === "/api/v1/github/oauth/start" && req.method === "POST") {
      return await withAuth(context, handleGitHubOAuthStart);
    }
    if (path === "/api/v1/github/oauth/status" && req.method === "GET") {
      return await withAuth(context, handleGitHubOAuthStatus);
    }
    if (path === "/api/v1/github/oauth/token" && req.method === "DELETE") {
      return await withAuth(context, handleGitHubOAuthDelete);
    }
    if (path === "/api/v1/github/oauth/callback" && req.method === "GET") {
      return await handleGitHubOAuthCallback(context);
    }
    if (path === "/api/v1/auth/ping" && req.method === "GET") {
      return await withAuth(context, handleAuthPing);
    }

    const cachedMatch = extractOwnerRepo(path, "\\/api\\/v1\\/roadmap\\/cached");
    if (cachedMatch && req.method === "GET") {
      return await handleGetCachedRoadmap(context, cachedMatch.owner, cachedMatch.repo);
    }

    const syllabusMatch = extractOwnerRepo(path, "\\/api\\/v1\\/roadmap\\/syllabus");
    if (syllabusMatch && req.method === "GET") {
      return await handleGetSyllabus(context, syllabusMatch.owner, syllabusMatch.repo);
    }

    const syncMatch = extractOwnerRepo(path, "\\/api\\/v1\\/roadmap\\/sync");
    if (syncMatch && req.method === "POST") {
      return await withAuth(context, (authContext) => handleSyncRepo(authContext, syncMatch.owner, syncMatch.repo));
    }
    if (syncMatch && req.method === "DELETE") {
      return await withAuth(context, (authContext) => handleDesyncRepo(authContext, syncMatch.owner, syncMatch.repo));
    }

    const archiveMatch = extractOwnerRepo(path, "\\/api\\/v1\\/roadmap\\/archive");
    if (archiveMatch && req.method === "POST") {
      return await withAuth(context, (authContext) => handleArchiveRepo(authContext, archiveMatch.owner, archiveMatch.repo, true));
    }

    const unarchiveMatch = extractOwnerRepo(path, "\\/api\\/v1\\/roadmap\\/unarchive");
    if (unarchiveMatch && req.method === "POST") {
      return await withAuth(context, (authContext) => handleArchiveRepo(authContext, unarchiveMatch.owner, unarchiveMatch.repo, false));
    }

    // Route helper above cannot express nested suffix. Handle explicit regex below.
    const ratingPathMatch = path.match(/^\/api\/v1\/roadmap\/([^/]+)\/([^/]+)\/rating$/);
    if (ratingPathMatch && req.method === "POST") {
      const owner = decodeURIComponent(ratingPathMatch[1]);
      const repo = decodeURIComponent(ratingPathMatch[2]);
      return await withAuth(context, (authContext) => handleSetRating(authContext, owner, repo));
    }
    if (ratingPathMatch && req.method === "GET") {
      const owner = decodeURIComponent(ratingPathMatch[1]);
      const repo = decodeURIComponent(ratingPathMatch[2]);
      return await withAuth(context, (authContext) => handleGetRating(authContext, owner, repo));
    }

    const viewPathMatch = path.match(/^\/api\/v1\/roadmap\/([^/]+)\/([^/]+)\/view$/);
    if (viewPathMatch && req.method === "POST") {
      const owner = decodeURIComponent(viewPathMatch[1]);
      const repo = decodeURIComponent(viewPathMatch[2]);
      return await handleRoadmapView(context, owner, repo);
    }

    const jobStatusMatch = path.match(/^\/api\/v1\/roadmap\/jobs\/([^/]+)$/);
    if (jobStatusMatch && req.method === "GET") {
      const jobId = decodeURIComponent(jobStatusMatch[1]);
      return await withAuth(context, (authContext) => handleRoadmapJobStatus(authContext, jobId));
    }

    const jobContinueMatch = path.match(/^\/api\/v1\/roadmap\/jobs\/([^/]+)\/continue$/);
    if (jobContinueMatch && req.method === "POST") {
      const jobId = decodeURIComponent(jobContinueMatch[1]);
      return await withAuth(context, (authContext) => handleRoadmapJobContinue(authContext, jobId));
    }

    const jobHydrateNextMatch = path.match(/^\/api\/v1\/roadmap\/jobs\/([^/]+)\/hydrate-next$/);
    if (jobHydrateNextMatch && req.method === "POST") {
      const jobId = decodeURIComponent(jobHydrateNextMatch[1]);
      return await withAuth(context, (authContext) => handleRoadmapJobHydrateNext(authContext, jobId));
    }

    const stageHydrateMatch = path.match(/^\/api\/v1\/roadmap\/stages\/([^/]+)\/hydrate$/);
    if (stageHydrateMatch && req.method === "POST") {
      const stageId = decodeURIComponent(stageHydrateMatch[1]);
      return await withAuth(context, (authContext) => handleHydrateSpecificStage(authContext, stageId));
    }

    const stageRegenFlagMatch = path.match(/^\/api\/v1\/roadmap\/stages\/([^/]+)\/flag-regenerate$/);
    if (stageRegenFlagMatch && req.method === "POST") {
      const stageId = decodeURIComponent(stageRegenFlagMatch[1]);
      return await withAuth(context, (authContext) => handleFlagStageForRegeneration(authContext, stageId));
    }

    const adminStageRegenApproveMatch = path.match(/^\/api\/v1\/admin\/stage-regen-flags\/([^/]+)\/approve$/);
    if (adminStageRegenApproveMatch && req.method === "POST") {
      const flagId = decodeURIComponent(adminStageRegenApproveMatch[1]);
      return await handleAdminApproveStageRegenFlag(context, flagId);
    }

    const adminStageRegenRejectMatch = path.match(/^\/api\/v1\/admin\/stage-regen-flags\/([^/]+)\/reject$/);
    if (adminStageRegenRejectMatch && req.method === "POST") {
      const flagId = decodeURIComponent(adminStageRegenRejectMatch[1]);
      return await handleAdminRejectStageRegenFlag(context, flagId);
    }

    return routeError(404, `No route found for ${req.method} ${path}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unexpected server error";
    return routeError(500, detail);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleApiRequest(req, "all"));
}
