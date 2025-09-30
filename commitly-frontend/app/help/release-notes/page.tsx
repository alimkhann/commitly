const RELEASE_NOTES = [
  {
    version: '0.4.0',
    date: '2024-11-04',
    notes: [
      'AI-powered timeline condenses commits into milestones and caches results per repo.',
      'Supabase authentication with email/password and Google OAuth.',
      'Personal repo list and improved “New repo” flow.',
    ],
  },
  {
    version: '0.3.2',
    date: '2024-10-18',
    notes: [
      'Initial backend ingestion draft with GitHub commit fetching.',
      'Agent tab prototype for chat guidance.',
    ],
  },
]

export default function ReleaseNotesPage() {
  return (
    <div className="flex flex-col gap-6 p-12 text-white">
      <h1 className="font-teachers text-5xl">Release notes</h1>
      <div className="space-y-8">
        {RELEASE_NOTES.map((entry) => (
          <div key={entry.version} className="border border-white/20 rounded p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-teachers text-3xl text-white">v{entry.version}</h2>
              <span className="text-white/60 text-sm">{entry.date}</span>
            </div>
            <ul className="mt-4 list-disc pl-5 text-white/80 space-y-2">
              {entry.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
