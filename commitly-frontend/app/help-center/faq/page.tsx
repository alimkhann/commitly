"use client";

import Link from "next/link";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FAQ_KEYS = [
  {
    q: "faq_q1",
    qFallback: "What does Commitly actually do?",
    a: "faq_a1",
    aFallback:
      "It converts a GitHub repository into a beginner-friendly learning path with concrete tasks and validation checkpoints.",
  },
  {
    q: "faq_q2",
    qFallback: "Can I use private repositories?",
    a: "faq_a2",
    aFallback:
      "Yes on paid tiers. You can revoke OAuth access at any time.",
  },
  {
    q: "faq_q3",
    qFallback: "How does pricing work?",
    a: "faq_a3",
    aFallback:
      "Pricing is fixed by plan. Billing is still in waitlist mode during this beta.",
  },
  {
    q: "faq_q4",
    qFallback: "Where should I report bugs?",
    a: "faq_a4",
    aFallback:
      "Open Settings -> Report a bug and include steps, screenshots, and expected behavior.",
  },
] as const;

export default function FAQPage() {
  const { t } = usePreferences();

  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="space-y-2">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">
            {t("faq_kicker", "FAQ")}
          </p>
          <h1 className="font-semibold text-4xl">
            {t("faq_title", "Frequently asked questions")}
          </h1>
          <p className="text-base text-muted-foreground">
            {t(
              "faq_subtitle",
              "Still unsure? Reach out in-product or reply to any onboarding email."
            )}
          </p>
        </header>

        <div className="space-y-4">
          {FAQ_KEYS.map((faq) => (
            <Card className="border-border/60 bg-card" key={faq.q}>
              <CardHeader>
                <CardTitle className="text-lg">{t(faq.q, faq.qFallback)}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {t(faq.a, faq.aFallback)}
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <Link className="text-primary text-sm" href="/help-center">
            {t("back_help_center", "Back to Help center")}
          </Link>
        </div>
      </section>
    </main>
  );
}
