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

type RepoIdentity = {
  owner: string;
  repo: string;
  fullName: string;
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
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-pro";
const GEMINI_MODEL_CANDIDATES = Array.from(
  new Set(
    [
      GEMINI_MODEL,
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
      "gemini-3-flash-preview",
    ].filter((model) => typeof model === "string" && model.trim().length > 0),
  ),
);

const GLOBAL_DAILY_TOKEN_LIMIT = Number(Deno.env.get("GLOBAL_DAILY_TOKEN_LIMIT") ?? "2500000");
const USER_DAILY_TOKEN_SOFT_LIMIT = Number(Deno.env.get("USER_DAILY_TOKEN_SOFT_LIMIT") ?? "120000");

const jwks = CLERK_JWKS_URL ? createRemoteJWKSet(new URL(CLERK_JWKS_URL)) : null;

const textEncoder = new TextEncoder();

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
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
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

  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`GitHub API ${response.status}: ${bodyText || response.statusText}`);
  }

  return (await response.json()) as T;
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

function buildChatPrompt(options: {
  repoName: string;
  roadmapSummary: string;
  userQuery: string;
  mode: "normal" | "low" | "critical";
}) {
  const { repoName, roadmapSummary, userQuery, mode } = options;

  return `You are Commitly, a concise beginner-friendly coding mentor.

Repository: ${repoName}
Budget mode: ${mode}
Roadmap context:
${roadmapSummary}

User question:
${userQuery}

Rules:
- give concrete, practical guidance
- prefer step-by-step instructions
- keep the answer concise and no fluff
- if unsure, state assumptions clearly`;
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
}) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  let lastError: Error | null = null;
  for (const model of GEMINI_MODEL_CANDIDATES) {
    const response = await fetch(
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
    );

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
  return {
    repo: buildRepoSummaryFromRow(row),
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
    cached: forceCachedValue ?? Boolean(row.cached),
    generated_at: (row.generated_at as string) ?? new Date().toISOString(),
    job_state: typeof row.job_state === "string" ? row.job_state : "completed",
    last_generated_stage: Number(row.last_generated_stage ?? 0),
  };
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
          const label = typeof task.label === "string" ? task.label.trim() : "Task";
          const steps = Array.isArray(task.steps)
            ? task.steps.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : [];
          const files = Array.isArray(task.files)
            ? task.files.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : [];
          const commands = Array.isArray(task.commands)
            ? task.commands.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
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

function getRepoSlug(fullName: string) {
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

  let query = supabase.from("generated_roadmaps").select("*", { count: "exact" });

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
    case "newest":
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

function buildRoadmapChunkPrompt(options: {
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

function normalizeTimelineChunk(
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

async function getOrCreateProgressiveJob(context: AuthedRouteContext, repoUrl: string, forceRefresh: boolean) {
  const identity = parseRepoUrl(repoUrl);
  const { supabase, userId } = context;

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

  const githubToken = await getGitHubTokenForUser(supabase, userId);
  const repo = await githubRequest<Record<string, unknown>>(`/repos/${identity.fullName}`, githubToken);
  const commitLimit = usageSnapshot.mode === "low" ? 40 : 80;
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
  const setupStage = normalizeTimeline([], 0, commitsChronological.map((commit) => ({ sha: String(commit.sha ?? "") })));
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
  const resumeFromPartial = Boolean(existingRoadmap && existingRoadmap.job_state === "partial_ready" && existingTimeline && existingTimeline.length > 0 && !forceRefresh);

  const repoSummary = {
    full_name: identity.fullName,
    description: String(repo.description ?? ""),
    language: String(repo.language ?? ""),
    stars: Number(repo.stargazers_count ?? 0),
    default_branch: String(repo.default_branch ?? "main"),
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
    view_count: Number(existingRoadmap?.view_count ?? 0),
    sync_count: Number(existingRoadmap?.sync_count ?? 0),
    rating_count: Number(existingRoadmap?.rating_count ?? 0),
    rating_sum: Number(existingRoadmap?.rating_sum ?? 0),
  };

  const initialTimeline = resumeFromPartial
    ? (existingTimeline as Record<string, unknown>[])
    : setupStage;
  const generatedStages = resumeFromPartial ? existingGeneratedStages : 0;
  const initialStatus: RoadmapGenerationJobStatus = generatedStages >= stageBudget
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
      total_planned_stages: stageBudget,
      stage_budget: stageBudget,
      mode: usageSnapshot.mode,
      initial_timeline: initialTimeline,
      repo_summary: repoSummary,
      commit_context: commitContextLines,
      last_error: null,
    })
    .select("*")
    .single();

  if (createError || !createdJob) {
    throw new Error(createError?.message ?? "Failed to initialize roadmap generation job");
  }

  return createdJob as Record<string, unknown>;
}

async function runProgressiveGenerationChunk(context: AuthedRouteContext, jobId: string, chunkSize: number) {
  const { supabase, userId } = context;
  const { data: jobRow, error: jobError } = await supabase
    .from("roadmap_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (jobError) {
    throw new Error(jobError.message);
  }
  if (!jobRow) {
    throw new Error("Roadmap generation job not found");
  }

  const status = String(jobRow.status ?? "queued") as RoadmapGenerationJobStatus;
  if (status === "completed") {
    return {
      status,
      generated_stages: Number(jobRow.generated_stages ?? 0),
      total_planned_stages: Number(jobRow.total_planned_stages ?? 0),
      timeline: Array.isArray(jobRow.initial_timeline) ? jobRow.initial_timeline : [],
      repo_full_name: String(jobRow.repo_full_name),
    };
  }

  const usageSnapshot = await resolveUsageMode(supabase, userId);
  if (usageSnapshot.mode === "critical") {
    await supabase
      .from("roadmap_generation_jobs")
      .update({
        status: "failed",
        last_error: "Token budget is depleted. Please try again after reset.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    throw new Error("Token budget is depleted. Please try again after reset.");
  }

  const totalPlannedStages = Number(jobRow.total_planned_stages ?? 0);
  const generatedStages = Number(jobRow.generated_stages ?? 0);
  const stageStart = generatedStages + 1;
  const stageEnd = Math.min(totalPlannedStages, generatedStages + chunkSize);
  const stagesToGenerate = Math.max(stageEnd - stageStart + 1, 0);

  if (stagesToGenerate <= 0) {
    await supabase
      .from("roadmap_generation_jobs")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return {
      status: "completed" as RoadmapGenerationJobStatus,
      generated_stages: generatedStages,
      total_planned_stages: totalPlannedStages,
      timeline: Array.isArray(jobRow.initial_timeline) ? jobRow.initial_timeline : [],
      repo_full_name: String(jobRow.repo_full_name),
    };
  }

  const currentTimeline = Array.isArray(jobRow.initial_timeline) ? (jobRow.initial_timeline as Record<string, unknown>[]) : [];
  const existingTitles = currentTimeline
    .filter((stage) => typeof stage === "object" && stage !== null && String((stage as Record<string, unknown>).id ?? "").startsWith("stage-"))
    .map((stage) => String((stage as Record<string, unknown>).title ?? ""))
    .filter(Boolean);

  const repoSummary = (jobRow.repo_summary ?? {}) as Record<string, unknown>;
  const commitContextLines = Array.isArray(jobRow.commit_context)
    ? (jobRow.commit_context as unknown[]).map((line) => String(line))
    : [];
  const commitRefs = commitContextLines.map((line) => ({ sha: line.split(":")[0] ?? "" }));

  const prompt = buildRoadmapChunkPrompt({
    repoName: String(jobRow.repo_full_name),
    description: String(repoSummary.description ?? ""),
    language: String(repoSummary.language ?? repoSummary.primary_language ?? ""),
    topics: Array.isArray(repoSummary.topics) ? repoSummary.topics.map((topic) => String(topic)) : [],
    commitsContext: commitContextLines.join("\n"),
    stageStart,
    stageEnd,
    existingTitles,
  });

  await supabase
    .from("roadmap_generation_jobs")
    .update({
      status: "running",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  const result = await callGeminiJson({
    prompt,
    maxOutputTokens: usageSnapshot.mode === "low" ? 1600 : 2800,
    responseMimeType: "application/json",
    temperature: 0.2,
  });

  const usageMeta = result.usage;
  const parsed = result.parsed;
  const normalizedChunk = normalizeTimelineChunk(parsed.timeline, stagesToGenerate, commitRefs, generatedStages);
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

  return {
    status: nextStatus,
    generated_stages: nextGeneratedStages,
    total_planned_stages: totalPlannedStages,
    timeline: nextTimeline,
    repo_full_name: String(jobRow.repo_full_name),
    roadmap: mapRoadmapRow(roadmapRow, false),
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
    const job = await getOrCreateProgressiveJob(context, repoUrl, forceRefresh);
    const jobId = String(job.id);
    const currentGenerated = Number(job.generated_stages ?? 0);
    const totalPlanned = Number(job.total_planned_stages ?? 0);
    let snapshot = {
      status: String(job.status ?? "queued") as RoadmapGenerationJobStatus,
      generated_stages: currentGenerated,
      total_planned_stages: totalPlanned,
      timeline: Array.isArray(job.initial_timeline) ? job.initial_timeline : [],
      repo_full_name: String(job.repo_full_name),
    };

    if (snapshot.status === "queued" || snapshot.generated_stages === 0) {
      snapshot = await runProgressiveGenerationChunk(context, jobId, snapshot.status === "queued" ? 4 : 3);
    }

    return toJsonResponse({
      job_id: jobId,
      repo_full_name: snapshot.repo_full_name,
      status: snapshot.status,
      initial_timeline: snapshot.timeline,
      generated_stages: snapshot.generated_stages,
      total_planned_stages: snapshot.total_planned_stages,
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
    .select("id,status,generated_stages,total_planned_stages,last_error,updated_at")
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

  const roadmapSummary = selectedStage
    ? JSON.stringify(selectedStage)
    : JSON.stringify({
      repo: roadmap.repo_summary,
      stages: timeline.slice(0, 8),
    });

  const prompt = buildChatPrompt({
    repoName: repoFullName,
    roadmapSummary,
    userQuery,
    mode: usageSnapshot.mode,
  });

  const maxOutputTokens = usageSnapshot.mode === "low" ? 768 : 1200;

  try {
    const result = await callGemini({
      prompt,
      maxOutputTokens,
      temperature: 0.35,
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
    return await handler({ ...context, userId: userId! });
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
    if (path === "/api/v1/roadmap/user-repos" && req.method === "GET") {
      return await withAuth(context, (authContext) => handleListUserRepos(authContext, false));
    }
    if (path === "/api/v1/roadmap/archived" && req.method === "GET") {
      return await withAuth(context, (authContext) => handleListUserRepos(authContext, true));
    }
    if (path === "/api/v1/roadmap/chat" && req.method === "POST") {
      return await handleChat(context);
    }
    if (path === "/api/v1/roadmap/chat/history" && req.method === "GET") {
      return await withAuth(context, handleChatHistoryGet);
    }
    if (path === "/api/v1/roadmap/chat/history" && req.method === "POST") {
      return await withAuth(context, handleChatHistorySave);
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

    return routeError(404, `No route found for ${req.method} ${path}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unexpected server error";
    return routeError(500, detail);
  }
});
