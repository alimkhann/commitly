import { Badge } from "@/components/ui/badge";
import { releaseNotes } from "@/data/release-notes";

export default function ReleaseNotesPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/30">
          <p className="text-primary text-sm uppercase tracking-[0.35em]">
            Changelog
          </p>
          <h1 className="mt-3 font-semibold text-4xl">Release notes</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Product updates, bug fixes, and design refreshes. We ship weekly,
            collect feedback in the app, and keep the roadmap transparent.
          </p>
        </header>

        <section className="space-y-8">
          {releaseNotes.map((entry, index) => (
            <article
              className="grid gap-4 rounded-3xl border border-border/60 bg-card/70 p-6 shadow-black/25 shadow-lg md:grid-cols-[1fr_2fr]"
              key={entry.version}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <span>{entry.date}</span>
                  {entry.channel && (
                    <Badge className="text-xs uppercase" variant="outline">
                      {entry.channel}
                    </Badge>
                  )}
                </div>
                <h2 className="font-semibold text-2xl">{entry.version}</h2>
                <p className="text-muted-foreground text-sm">
                  Release {index + 1} of {releaseNotes.length} in this series.
                </p>
              </div>

              <div>
                <ul className="space-y-3 text-muted-foreground text-sm">
                  {entry.highlights.map((item) => (
                    <li
                      className="rounded-2xl border border-border/40 bg-background/40 p-3"
                      key={item}
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
  );
}
