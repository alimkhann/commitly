import type { StageTask } from "@/data/repos";

const toStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

export function normalizeTask(rawTask: unknown, index: number): StageTask {
  const task = (rawTask && typeof rawTask === "object"
    ? rawTask
    : {}) as Record<string, unknown>;

  const label =
    (typeof task.label === "string" && task.label.trim()) ||
    (typeof task.title === "string" && task.title.trim()) ||
    `Task ${index + 1}`;

  const description =
    typeof task.description === "string" ? task.description.trim() : "";

  const steps = toStringList(task.steps);
  const files = toStringList(task.files);
  const commands = toStringList(task.commands);

  return {
    label,
    steps: steps.length > 0 ? steps : description ? [description] : [],
    files:
      files.length > 0
        ? files
        : typeof task.file_path === "string" && task.file_path.trim()
          ? [task.file_path.trim()]
          : [],
    commands:
      commands.length > 0
        ? commands
        : typeof task.code_snippet === "string" && task.code_snippet.trim()
          ? [task.code_snippet.trim()]
          : [],
    title: typeof task.title === "string" ? task.title : undefined,
    description: description || undefined,
    file_path: typeof task.file_path === "string" ? task.file_path : undefined,
    code_snippet:
      typeof task.code_snippet === "string" ? task.code_snippet : undefined,
  };
}
