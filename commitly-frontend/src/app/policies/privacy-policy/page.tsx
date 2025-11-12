import { policyMeta } from "@/data/policies"

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">Legal</p>
          <h1 className="text-4xl font-semibold">Privacy policy</h1>
          <p className="text-sm text-muted-foreground">
            Last updated {policyMeta.updated}
          </p>
        </header>
        <section className="space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            This Privacy Policy explains what data we collect when you use commitly, how we use it, and your choices.
            We collect information you provide (like account details) and information generated while using the product
            (like device metadata or usage analytics).
          </p>
          <h2 className="text-xl font-semibold text-foreground">
            What we collect
          </h2>
          <p>
            Account basics (name, email), repository metadata, and feature usage are required to operate the service.
            When you import a repo we process its contents to build timelines. We do not train foundation models on
            private repo data.
          </p>
          <h2 className="text-xl font-semibold text-foreground">
            How we use information
          </h2>
          <p>
            Data helps us: provide the product, troubleshoot issues, improve features, secure the platform, and comply
            with legal obligations. We retain repo-derived data only while your workspace needs it; deleting a repo removes
            cached context within seven days.
          </p>
        </section>
      </article>
    </main>
  )
}
