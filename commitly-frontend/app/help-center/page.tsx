import Link from "next/link"
import { ArrowRight, Headphones, Mail } from "lucide-react"

import { helpCards } from "@/data/help-center"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function HelpCenterPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="grid gap-6 rounded-3xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/30 md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="text-sm uppercase tracking-[0.35em] text-primary">
              Support
            </p>
            <h1 className="mt-2 text-4xl font-semibold">How can we help?</h1>
            <p className="mt-3 text-base text-muted-foreground">
              Browse guides, track product changes, or reach a human. Commitly support stays
              close to the product team, so every ticket helps improve the roadmap.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-border/50 bg-background/40 p-4">
            <div className="flex items-center gap-3">
              <Headphones className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Live support</p>
                <p className="text-xs text-muted-foreground">Mon‒Fri, 9am–6pm UTC</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">support@commitly.dev</p>
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              Library
            </p>
            <h2 className="text-2xl font-semibold">Start with the essentials</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {helpCards.map((card) => (
              <Card
                key={card.title}
                className="border-border/60 bg-card/80 shadow-lg shadow-black/25"
              >
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button variant="ghost" className="w-full justify-between" asChild>
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
  )
}
