import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { faqs } from "@/data/help-center";

export default function FAQPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="space-y-2">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">FAQ</p>
          <h1 className="font-semibold text-4xl">Frequently asked questions</h1>
          <p className="text-base text-muted-foreground">
            Still unsure? Reach out inside the product or reply to any
            onboarding email.
          </p>
        </header>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card className="border-border/60 bg-card/80" key={faq.question}>
              <CardHeader>
                <CardTitle className="text-lg">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {faq.answer}
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <Link className="text-primary text-sm" href="/help-center">
            ← Back to Help center
          </Link>
        </div>
      </section>
    </main>
  );
}
