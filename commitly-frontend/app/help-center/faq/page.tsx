import Link from "next/link"

import { faqs } from "@/data/help-center"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function FAQPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">FAQ</p>
          <h1 className="text-4xl font-semibold">Frequently asked questions</h1>
          <p className="text-base text-muted-foreground">
            Still unsure? Reach out inside the product or reply to any onboarding email.
          </p>
        </header>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.question} className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {faq.answer}
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <Link href="/help-center" className="text-sm text-primary">
            ← Back to Help center
          </Link>
        </div>
      </section>
    </main>
  )
}
