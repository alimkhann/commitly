"use client";

import Link from "next/link";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Card, CardContent } from "@/components/ui/card";

const STEP_KEYS = [
  {
    key: "getting_started_step_1",
    fallback: "Paste any GitHub repo URL from the home screen.",
  },
  {
    key: "getting_started_step_2",
    fallback: "Commitly reads commit history and compiles a staged learning roadmap.",
  },
  {
    key: "getting_started_step_3",
    fallback: "Read stages, use the guide coach, and save useful roadmaps to your library.",
  },
] as const;

export default function GettingStartedPage() {
  const { t } = usePreferences();

  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">
            {t("guide", "Guide")}
          </p>
          <h1 className="font-semibold text-4xl">
            {t("getting_started_title", "Getting started")}
          </h1>
          <p className="text-base text-muted-foreground">
            {t(
              "getting_started_subtitle",
              "Follow these essentials to generate your first roadmap and keep your workflow clean."
            )}
          </p>
        </header>

        <Card className="border-border/60 bg-card">
          <CardContent className="p-6">
            <ol className="space-y-4 text-base text-muted-foreground">
              {STEP_KEYS.map((step, index) => (
                <li className="flex gap-4" key={step.key}>
                  <span className="font-semibold text-primary text-sm">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{t(step.key, step.fallback)}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div>
          <Link className="text-primary text-sm" href="/help-center">
            {t("back_help_center", "Back to Help center")}
          </Link>
        </div>
      </section>
    </main>
  );
}
