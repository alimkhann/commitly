import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { onboardingSteps } from "@/data/help-center";

export default function GettingStartedPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">
            Guide
          </p>
          <h1 className="font-semibold text-4xl">Getting started</h1>
          <p className="text-base text-muted-foreground">
            Follow these essentials to run your first commitly timeline and keep
            the workflow tidy.
          </p>
        </header>

        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <ol className="space-y-4 text-base text-muted-foreground">
              {onboardingSteps.map((step, index) => (
                <li className="flex gap-4" key={step}>
                  <span className="font-semibold text-primary text-sm">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div>
          <Link className="text-primary text-sm" href="/help-center">
            ← Back to Help center
          </Link>
        </div>
      </section>
    </main>
  );
}
