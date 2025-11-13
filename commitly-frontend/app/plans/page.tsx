"use client"

import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"

import { plans } from "@/data/plans"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function PlansPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-background via-background/80 to-background px-6 py-12 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-primary">
              Pricing
            </p>
            <h1 className="text-4xl font-semibold leading-tight">
              Upgrade your workspace when you&apos;re ready.
            </h1>
            <p className="text-base text-muted-foreground">
              Pick a plan that matches how often you turn repos into guided build plans.
              All tiers include the dark UI and shadcn component kit.
            </p>
          </div>
          <Button variant="ghost" onClick={() => router.back()}>
            Close
            <X className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`flex flex-col border border-border/60 bg-card/80 shadow-2xl shadow-black/30 ${
                plan.highlighted ? "ring-2 ring-primary" : ""
              }`}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  {plan.highlighted && (
                    <Badge variant="accent" className="text-xs uppercase">
                      Popular
                    </Badge>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <div className="flex items-baseline gap-1 text-4xl font-semibold">
                  ${plan.price}
                  <span className="text-base font-normal text-muted-foreground">
                    /month
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <Button
                  className="w-full font-semibold"
                  variant={plan.highlighted ? "default" : "secondary"}
                >
                  {plan.cta}
                </Button>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground">
                {plan.id === "free"
                  ? "Includes unlimited mock timelines on public repos."
                  : "Cancel anytime. We prorate upgrades."}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
