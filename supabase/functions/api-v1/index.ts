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
};

type UserSoftUsage = {
  daily_limit: number;
  used: number;
  remaining: number;
  reset_at: string;
};

type RoadmapGenerationJobStatus = "queued" | "running" | "partial_ready" | "completed" | "failed";
type RoadmapGenerationPhase = "ingest" | "syllabus" | "hydrate" | "validate" | "persist" | "complete";
type RoadmapTranslationLanguage = "en" | "zh-HK" | "kz" | "ru";

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
  };
  readmeExcerpt: string;
  complexity: CurriculumComplexity;
  stageTarget: number;
  logicalStageTarget: number;
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
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-pro-preview";
const GEMINI_REQUEST_TIMEOUT_MS = Number(Deno.env.get("GEMINI_REQUEST_TIMEOUT_MS") ?? "45000");
const GITHUB_REQUEST_TIMEOUT_MS = Number(Deno.env.get("GITHUB_REQUEST_TIMEOUT_MS") ?? "25000");
const GEMINI_MODEL_CANDIDATES = Array.from(
  new Set(
    [
      GEMINI_MODEL,
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite-preview",
    ].filter((model) => typeof model === "string" && model.trim().length > 0),
  ),
);
const GEMINI_MODELS_PLANNER = ["gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite-preview"];
const GEMINI_MODELS_HYDRATOR = ["gemini-3-flash-preview", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview"];
const GEMINI_MODELS_REPAIR = ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", "gemini-3.1-pro-preview"];
const GEMINI_MODELS_CHAT = ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", "gemini-3.1-pro-preview"];
const GEMINI_MODELS_TRANSLATE = ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", "gemini-3.1-pro-preview"];
const ADMIN_CATALOG_SECRET = Deno.env.get("ADMIN_CATALOG_SECRET") ?? "";

const GLOBAL_DAILY_TOKEN_LIMIT = Number(Deno.env.get("GLOBAL_DAILY_TOKEN_LIMIT") ?? "2500000");
const USER_DAILY_TOKEN_SOFT_LIMIT = Number(Deno.env.get("USER_DAILY_TOKEN_SOFT_LIMIT") ?? "120000");
const CURRICULUM_PIPELINE_VERSION = "v2";
const ROADMAP_TRANSLATION_LANGUAGES: RoadmapTranslationLanguage[] = ["en", "zh-HK", "kz", "ru"];
const ROADMAP_TRANSLATION_LANGUAGE_LABELS: Record<RoadmapTranslationLanguage, string> = {
  en: "English",
  "zh-HK": "Cantonese (Traditional Chinese, Hong Kong)",
  kz: "Kazakh",
  ru: "Russian",
};

const jwks = CLERK_JWKS_URL ? createRemoteJWKSet(new URL(CLERK_JWKS_URL)) : null;

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

function toJsonResponse(payload: JsonObject, status = 200, extraHeaders: HeadersInit = {}) {
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

async function getAuthedUserId(req: Request, required = true) {
  const token = getBearerToken(req);
  if (!token) {
    if (required) {
      throw new Error("Missing authentication token");
    }
    return null;
  }

  const payload = await verifyClerkToken(token);
  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId && required) {
    throw new Error("User ID missing in token");
  }
  return userId;
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

function computeCurriculumComplexity(options: {
  repoSizeKb: number;
  commitSampleCount: number;
  fileCount: number;
  topLevelDirCount: number;
  manifestCount: number;
  clusterCount: number;
}): CurriculumComplexity {
  const {
    repoSizeKb,
    commitSampleCount,
    fileCount,
    topLevelDirCount,
    manifestCount,
    clusterCount,
  } = options;
  const rawScore =
    (Math.log10(Math.max(repoSizeKb, 1)) * 8) +
    (commitSampleCount * 0.35) +
    (fileCount * 0.018) +
    (topLevelDirCount * 1.1) +
    (manifestCount * 2.4) +
    (clusterCount * 1.3);
  const score = Number(rawScore.toFixed(2));
  const logicalStageTarget = Math.max(10, Math.min(1000, Math.round(10 + rawScore * 1.75)));
  const stageTarget = Math.max(10, Math.min(48, Math.round(8 + rawScore * 0.45)));
  const mode: CurriculumComplexity["mode"] = logicalStageTarget > 160 ? "multi_track" : "single_track";
  return {
    score,
    logicalStageTarget,
    stageTarget,
    mode,
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
      },
      readmeExcerpt: String(existingSnapshot.readme_excerpt ?? ""),
      complexity: {
        score: Number(cachedComplexity.score ?? 0),
        logicalStageTarget: Number(cachedComplexity.logical_stage_target ?? Number(existingSnapshot.logical_stage_target ?? 10)),
        stageTarget: Number(cachedComplexity.stage_target ?? Number(existingSnapshot.stage_target ?? 10)),
        mode: String(cachedComplexity.mode ?? "single_track") as CurriculumComplexity["mode"],
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

  let readmeExcerpt = "";
  try {
    const readmeRaw = await githubRequestRaw(`/repos/${identity.fullName}/readme`, githubToken);
    readmeExcerpt = compactReadme(readmeRaw);
  } catch {
    readmeExcerpt = "";
  }

  const commitClusters = summarizeCommitClusters(commitContextLines);
  const complexity = computeCurriculumComplexity({
    repoSizeKb: Number(repo.size ?? 0),
    commitSampleCount: commitContextLines.length,
    fileCount: filePaths.length,
    topLevelDirCount: topLevelDirs.length,
    manifestCount: manifests.length,
    clusterCount: commitClusters.length,
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
    topics: Array.isArray(repo.topics) ? repo.topics : [],
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
      },
      readme_excerpt: readmeExcerpt,
      complexity: {
        score: complexity.score,
        logical_stage_target: logicalStageTarget,
        stage_target: stageTarget,
        mode: complexity.mode,
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
}) {
  const nodeLines = options.nodes
    .map((node) =>
      `- ${node.id} ${node.title}\n  summary: ${node.summary}\n  goals: ${node.goals.join(" | ") || "N/A"}\n  checkpoints: ${node.checkpoints.join(" | ") || "N/A"}\n  optional_peeks: ${node.optional_peeks.join(" | ") || "none"}`,
    )
    .join("\n");
  const clusterLines = options.commitClusters
    .slice(0, 8)
    .map((cluster) => `${cluster.theme}: ${cluster.samples.slice(0, 3).join(" | ")}`)
    .join("\n");

  return `You are Commitly Stage Hydrator.

Hydrate the following syllabus stages into actionable beginner tasks.
Repository: ${options.repoName}
Readme context:
${options.readmeExcerpt || "N/A"}

Commit theme references:
${clusterLines || "N/A"}

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
}) {
  const nodeLines = options.nodes
    .map((node) =>
      `- ${node.id} (${node.index}) ${node.title}\n  summary: ${node.summary}\n  goals: ${node.goals.join(" | ") || "N/A"}\n  checkpoints: ${node.checkpoints.join(" | ") || "N/A"}`,
    )
    .join("\n");
  const clusterLines = options.commitClusters
    .slice(0, 8)
    .map((cluster) => `${cluster.theme}: ${cluster.samples.slice(0, 2).join(" | ")}`)
    .join("\n");

  return `You are Commitly Stage Repair engine.

Generate replacement stage details ONLY for the stages listed below.
Repository: ${options.repoName}
Readme context:
${options.readmeExcerpt || "N/A"}

Commit theme references:
${clusterLines || "N/A"}

Stages requiring repair:
${nodeLines}

Hard rules:
1) Never mention clone/fork/copying source.
2) Learner starts from an empty workspace.
3) Each stage must include 3-6 concrete tasks.
4) Every task requires label, steps(2-8), files(real paths), commands(runnable).
5) Avoid placeholders like "Stage 2", "inspect code", "review existing implementation".
6) Include explicit checkpoints.

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

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = cleaned.slice(firstBrace, lastBrace + 1).trim();
      return JSON.parse(sliced) as Record<string, unknown>;
    }
    throw new Error("Gemini returned malformed JSON");
  }
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
}) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const modelCandidates = Array.isArray(options.models) && options.models.length > 0
    ? Array.from(new Set(options.models.filter((model) => typeof model === "string" && model.trim().length > 0)))
    : GEMINI_MODEL_CANDIDATES;
  let lastError: Error | null = null;
  for (const model of modelCandidates) {
    const timeoutMs = Number.isFinite(GEMINI_REQUEST_TIMEOUT_MS) ? Math.max(12_000, GEMINI_REQUEST_TIMEOUT_MS) : 45_000;
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
    if (response.status !== 404) {
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
}) {
  const retries = Math.max(0, Math.floor(options.retries ?? 2));
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
    });
    addUsage(payload);

    try {
      const parsed = parseGeminiJsonResponse(payload);
      return { payload, parsed, usage: usageTotals };
    } catch (error) {
      const raw = extractGeminiText(payload);
      if (raw.length > 0) {
        const repairPayload = await callGemini({
          prompt:
            `Repair the following malformed JSON and return only valid JSON with identical structure and meaning.\n\n${raw}`,
          maxOutputTokens: options.maxOutputTokens,
          responseMimeType: "application/json",
          temperature: 0,
          models: options.models,
        });
        addUsage(repairPayload);
        try {
          const repaired = parseGeminiJsonResponse(repairPayload);
          return { payload: repairPayload, parsed: repaired, usage: usageTotals };
        } catch {
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
  await supabase
    .from("roadmap_generation_jobs")
    .update(payload)
    .eq("id", jobId);
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

function sanitizeTaskFiles(files: unknown, fallbackBasePath: string) {
  const rawFiles = Array.isArray(files)
    ? files.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const normalized = rawFiles
    .map((item) => item.trim().replace(/^\.\//, ""))
    .filter((item) => !containsForbiddenCloneInstruction(item))
    .slice(0, 6);
  if (normalized.length > 0) {
    return normalized;
  }
  return [`${fallbackBasePath}/index.ts`, `${fallbackBasePath}/README.md`];
}

function validateHydratedStageQuality(stage: Record<string, unknown>, node: RoadmapSyllabusNode) {
  const fallbackBasePath = `app/stage-${node.index}`;
  const issues: string[] = [];
  const titleText = String(stage.title ?? node.title ?? "").trim();
  const rawTasks = Array.isArray(stage.tasks) ? stage.tasks : [];
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
      const commands = commandsRaw
        .map((item) => sanitizeInstructionText(item))
        .filter((item) => !containsForbiddenCloneInstruction(item))
        .slice(0, 6);
      const files = sanitizeTaskFiles(task.files, fallbackBasePath);
      if (steps.length < 2) {
        return null;
      }
      return {
        label: label || `Build ${node.title}`,
        steps,
        files,
        commands: commands.length > 0 ? commands : ["npm run dev"],
      };
    })
    .filter((task): task is { label: string; steps: string[]; files: string[]; commands: string[] } => Boolean(task));

  const stageText = JSON.stringify(stage);
  const cloneFree = !containsForbiddenCloneInstruction(stageText.toLowerCase());
  if (!cloneFree) {
    issues.push("contains forbidden clone/copy instructions");
  }
  if (!titleText || /^stage\s*\d+$/i.test(titleText)) {
    issues.push("title is missing or template-like");
  }
  if (sanitizedTasks.length < 3) {
    issues.push("has fewer than 3 actionable tasks");
  }
  const uniqueTaskLabelCount = new Set(
    sanitizedTasks.map((task) => task.label.trim().toLowerCase()).filter(Boolean),
  ).size;
  if (uniqueTaskLabelCount < Math.max(2, Math.floor(sanitizedTasks.length * 0.8))) {
    issues.push("task labels are too repetitive");
  }
  const summaryText = sanitizeInstructionText(String(stage.summary ?? node.summary ?? "")).trim();
  if (!summaryText || /^build stage \d+ from scratch/i.test(summaryText)) {
    issues.push("summary is template-like or empty");
  }
  const qualityCandidate = {
    ...stage,
    summary: summaryText || node.summary,
    tasks: sanitizedTasks,
  };
  const qualityScore = scoreStageQuality(qualityCandidate);
  if (qualityScore < 60) {
    issues.push(`quality score too low (${qualityScore})`);
  }
  const ok = issues.length === 0;
  return {
    stage: qualityCandidate,
    qualityScore,
    ok,
    issues,
  };
}

function scoreStageQuality(stage: Record<string, unknown>) {
  const tasks = Array.isArray(stage.tasks) ? stage.tasks as Array<Record<string, unknown>> : [];
  const goals = Array.isArray(stage.goals) ? stage.goals : [];
  const checkpoints = Array.isArray(stage.checkpoints) ? stage.checkpoints : [];
  let score = 0;
  score += Math.min(tasks.length, 6) * 12;
  score += Math.min(goals.length, 3) * 8;
  score += Math.min(checkpoints.length, 5) * 6;
  for (const task of tasks) {
    const stepsCount = Array.isArray(task.steps) ? task.steps.length : 0;
    const filesCount = Array.isArray(task.files) ? task.files.length : 0;
    const commandsCount = Array.isArray(task.commands) ? task.commands.length : 0;
    score += Math.min(stepsCount, 6) * 3;
    score += Math.min(filesCount, 4) * 2;
    score += Math.min(commandsCount, 4) * 2;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeTimeline(timelineRaw: unknown, stageBudget: number, commits: Array<{ sha: string }>) {
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
        : `Stage ${idx + 1}`;
      const safeSummary = typeof stage.summary === "string" && stage.summary.trim().length > 0
        ? stage.summary
        : `Build ${stageTitle} with a concrete, testable outcome.`;
      const safeGoals = goals.length > 0
        ? goals.slice(0, 3)
        : [`Complete ${stageTitle} with working files and verifiable output.`];
      const safeTasks = tasks.length > 0
        ? tasks
        : [
          {
            label: `Implement ${stageTitle}`,
            steps: [
              `Create the minimal files needed to ship ${stageTitle}.`,
              "Run the project locally and verify the feature works end-to-end.",
            ],
            files: ["README.md"],
            commands: ["npm run dev"],
          },
        ];

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

  return [setupStage, ...stages.map((stage, idx) => ({ ...stage, index: idx + 1 }))];
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

async function getUserSoftUsage(supabase: SupabaseClient, userId: string | null): Promise<UserSoftUsage> {
  const fallbackLimit = Math.max(Number.isFinite(USER_DAILY_TOKEN_SOFT_LIMIT) ? USER_DAILY_TOKEN_SOFT_LIMIT : 120_000, 1);
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

async function resolveUsageMode(supabase: SupabaseClient, userId: string | null) {
  const globalUsage = await getGlobalUsage(supabase);
  const userUsage = await getUserSoftUsage(supabase, userId);
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
    const userSoftResult = await supabase.rpc("record_user_soft_token_usage", {
      p_user_id: params.userId,
      p_total_tokens: safeTotalTokens,
      p_daily_limit: USER_DAILY_TOKEN_SOFT_LIMIT,
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
  onProgress?: (message: string) => Promise<void>;
}) {
  const { supabase, repoUrl, forceRefresh, userId, onProgress } = options;
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

  const usageSnapshot = await resolveUsageMode(supabase, userId);
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
        goals: Array.isArray(stage.goals) ? stage.goals.map((item) => String(item)) : [],
        prerequisites: Array.isArray(stage.prerequisites)
          ? stage.prerequisites.map((item) => String(item))
          : [],
        checkpoints: Array.isArray(stage.checkpoints) ? stage.checkpoints.map((item) => String(item)) : [],
        source_themes: [],
        optional_peeks: [],
      };
      return validateHydratedStageQuality(stage, pseudoNode);
    })
    .filter((result) => !result.ok);
  if (qualityFailures.length > 0) {
    const reason = qualityFailures
      .slice(0, 2)
      .map((failure) => failure.issues.join(", "))
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
        global_remaining: usageSnapshot.globalUsage.remaining,
        user_remaining: usageSnapshot.userUsage.remaining,
        stage_budget: stageBudget,
        commit_sample: commitLimit,
      },
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
  return toJsonResponse(usage as unknown as JsonObject);
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
  const filteredRows = Number.isFinite(minRating) && minRating > 0
    ? rows.filter((row) => {
      const ratingCount = Number(row.rating_count ?? 0);
      const ratingSum = Number(row.rating_sum ?? 0);
      if (ratingCount <= 0) {
        return false;
      }
      return ratingSum / ratingCount >= minRating;
    })
    : rows;

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
}) {
  const { supabase, repoFullName, repoSummary, timeline, jobState, lastGeneratedStage } = options;
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
    goals: Array.isArray(row.goals) ? row.goals.map((item) => String(item)) : [],
    prerequisites: Array.isArray(row.prerequisites) ? row.prerequisites.map((item) => String(item)) : [],
    checkpoints: Array.isArray(row.checkpoints) ? row.checkpoints.map((item) => String(item)) : [],
    source_themes: Array.isArray(row.source_themes) ? row.source_themes.map((item) => String(item)) : [],
    optional_peeks: Array.isArray(row.optional_peeks) ? row.optional_peeks.map((item) => String(item)) : [],
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

  const usageSnapshot = await resolveUsageMode(supabase, userId);
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
        progress_percent: computeProgressPercent(0, 1, "ingest"),
        current_phase: "ingest",
        phase_message: "Queued. Start continue generation to run ingest.",
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
      progress_percent: initialStatus === "completed" ? 100 : computeProgressPercent(generatedStages, syllabus.stageTarget, "syllabus"),
      current_phase: initialStatus === "completed" ? "complete" : "syllabus",
      phase_message: initialStatus === "completed" ? "Generation complete." : "Syllabus compiled. Ready to hydrate stages.",
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
      progress_percent: computeProgressPercent(0, syllabus.stageTarget, "syllabus"),
      current_phase: "syllabus",
      phase_message: "Syllabus compiled. Ready to hydrate stages.",
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
    return {
      status,
      generated_stages: generated,
      total_planned_stages: total,
      timeline: Array.isArray(jobRow.initial_timeline) ? jobRow.initial_timeline : [],
      repo_full_name: String(jobRow.repo_full_name),
      progress_percent: Number(jobRow.progress_percent ?? computeProgressPercent(generated, total, "complete")),
      current_phase: String(jobRow.current_phase ?? "complete"),
      phase_message: String(jobRow.phase_message ?? "Generation complete"),
    };
  }

  const usageSnapshot = await resolveUsageMode(supabase, userId);
  if (usageSnapshot.mode === "critical") {
    await updateGenerationJobPhase(supabase, jobId, {
      phase: "hydrate",
      status: "failed",
      message: "Token budget is depleted.",
      lastError: "Token budget is depleted. Please try again after reset.",
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
  if (ingestSnapshotKey) {
    const { data: ingestSnapshot } = await supabase
      .from("repo_ingest_snapshots")
      .select("readme_excerpt")
      .eq("snapshot_key", ingestSnapshotKey)
      .maybeSingle();
    readmeExcerpt = String(ingestSnapshot?.readme_excerpt ?? "");

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

  const prompt = buildStageHydrationPrompt({
    repoName: String(jobRow.repo_full_name),
    readmeExcerpt,
    commitClusters,
    nodes: chunkNodes,
  });

  await updateGenerationJobPhase(supabase, jobId, {
    phase: "hydrate",
    status: "running",
    generatedStages,
    totalStages: totalPlannedStages,
    message: `Hydrating stages ${stageStart}-${stageEnd}...`,
    lastError: null,
  });

  const result = await callGeminiJson({
    prompt,
    maxOutputTokens: usageSnapshot.mode === "low" ? 1400 : 2200,
    responseMimeType: "application/json",
    temperature: 0.2,
    models: GEMINI_MODELS_HYDRATOR,
  });

  const usageMeta = { ...result.usage };
  const parsed = result.parsed;
  const hydrated = normalizeTimeline(parsed.timeline, chunkNodes.length, commitRefs).filter((stage) => stage.id !== "stage-setup");
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
  });

  const stageByNodeId = new Map<string, Record<string, unknown>>();
  const validationByNodeId = new Map<string, { stage: Record<string, unknown>; qualityScore: number; ok: boolean; issues: string[] }>();
  for (let idx = 0; idx < chunkNodes.length; idx += 1) {
    const node = chunkNodes[idx];
    const stage = initialStages[idx];
    stageByNodeId.set(node.id, stage);
    validationByNodeId.set(node.id, validateHydratedStageQuality(stage, node));
  }

  const failedNodes = chunkNodes.filter((node) => !(validationByNodeId.get(node.id)?.ok ?? false));
  if (failedNodes.length > 0) {
    const repairPrompt = buildStageRepairPrompt({
      repoName: String(jobRow.repo_full_name),
      readmeExcerpt,
      commitClusters,
      nodes: failedNodes,
    });
    const repairResult = await callGeminiJson({
      prompt: repairPrompt,
      maxOutputTokens: usageSnapshot.mode === "low" ? 1500 : 2400,
      responseMimeType: "application/json",
      temperature: 0.15,
      models: GEMINI_MODELS_REPAIR,
      retries: 2,
    });
    usageMeta.promptTokens += repairResult.usage.promptTokens;
    usageMeta.completionTokens += repairResult.usage.completionTokens;
    usageMeta.totalTokens += repairResult.usage.totalTokens;

    const repaired = normalizeTimeline(repairResult.parsed.timeline, failedNodes.length, commitRefs)
      .filter((stage) => stage.id !== "stage-setup");
    const repairedByIndex = new Map(repaired.map((stage) => [Number(stage.index), stage]));

    for (let idx = 0; idx < failedNodes.length; idx += 1) {
      const node = failedNodes[idx];
      const candidate = repairedByIndex.get(idx + 1) ?? repaired[idx];
      if (!candidate) {
        continue;
      }
      const merged = mergeSyllabusNodeIntoStage(candidate, node);
      const validated = validateHydratedStageQuality(merged, node);
      stageByNodeId.set(node.id, merged);
      validationByNodeId.set(node.id, validated);
    }
  }

  const remainingFailures = chunkNodes
    .map((node) => ({
      node,
      validated: validationByNodeId.get(node.id),
    }))
    .filter((item) => !(item.validated?.ok ?? false));
  if (remainingFailures.length > 0) {
    const reason = remainingFailures
      .slice(0, 3)
      .map((item) => `${item.node.id}: ${(item.validated?.issues ?? ["unknown quality failure"]).join(", ")}`)
      .join(" | ");
    await updateGenerationJobPhase(supabase, jobId, {
      phase: "validate",
      status: "failed",
      generatedStages,
      totalStages: totalPlannedStages,
      message: "Stage quality validation failed.",
      lastError: reason,
    });
    throw new Error(`Stage quality validation failed. ${reason}`);
  }

  const normalizedChunk = chunkNodes.map((node) => {
    const validated = validationByNodeId.get(node.id);
    const safeStage = validated?.stage ?? stageByNodeId.get(node.id) ?? {};
    return {
      ...safeStage,
      id: node.id,
      index: node.index,
    };
  });

  await updateGenerationJobPhase(supabase, jobId, {
    phase: "persist",
    status: "running",
    generatedStages,
    totalStages: totalPlannedStages,
    message: "Persisting generated stages...",
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
      current_phase: nextStatus === "completed" ? "complete" : "hydrate",
      phase_message: nextStatus === "completed" ? "Generation complete." : "Ready to hydrate next stage window.",
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

  const qualityRows = normalizedChunk.map((stage) => ({
    job_id: jobId,
    repo_full_name: String(jobRow.repo_full_name),
    stage_id: String(stage.id),
    stage_index: Number(stage.index),
    quality_score: scoreStageQuality(stage as Record<string, unknown>),
    checks: {
      has_tasks: Array.isArray(stage.tasks) && stage.tasks.length > 0,
      has_goals: Array.isArray(stage.goals) && stage.goals.length > 0,
      clone_free: JSON.stringify(stage).toLowerCase().includes("git clone") === false,
    },
  }));
  await supabase.from("roadmap_quality_reports").insert(qualityRows);

  const peekRows = normalizedChunk.flatMap((stage) => {
    const optionalPeeks = Array.isArray(stage.optional_peeks)
      ? stage.optional_peeks.map((item) => String(item)).filter(Boolean)
      : [];
    return optionalPeeks.map((peek, idx) => ({
      job_id: jobId,
      repo_full_name: String(jobRow.repo_full_name),
      stage_id: String(stage.id),
      stage_index: Number(stage.index),
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
      chunk_size: stagesToGenerate,
      stage_start: stageStart,
      stage_end: stageEnd,
      global_remaining: usageSnapshot.globalUsage.remaining,
      user_remaining: usageSnapshot.userUsage.remaining,
    },
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
  };
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
    const currentGenerated = Number(job.generated_stages ?? 0);
    const totalPlanned = Number(job.total_planned_stages ?? 0);
    const snapshot = {
      status: String(job.status ?? "queued") as RoadmapGenerationJobStatus,
      generated_stages: currentGenerated,
      total_planned_stages: totalPlanned,
      timeline: Array.isArray(job.initial_timeline) ? job.initial_timeline : [],
      repo_full_name: String(job.repo_full_name),
      progress_percent: Number(job.progress_percent ?? computeProgressPercent(currentGenerated, Math.max(totalPlanned, 1), "ingest")),
      current_phase: String(job.current_phase ?? "ingest"),
      phase_message: String(job.phase_message ?? "Queued. Start continue generation to begin ingest."),
    };

    return toJsonResponse({
      job_id: jobId,
      repo_full_name: snapshot.repo_full_name,
      status: snapshot.status,
      initial_timeline: snapshot.timeline,
      generated_stages: snapshot.generated_stages,
      total_planned_stages: snapshot.total_planned_stages,
      progress_percent: snapshot.progress_percent,
      current_phase: snapshot.current_phase,
      phase_message: snapshot.phase_message,
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
  const { data, error } = await context.supabase
    .from("roadmap_generation_jobs")
    .select("id,status,generated_stages,total_planned_stages,last_error,updated_at,progress_percent,current_phase,phase_message")
    .eq("id", jobId)
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error) {
    return routeError(500, error.message);
  }
  if (!data) {
    return routeError(404, "Roadmap generation job not found", "job_not_found");
  }

  return toJsonResponse({
    status: data.status,
    generated_stages: data.generated_stages,
    total_planned_stages: data.total_planned_stages,
    last_error: data.last_error,
    updated_at: data.updated_at,
    progress_percent: data.progress_percent,
    current_phase: data.current_phase,
    phase_message: data.phase_message,
  });
}

async function handleRoadmapJobContinue(context: AuthedRouteContext, jobId: string) {
  try {
    const snapshot = await runProgressiveGenerationChunk(context, jobId, 3);
    return toJsonResponse({
      status: snapshot.status,
      generated_stages: snapshot.generated_stages,
      total_planned_stages: snapshot.total_planned_stages,
      last_error: null,
      updated_at: new Date().toISOString(),
      progress_percent: snapshot.progress_percent,
      current_phase: snapshot.current_phase,
      phase_message: snapshot.phase_message,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to continue roadmap generation";
    return routeError(
      detail.includes("not found") ? 404 : 502,
      detail,
      detail.includes("not found") ? "job_not_found" : "continue_generation_failed",
    );
  }
}

async function handleRoadmapJobHydrateNext(context: AuthedRouteContext, jobId: string) {
  const body = await readJsonBody(context.req);
  const requestedChunkSize = Number(body.chunk_size ?? 3);
  const chunkSize = Number.isFinite(requestedChunkSize)
    ? Math.max(1, Math.min(8, Math.floor(requestedChunkSize)))
    : 3;
  try {
    const snapshot = await runProgressiveGenerationChunk(context, jobId, chunkSize);
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
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to hydrate next roadmap chunk";
    return routeError(
      detail.includes("not found") ? 404 : 502,
      detail,
      detail.includes("not found") ? "job_not_found" : "hydrate_next_failed",
    );
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
      snapshot = await runProgressiveGenerationChunk(context, jobId, 4);
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
    while (true) {
      const { data: jobRow } = await context.supabase
        .from("roadmap_generation_jobs")
        .select("generated_stages,status")
        .eq("id", jobId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!jobRow) {
        return routeError(404, "Roadmap generation job not found", "job_not_found");
      }
      const generated = Number(jobRow.generated_stages ?? 0);
      const status = String(jobRow.status ?? "queued") as RoadmapGenerationJobStatus;
      if (generated >= targetIndex || status === "completed") {
        break;
      }
      await runProgressiveGenerationChunk(context, jobId, 3);
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
            stage_id: item.stageId,
            ...toTranslatableStagePayload(item.stage),
          })),
        );
        const result = await callGeminiAndParseJson({
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
  try {
    userId = await getAuthedUserId(context.req, false);
  } catch {
    userId = null;
  }

  const usageSnapshot = await resolveUsageMode(context.supabase, userId);
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
        response_language: responseLanguage,
        global_remaining: usageSnapshot.globalUsage.remaining,
        user_remaining: usageSnapshot.userUsage.remaining,
      },
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
    const userId = await getAuthedUserId(context.req, true);
    if (!userId) {
      throw new Error("User ID missing in token");
    }
    return await handler({ ...context, userId });
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

Deno.serve(async (req) => {
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
    if (path === "/api/v1/admin/catalog/soft-reset" && req.method === "POST") {
      return await handleAdminCatalogSoftReset(context);
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

    return routeError(404, `No route found for ${req.method} ${path}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unexpected server error";
    return routeError(500, detail);
  }
});
