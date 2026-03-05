"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { policyMeta } from "@/data/policies";

export default function SecurityPage() {
  const { t } = usePreferences();

  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">
            {t("legal", "Legal")}
          </p>
          <h1 className="font-semibold text-4xl">{t("policy_security_title", "Security")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("last_updated", "Last updated")} {policyMeta.updated}
          </p>
        </header>
        <section className="space-y-4 text-base text-muted-foreground leading-relaxed">
          <p>
            {t(
              "policy_security_p1",
              "Commitly uses encryption in transit/at rest, role-based access control, secret management, and monitoring."
            )}
          </p>
          <h2 className="font-semibold text-foreground text-xl">{t("safeguards", "Safeguards")}</h2>
          <p>
            {t(
              "policy_security_p2",
              "Customer data is isolated by workspace. Backups are encrypted and rotated on a regular schedule."
            )}
          </p>
          <h2 className="font-semibold text-foreground text-xl">
            {t("responsible_disclosure", "Responsible disclosure")}
          </h2>
          <p>
            {t("policy_security_p3", "If you discover a security issue, email")} {policyMeta.contact}. {t("policy_security_p3_suffix", "Include reproduction details so we can respond quickly.")}
          </p>
        </section>
      </article>
    </main>
  );
}
