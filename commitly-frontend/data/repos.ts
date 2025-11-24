export type RepoDifficulty = "intro" | "easy" | "medium" | "hard";

export type StageTask = {
  id: string;
  title: string;
  description: string;
  file_path?: string;
  code_snippet?: string;
  complexity: "low" | "medium" | "high";
};

export type CodeExample = {
  file: string;
  language: string;
  description: string;
  snippet: string;
};

export type RepoTimelineStage = {
  id: string;
  title: string;
  summary: string;
  status: "not-started" | "in-progress" | "done";
  eta: string;
  goals: string[];
  prerequisites: string[];
  checkpoints: string[];
  tasks: StageTask[];
  resources: { label: string; href: string }[];
  code_examples: CodeExample[];
};

export type RepoGuideMessage = {
  id: string;
  role: "guide" | "user";
  message: string;
  timestamp: string;
};

export type RepoRecord = {
  id: string;
  name: string;
  description: string;
  stars: string;
  language: string;
  updatedAt: string;
  difficulty: RepoDifficulty;
  tags: string[];
  progress: number;
  timeline: RepoTimelineStage[];
  guideThread: RepoGuideMessage[];
};

export type RepoId = string;
