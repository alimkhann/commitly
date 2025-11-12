import Link from "next/link"

import { onboardingSteps } from "@/data/help-center"
import { Card, CardContent } from "@/components/ui/card"

export default function GettingStartedPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">
            Guide
          </p>
          <h1 className="text-4xl font-semibold">Getting started</h1>
          <p className="text-base text-muted-foreground">
            Follow these essentials to run your first commitly timeline and keep the workflow tidy.
          </p>
        </header>

        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <ol className="space-y-4 text-base text-muted-foreground">
              {onboardingSteps.map((step, index) => (
                <li key={step} className="flex gap-4">
                  <span className="text-sm font-semibold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div>
          <Link href="/help-center" className="text-sm text-primary">
            ← Back to Help center
          </Link>
        </div>
      </section>
    </main>
  )
}
