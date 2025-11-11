import { releaseNotes } from "@/data/release-notes"
import { Badge } from "@/components/ui/badge"

export default function ReleaseNotesPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/30">
          <p className="text-sm uppercase tracking-[0.35em] text-primary">Changelog</p>
          <h1 className="mt-3 text-4xl font-semibold">Release notes</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Product updates, bug fixes, and design refreshes. We ship weekly, collect feedback
            in the app, and keep the roadmap transparent.
          </p>
        </header>

        <section className="space-y-8">
          {releaseNotes.map((entry, index) => (
            <article
              key={entry.version}
              className="grid gap-4 rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/25 md:grid-cols-[1fr_2fr]"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{entry.date}</span>
                  {entry.channel && (
                    <Badge variant="outline" className="text-xs uppercase">
                      {entry.channel}
                    </Badge>
                  )}
                </div>
                <h2 className="text-2xl font-semibold">{entry.version}</h2>
                <p className="text-sm text-muted-foreground">
                  Release {index + 1} of {releaseNotes.length} in this series.
                </p>
              </div>

              <div>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {entry.highlights.map((item) => (
                    <li
                      key={item}
                      className="rounded-2xl border border-border/40 bg-background/40 p-3"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
