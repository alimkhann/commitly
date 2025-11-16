import { ArrowRight, Headphones, Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { helpCards } from "@/data/help-center";

export default function HelpCenterPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="grid gap-6 rounded-3xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/30 md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="text-primary text-sm uppercase tracking-[0.35em]">
              Support
            </p>
            <h1 className="mt-2 font-semibold text-4xl">How can we help?</h1>
            <p className="mt-3 text-base text-muted-foreground">
              Browse guides, track product changes, or reach a human. Commitly
              support stays close to the product team, so every ticket helps
              improve the roadmap.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-border/50 bg-background/40 p-4">
            <div className="flex items-center gap-3">
              <Headphones className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Live support</p>
                <p className="text-muted-foreground text-xs">
                  Mon‒Fri, 9am–6pm UTC
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Email</p>
                <p className="text-muted-foreground text-xs">
                  support@commitly.dev
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <div>
            <p className="font-semibold text-primary text-sm uppercase tracking-wide">
              Library
            </p>
            <h2 className="font-semibold text-2xl">
              Start with the essentials
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {helpCards.map((card) => (
              <Card
                className="border-border/60 bg-card/80 shadow-black/25 shadow-lg"
                key={card.title}
              >
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button
                    asChild
                    className="w-full justify-between"
                    variant="ghost"
                  >
                    <Link href={card.href}>
                      <span>Open guide</span>
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
