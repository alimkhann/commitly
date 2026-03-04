"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const paidPlansWaitlistUrl = "https://commitly.one";

  return (
    <main className="min-h-screen w-full bg-[#070b10] px-6 py-12 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-primary text-sm uppercase tracking-[0.3em]">
              Pricing
            </p>
            <h1 className="font-semibold text-4xl leading-tight">
              Upgrade your workspace when you&apos;re ready.
            </h1>
            <p className="text-base text-muted-foreground">
              Pricing is transparent, but billing is not live yet. Paid plans
              are currently waitlist-only.
            </p>
          </div>
          <Button onClick={() => router.back()} variant="ghost">
            Close
            <X className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              className={`flex flex-col border border-border/60 bg-[#0d1117] ${
                plan.highlighted ? "ring-2 ring-primary" : ""
              }`}
              key={plan.id}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  {plan.highlighted && (
                    <Badge className="text-xs uppercase" variant="accent">
                      Popular
                    </Badge>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <div className="flex items-baseline gap-1 font-semibold text-4xl">
                  ${plan.price}
                  <span className="font-normal text-base text-muted-foreground">
                    /month
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {plan.id === "free" ? (
                  <Button className="w-full font-semibold" disabled variant="secondary">
                    {plan.cta}
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="w-full font-semibold"
                    variant={plan.highlighted ? "default" : "secondary"}
                  >
                    <Link href={paidPlansWaitlistUrl} target="_blank">
                      Join paid plans waitlist
                    </Link>
                  </Button>
                )}
                <ul className="mt-6 space-y-3 text-muted-foreground text-sm">
                  {plan.features.map((feature) => (
                    <li className="flex items-center gap-2" key={feature}>
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="text-muted-foreground text-xs">
                {plan.id === "free"
                  ? "Free tier is active now."
                  : "Billing is not active yet. Join waitlist to get notified on launch."}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
