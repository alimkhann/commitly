"use client";

import { ArrowRight, Headphones, Mail } from "lucide-react";
import Link from "next/link";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const HELP_CARD_KEYS = [
  {
    href: "/help-center/getting-started",
    titleKey: "help_card_getting_started_title",
    titleFallback: "Getting started",
    descriptionKey: "help_card_getting_started_desc",
    descriptionFallback:
      "Bootstrap Commitly, connect GitHub, and run your first repo.",
  },
  {
    href: "/help-center/faq",
    titleKey: "help_card_faq_title",
    titleFallback: "FAQ",
    descriptionKey: "help_card_faq_desc",
    descriptionFallback: "Quick answers for account, timelines, and retention.",
  },
  {
    href: "/policies",
    titleKey: "help_card_policies_title",
    titleFallback: "Terms & policies",
    descriptionKey: "help_card_policies_desc",
    descriptionFallback: "Privacy, security, and acceptable use policies.",
  },
  {
    href: "/release-notes",
    titleKey: "help_card_release_notes_title",
    titleFallback: "Release notes",
    descriptionKey: "help_card_release_notes_desc",
    descriptionFallback: "Highlights from the latest product drops.",
  },
] as const;

export default function HelpCenterPage() {
  const { t } = usePreferences();

  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="grid gap-6 rounded-3xl border border-border/60 bg-card p-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="text-primary text-sm uppercase tracking-[0.35em]">
              {t("help_kicker", "Support")}
            </p>
            <h1 className="mt-2 font-semibold text-4xl">
              {t("help_title", "How can we help?")}
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              {t(
                "help_subtitle",
                "Browse guides, track product changes, or reach a human. Every ticket helps us improve roadmap quality."
              )}
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-border/60 bg-background p-4">
            <div className="flex items-center gap-3">
              <Headphones className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">
                  {t("help_live_support", "Live support")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t("help_live_support_hours", "Mon-Fri, 9am-6pm UTC")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">{t("help_email", "Email")}</p>
                <p className="text-muted-foreground text-xs">support@commitly.dev</p>
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <div>
            <p className="font-semibold text-primary text-sm uppercase tracking-wide">
              {t("help_library_kicker", "Library")}
            </p>
            <h2 className="font-semibold text-2xl">
              {t("help_library_title", "Start with the essentials")}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {HELP_CARD_KEYS.map((card) => (
              <Card className="border-border/60 bg-card" key={card.titleKey}>
                <CardHeader>
                  <CardTitle>{t(card.titleKey, card.titleFallback)}</CardTitle>
                  <CardDescription>
                    {t(card.descriptionKey, card.descriptionFallback)}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button asChild className="w-full justify-between" variant="ghost">
                    <Link href={card.href}>
                      <span>{t("help_open_guide", "Open guide")}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
