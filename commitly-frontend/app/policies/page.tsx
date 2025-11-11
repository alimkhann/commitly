import Link from "next/link"
import { Shield, Lock, Scale, FileText } from "lucide-react"

import { policyLinks, policyMeta } from "@/data/policies"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const iconMap = {
  "Terms of use": Scale,
  "Privacy policy": Lock,
  "Data use": FileText,
  Security: Shield,
}

export default function PoliciesPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="rounded-3xl border border-border/60 bg-card/80 p-8 text-center shadow-xl shadow-black/30">
          <p className="text-sm uppercase tracking-[0.35em] text-primary">Legal</p>
          <h1 className="mt-3 text-4xl font-semibold">Terms & policies</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Last updated {policyMeta.updated}. For security disclosures email {policyMeta.contact}.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {policyLinks.map((link) => {
            const Icon = iconMap[link.label as keyof typeof iconMap] ?? FileText
            return (
              <Card
                key={link.href}
                className="flex flex-col justify-between border-border/60 bg-card/70 shadow-lg shadow-black/20"
              >
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{link.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{link.summary}</p>
                  <Link
                    href={link.href}
                    className="text-sm font-semibold text-primary underline underline-offset-4"
                  >
                    View document
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </section>

        <section className="grid gap-4 rounded-3xl border border-border/60 bg-card/70 p-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Compliance
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Your data, your rules</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Commitly stores customer data in the EU and US with daily encrypted backups.
              SSO, audit trails, and data export are available on the Team plan.
            </p>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
              <p className="text-sm font-semibold">Data requests</p>
              <p className="text-sm text-muted-foreground">
                Email privacy@commitly.dev to request data exports or deletions. We respond within 5 business days.
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
              <p className="text-sm font-semibold">Security questions</p>
              <p className="text-sm text-muted-foreground">
                Contact {policyMeta.contact} for penetration-test results, SOC 2 roadmap, or vendor reviews.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
