export default function HelpCenterPage() {
  return (
    <div className="flex flex-col gap-6 p-12 text-white">
      <h1 className="font-teachers text-5xl">Help center</h1>
      <p className="text-white/80 text-lg max-w-2xl">
        Browse quick-start guides, troubleshooting tips, and best practices for building AI-assisted timelines
        with Commitly. More detailed documentation is coming soon.
      </p>
      <div className="space-y-4 text-white/70">
        <div>
          <h2 className="font-teachers text-3xl text-white">Getting started</h2>
          <p>Paste a GitHub repository URL from the sidebar, let the AI summarise the history, then review the milestones on the timeline page.</p>
        </div>
        <div>
          <h2 className="font-teachers text-3xl text-white">Need more?</h2>
          <p>Ping us at support@commitly.dev while we finish the in-app knowledge base.</p>
        </div>
      </div>
    </div>
  )
}
