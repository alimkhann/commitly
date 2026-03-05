export type ReleaseEntry = {
  version: string;
  date: string;
  highlights: Array<{
    key: string;
    fallback: string;
  }>;
  channel?: "beta" | "stable" | "preview";
};

export const releaseNotes: ReleaseEntry[] = [
  {
    version: "v0.7.0",
    date: "2024-09-12",
    channel: "stable",
    highlights: [
      {
        key: "release_v070_highlight_1",
        fallback: "New repo roadmap builder with stage level hints",
      },
      {
        key: "release_v070_highlight_2",
        fallback: "Guide chat now summarizes long answers automatically",
      },
      {
        key: "release_v070_highlight_3",
        fallback: "Improved GitHub OAuth permissions flow",
      },
    ],
  },
  {
    version: "v0.6.2",
    date: "2024-08-19",
    channel: "beta",
    highlights: [
      {
        key: "release_v062_highlight_1",
        fallback: "Workspace analytics shipped behind the Team plan",
      },
      {
        key: "release_v062_highlight_2",
        fallback: "Command palette can now filter repos and tasks",
      },
    ],
  },
  {
    version: "v0.5.5",
    date: "2024-07-30",
    highlights: [
      {
        key: "release_v055_highlight_1",
        fallback: "Dark theme polish with accessible contrast ratios",
      },
      {
        key: "release_v055_highlight_2",
        fallback: "Added automated exports for completed guides",
      },
    ],
  },
];
