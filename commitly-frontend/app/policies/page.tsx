import { FileText, Lock, Scale, Shield } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { policyLinks, policyMeta } from "@/data/policies";

const iconMap = {
  "Terms of use": Scale,
  "Privacy policy": Lock,
  "Data use": FileText,
  Security: Shield,
};

export default function PoliciesPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="rounded-3xl border border-border/60 bg-card/80 p-8 text-center shadow-black/30 shadow-xl">
          <p className="text-primary text-sm uppercase tracking-[0.35em]">
            Legal
          </p>
          <h1 className="mt-3 font-semibold text-4xl">Terms & policies</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Last updated {policyMeta.updated}. For security disclosures email{" "}
            {policyMeta.contact}.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {policyLinks.map((link) => {
            const Icon =
              iconMap[link.label as keyof typeof iconMap] ?? FileText;
            return (
              <Card
                className="flex flex-col justify-between border-border/60 bg-card/70 shadow-black/20 shadow-lg"
                key={link.href}
              >
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{link.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    {link.summary}
                  </p>
                  <Link
                    className="font-semibold text-primary text-sm underline underline-offset-4"
                    href={link.href}
                  >
                    View document
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 rounded-3xl border border-border/60 bg-card/70 p-6 md:grid-cols-2">
          <div>
            <p className="font-semibold text-muted-foreground text-sm uppercase tracking-[0.3em]">
              Compliance
            </p>
            <h2 className="mt-2 font-semibold text-2xl">
              Your data, your rules
            </h2>
            <p className="mt-3 text-muted-foreground text-sm">
              Commitly stores customer data in the EU and US with daily
              encrypted backups. SSO, audit trails, and data export are
              available on the Team plan.
            </p>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
              <p className="font-semibold text-sm">Data requests</p>
              <p className="text-muted-foreground text-sm">
                Email privacy@commitly.dev to request data exports or deletions.
                We respond within 5 business days.
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
              <p className="font-semibold text-sm">Security questions</p>
              <p className="text-muted-foreground text-sm">
                Contact {policyMeta.contact} for penetration-test results, SOC 2
                roadmap, or vendor reviews.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
