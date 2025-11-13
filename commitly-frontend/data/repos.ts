export type RepoDifficulty = "beginner" | "intermediate" | "advanced"

export type RepoTimelineStage = {
  id: string
  title: string
  summary: string
  status: "not-started" | "in-progress" | "done"
  eta: string
  tasks: string[]
  resources: { label: string; href: string }[]
}

export type RepoGuideMessage = {
  id: string
  role: "guide" | "user"
  message: string
  timestamp: string
}

export type RepoRecord = {
  id: string
  name: string
  description: string
  stars: string
  language: string
  updatedAt: string
  difficulty: RepoDifficulty
  tags: string[]
  progress: number
  timeline: RepoTimelineStage[]
  guideThread: RepoGuideMessage[]
}

export const repos: RepoRecord[] = [
  {
    id: "deepseek",
    name: "deepseek-research/DeepSeek-V3",
    description:
      "A distributed training stack for multi-agent reasoning with streaming inference helpers.",
    stars: "112k",
    language: "Python",
    updatedAt: "2h ago",
    difficulty: "advanced",
    tags: ["deep-learning", "agents", "streaming"],
    progress: 62,
    timeline: [
      {
        id: "stage-1",
        title: "Bootstrap the workspace",
        summary:
          "Install poetry environment, sync git submodules, and prime dataset caches.",
        status: "done",
        eta: "15m",
        tasks: [
          "Install Python 3.11 + Poetry",
          "Run `make bootstrap` to pull weights",
          "Validate CUDA availability",
        ],
        resources: [
          { label: "Project README", href: "https://github.com/deepseek" },
          { label: "Bootstrap checklist", href: "#" },
        ],
      },
      {
        id: "stage-2",
        title: "Trace agent runtime",
        summary:
          "Understand how planner, critic, and executive agents hand off work during a request.",
        status: "in-progress",
        eta: "40m",
        tasks: [
          "Set `TRACE_AGENTS=1` env variable",
          "Add request payload from docs/examples",
          "Capture spans in Jaeger / OpenTelemetry",
        ],
        resources: [
          { label: "Tracing guide", href: "#" },
          { label: "Agent glossary", href: "#" },
        ],
      },
      {
        id: "stage-3",
        title: "Harden streaming responses",
        summary:
          "Add retry/backoff to SSE bridge and bubble structured errors to clients.",
        status: "not-started",
        eta: "1h",
        tasks: [
          "Wrap SSE writer with reconnect support",
          "Normalize error payloads to JSON schema",
          "Add integration test that simulates flaky upstream",
        ],
        resources: [
          { label: "Streaming RFC", href: "#" },
          { label: "Structured errors spec", href: "#" },
        ],
      },
    ],
    guideThread: [
      {
        id: "m1",
        role: "guide",
        message:
          "I traced the boot path. Planner acquires datasets, critic keeps shape metadata, and executive streams tokens. What feels confusing right now?",
        timestamp: "10:24",
      },
      {
        id: "m2",
        role: "user",
        message:
          "The SSE bridge drops when DeepSeek pushes >2 tokens per chunk. Not sure where to patch.",
        timestamp: "10:25",
      },
      {
        id: "m3",
        role: "guide",
        message:
          "Open `server/routers/stream.py`. There's a single retry with no jitter. Let's add exponential backoff and emit partial deltas so the UI can resume.",
        timestamp: "10:26",
      },
    ],
  },
  {
    id: "vscode",
    name: "microsoft/vscode",
    description:
      "VS Code core editor modules with workbench contributions and extension host.",
    stars: "165k",
    language: "TypeScript",
    updatedAt: "Yesterday",
    difficulty: "intermediate",
    tags: ["desktop", "monaco", "extensions"],
    progress: 41,
    timeline: [
      {
        id: "stage-1",
        title: "Devcontainer setup",
        summary:
          "Use the provided `.devcontainer` to get Electron + Chromium dependencies aligned.",
        status: "done",
        eta: "20m",
        tasks: [
          "Install Docker Desktop",
          "Open repo in Codespaces/devcontainer",
          "Run `yarn watch` and `yarn web`",
        ],
        resources: [
          { label: "Development docs", href: "#" },
          { label: "Devcontainer reference", href: "#" },
        ],
      },
      {
        id: "stage-2",
        title: "Notebook kernel UX",
        summary:
          "Update the inline kernel picker to show provenance and recommended runtimes.",
        status: "in-progress",
        eta: "35m",
        tasks: [
          "Audit `notebookKernelQuickPick.ts`",
          "Add `recommended` badge using codicons",
          "Write smoke test that asserts quick pick values",
        ],
        resources: [
          { label: "Notebook guide", href: "#" },
          { label: "Codicon list", href: "#" },
        ],
      },
      {
        id: "stage-3",
        title: "Workbench insights",
        summary:
          "Send structured usage data for the new quick pick so product analytics can track adoption.",
        status: "not-started",
        eta: "50m",
        tasks: [
          "Use `standardTelemetryService` with feature flag",
          "Record kernel id & workspace trust state",
          "Document payload contract",
        ],
        resources: [
          { label: "Telemetry checklist", href: "#" },
        ],
      },
    ],
    guideThread: [
      {
        id: "m1",
        role: "guide",
        message:
          "Kernel picker lives under `src/vs/workbench/contrib/notebook/browser/viewParts/notebookKernelQuickPick`. We'll wrap it with a helper component.",
        timestamp: "09:02",
      },
      {
        id: "m2",
        role: "user",
        message: "Need to expose provenance badges without cluttering the row.",
        timestamp: "09:05",
      },
      {
        id: "m3",
        role: "guide",
        message:
          "Use the `codicon-debug` glyph + subtle accent background. Keep typography at `11px` to match workbench tokens.",
        timestamp: "09:06",
      },
    ],
  },
  {
    id: "tencent",
    name: "Tencent/ncnn",
    description:
      "High-performance neural network inference framework optimized for mobile.",
    stars: "20k",
    language: "C++",
    updatedAt: "3 days ago",
    difficulty: "advanced",
    tags: ["inference", "c++", "android"],
    progress: 28,
    timeline: [
      {
        id: "stage-1",
        title: "Toolchain validation",
        summary:
          "Ensure clang + ninja + Vulkan SDK are aligned before compiling benchmarks.",
        status: "done",
        eta: "25m",
        tasks: [
          "Install Vulkan SDK 1.3.290",
          "Verify `glslc` on PATH",
          "Run `./build-android-armeabi-v7a.sh`",
        ],
        resources: [
          { label: "Android build doc", href: "#" },
        ],
      },
      {
        id: "stage-2",
        title: "Quantized pipeline",
        summary:
          "Profile the int8 path for EfficientNet and surface perf regressions.",
        status: "in-progress",
        eta: "55m",
        tasks: [
          "Enable `NCNN_INT8=ON`",
          "Run benchmark with `BENCHMARK_OP=1`",
          "Capture perfetto trace on Pixel 6",
        ],
        resources: [
          { label: "Quantization notes", href: "#" },
          { label: "Perfetto template", href: "#" },
        ],
      },
      {
        id: "stage-3",
        title: "CI artifact slimming",
        summary:
          "Add artifact filters so nightly builds stay under 200MB compressed.",
        status: "not-started",
        eta: "35m",
        tasks: [
          "Patch `.github/workflows/nightly.yml`",
          "Strip symbols after linking",
          "Upload checksums for release manager",
        ],
        resources: [
          { label: "CI storage policy", href: "#" },
        ],
      },
    ],
    guideThread: [
      {
        id: "m1",
        role: "guide",
        message:
          "Quantized path diverges inside `src/layer/arm/convolution_pack4.cpp`. Use the perfetto template to compare kernels.",
        timestamp: "16:41",
      },
      {
        id: "m2",
        role: "user",
        message:
          "Seeing cache misses after enabling Winograd. Should we keep it?",
        timestamp: "16:45",
      },
      {
        id: "m3",
        role: "guide",
        message:
          "Winograd is only helpful on big cores. For Pixel 6 little cores, fall back to direct conv by toggling `cpu_support_arm_v81` flag.",
        timestamp: "16:47",
      },
    ],
  },
]

export type RepoId = (typeof repos)[number]["id"]

export const getRepoById = (id: string) =>
  repos.find((repo) => repo.id === id) ?? null
