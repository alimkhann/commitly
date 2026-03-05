"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { policyMeta } from "@/data/policies";

export default function DataUsePage() {
  const { t } = usePreferences();

  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">
            {t("legal", "Legal")}
          </p>
          <h1 className="font-semibold text-4xl">{t("policy_data_use_title", "Data use")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("last_updated", "Last updated")} {policyMeta.updated}
          </p>
        </header>
        <section className="space-y-4 text-base text-muted-foreground leading-relaxed">
          <p>
            {t(
              "policy_data_use_p1",
              "When you connect a repository, Commitly processes structure, commits, and metadata to build learning roadmaps."
            )}
          </p>
          <h2 className="font-semibold text-foreground text-xl">{t("processing", "Processing")}</h2>
          <p>
            {t(
              "policy_data_use_p2",
              "Processing happens in US or EU regions. Repo artifacts are retained only as long as needed for roadmap quality and caching."
            )}
          </p>
          <h2 className="font-semibold text-foreground text-xl">{t("sharing", "Sharing")}</h2>
          <p>
            {t(
              "policy_data_use_p3",
              "We do not sell user data. We only work with infrastructure providers under strict confidentiality and security obligations."
            )}
          </p>
        </section>
      </article>
    </main>
  );
}
