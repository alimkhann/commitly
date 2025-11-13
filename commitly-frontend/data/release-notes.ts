export type ReleaseEntry = {
  version: string
  date: string
  highlights: string[]
  channel?: "beta" | "stable" | "preview"
}

export const releaseNotes: ReleaseEntry[] = [
  {
    version: "v0.7.0",
    date: "2024-09-12",
    channel: "stable",
    highlights: [
      "New repo timeline builder with stage level hints",
      "Guide chat now summarises long answers automatically",
      "Improved GitHub OAuth permissions flow",
    ],
  },
  {
    version: "v0.6.2",
    date: "2024-08-19",
    channel: "beta",
    highlights: [
      "Workspace analytics shipped behind the Team plan",
      "Command palette can now filter repos and tasks",
    ],
  },
  {
    version: "v0.5.5",
    date: "2024-07-30",
    highlights: [
      "Dark theme polish with accessible contrast ratios",
      "Added automated exports for completed guides",
    ],
  },
]
