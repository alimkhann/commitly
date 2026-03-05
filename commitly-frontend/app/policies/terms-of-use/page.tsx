"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { policyMeta } from "@/data/policies";

export default function TermsOfUsePage() {
  const { t } = usePreferences();

  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">
            {t("legal", "Legal")}
          </p>
          <h1 className="font-semibold text-4xl">
            {t("policy_terms_title", "Terms of use")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("last_updated", "Last updated")} {policyMeta.updated}
          </p>
        </header>
        <section className="space-y-4 text-base text-muted-foreground leading-relaxed">
          <p>
            {t(
              "policy_terms_p1",
              "These Terms govern use of Commitly, including roadmap generation and related services."
            )}
          </p>
          <h2 className="font-semibold text-foreground text-xl">
            {t("policy_terms_h2_usage", "Use of the service")}
          </h2>
          <p>
            {t(
              "policy_terms_p2",
              "Use Commitly only for lawful purposes. You are responsible for imported repositories and granted access rights."
            )}
          </p>
          <h2 className="font-semibold text-foreground text-xl">
            {t("policy_terms_h2_ip", "Intellectual property")}
          </h2>
          <p>
            {t(
              "policy_terms_p3",
              "Commitly owns the platform and brand assets. You keep ownership of your code and data."
            )}
          </p>
        </section>
      </article>
    </main>
  );
}
