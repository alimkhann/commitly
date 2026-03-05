"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { plans } from "@/data/plans";

export default function PlansPage() {
  const router = useRouter();
  const { t } = usePreferences();
  const paidPlansWaitlistUrl = "https://commitly.one";

  return (
    <main className="min-h-screen w-full bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-primary text-sm uppercase tracking-[0.3em]">
              {t("pricing", "Pricing")}
            </p>
            <h1 className="font-semibold text-4xl leading-tight">
              {t("plans_title", "Upgrade your workspace when you're ready.")}
            </h1>
            <p className="text-base text-muted-foreground">
              {t(
                "plans_subtitle",
                "Pricing is transparent, but billing is not live yet. Paid plans are currently waitlist-only."
              )}
            </p>
          </div>
          <Button onClick={() => router.back()} variant="ghost">
            {t("close", "Close")}
            <X className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              className={`flex flex-col border border-border/60 bg-card ${
                plan.highlighted ? "ring-2 ring-primary" : ""
              }`}
              key={plan.id}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">
                    {t(plan.nameKey, plan.nameFallback)}
                  </CardTitle>
                  {plan.highlighted && (
                    <Badge className="text-xs uppercase" variant="accent">
                      {t("popular", "Popular")}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {t(plan.descriptionKey, plan.descriptionFallback)}
                </CardDescription>
                <div className="flex items-baseline gap-1 font-semibold text-4xl">
                  ${plan.price}
                  <span className="font-normal text-base text-muted-foreground">
                    /{t("month", "month")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {plan.id === "free" ? (
                  <Button className="w-full font-semibold" disabled variant="secondary">
                    {t("current_plan", "Current plan")}
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="w-full font-semibold"
                    variant={plan.highlighted ? "default" : "secondary"}
                  >
                    <Link href={paidPlansWaitlistUrl} target="_blank">
                      {t(plan.ctaKey, plan.ctaFallback)}
                    </Link>
                  </Button>
                )}
                <ul className="mt-6 space-y-3 text-muted-foreground text-sm">
                  {plan.features.map((feature) => (
                    <li className="flex items-center gap-2" key={feature.key}>
                      <Check className="h-4 w-4 text-primary" />
                      {t(feature.key, feature.fallback)}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="text-muted-foreground text-xs">
                {plan.id === "free"
                  ? t("free_tier_active", "Free tier is active now.")
                  : t(
                    "billing_not_active",
                    "Billing is not active yet. Join waitlist to get notified on launch."
                  )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
