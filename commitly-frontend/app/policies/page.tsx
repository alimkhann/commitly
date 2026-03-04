"use client";

import { FileText, Lock, Scale, Shield } from "lucide-react";
import Link from "next/link";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { policyMeta } from "@/data/policies";

const POLICY_LINKS = [
  {
    href: "/policies/terms-of-use",
    labelKey: "policy_terms_title",
    labelFallback: "Terms of use",
    summaryKey: "policy_terms_summary",
    summaryFallback: "Rules for using Commitly products and APIs.",
    icon: Scale,
  },
  {
    href: "/policies/privacy-policy",
    labelKey: "policy_privacy_title",
    labelFallback: "Privacy policy",
    summaryKey: "policy_privacy_summary",
    summaryFallback: "What data we collect and how requests are handled.",
    icon: Lock,
  },
  {
    href: "/policies/data-use",
    labelKey: "policy_data_use_title",
    labelFallback: "Data use",
    summaryKey: "policy_data_use_summary",
    summaryFallback: "How repository content is processed and deleted.",
    icon: FileText,
  },
  {
    href: "/policies/security",
    labelKey: "policy_security_title",
    labelFallback: "Security",
    summaryKey: "policy_security_summary",
    summaryFallback: "Controls used to safeguard infrastructure and data.",
    icon: Shield,
  },
] as const;

export default function PoliciesPage() {
  const { t } = usePreferences();

  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="rounded-3xl border border-border/60 bg-card p-8 text-center">
          <p className="text-primary text-sm uppercase tracking-[0.35em]">
            {t("legal", "Legal")}
          </p>
          <h1 className="mt-3 font-semibold text-4xl">
            {t("policies_title", "Terms & policies")}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {t("last_updated", "Last updated")} {policyMeta.updated}. {t("security_contact", "For security disclosures email")} {policyMeta.contact}.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {POLICY_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Card className="flex flex-col justify-between border-border/60 bg-card" key={link.href}>
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="rounded-2xl border border-border/60 bg-background p-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl">
                    {t(link.labelKey, link.labelFallback)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    {t(link.summaryKey, link.summaryFallback)}
                  </p>
                  <Link
                    className="font-semibold text-primary text-sm underline underline-offset-4"
                    href={link.href}
                  >
                    {t("view_document", "View document")}
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 rounded-3xl border border-border/60 bg-card p-6 md:grid-cols-2">
          <div>
            <p className="font-semibold text-muted-foreground text-sm uppercase tracking-[0.3em]">
              {t("compliance", "Compliance")}
            </p>
            <h2 className="mt-2 font-semibold text-2xl">
              {t("compliance_title", "Your data, your rules")}
            </h2>
            <p className="mt-3 text-muted-foreground text-sm">
              {t(
                "compliance_body",
                "Commitly stores customer data in EU and US regions with encrypted backups."
              )}
            </p>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="font-semibold text-sm">{t("data_requests", "Data requests")}</p>
              <p className="text-muted-foreground text-sm">
                {t(
                  "data_requests_body",
                  "Email privacy@commitly.dev for exports or deletions. We respond within 5 business days."
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background p-4">
              <p className="font-semibold text-sm">{t("security_questions", "Security questions")}</p>
              <p className="text-muted-foreground text-sm">
                {t(
                  "security_questions_body",
                  "Contact security@commitly.dev for security review requests."
                )}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
