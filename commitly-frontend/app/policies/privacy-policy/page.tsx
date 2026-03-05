"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { policyMeta } from "@/data/policies";

export default function PrivacyPolicyPage() {
  const { t } = usePreferences();

  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">
            {t("legal", "Legal")}
          </p>
          <h1 className="font-semibold text-4xl">
            {t("policy_privacy_title", "Privacy policy")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("last_updated", "Last updated")} {policyMeta.updated}
          </p>
        </header>
        <section className="space-y-4 text-base text-muted-foreground leading-relaxed">
          <p>
            {t(
              "policy_privacy_p1",
              "This policy explains what data we collect in Commitly, how we use it, and your available controls."
            )}
          </p>
          <h2 className="font-semibold text-foreground text-xl">
            {t("policy_privacy_h2_collect", "What we collect")}
          </h2>
          <p>
            {t(
              "policy_privacy_p2",
              "We collect account basics, repository metadata, and product usage data required to deliver roadmap generation and guide features."
            )}
          </p>
          <h2 className="font-semibold text-foreground text-xl">
            {t("policy_privacy_h2_use", "How we use information")}
          </h2>
          <p>
            {t(
              "policy_privacy_p3",
              "Data is used to operate the product, improve quality, secure the platform, and satisfy legal obligations."
            )}
          </p>
        </section>
      </article>
    </main>
  );
}
