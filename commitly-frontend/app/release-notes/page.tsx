"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge } from "@/components/ui/badge";
import { releaseNotes } from "@/data/release-notes";

export default function ReleaseNotesPage() {
  const { t } = usePreferences();

  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="rounded-3xl border border-border/60 bg-card p-8">
          <p className="text-primary text-sm uppercase tracking-[0.35em]">
            {t("changelog", "Changelog")}
          </p>
          <h1 className="mt-3 font-semibold text-4xl">
            {t("release_notes_title", "Release notes")}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {t(
              "release_notes_subtitle",
              "Product updates, bug fixes, and quality improvements shipped to Commitly."
            )}
          </p>
        </header>

        <section className="space-y-8">
          {releaseNotes.map((entry, index) => (
            <article
              className="grid gap-4 rounded-3xl border border-border/60 bg-card p-6 md:grid-cols-[1fr_2fr]"
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
                  {t("release_entry_progress", "Release")} {index + 1} {t("of", "of")} {releaseNotes.length}
                </p>
              </div>

              <div>
                <ul className="space-y-3 text-muted-foreground text-sm">
                  {entry.highlights.map((item) => (
                    <li
                      className="rounded-2xl border border-border/40 bg-background p-3"
                      key={item.key}
                    >
                      {t(item.key, item.fallback)}
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
