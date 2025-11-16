import { policyMeta } from "@/data/policies";

export default function SecurityPage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">
            Legal
          </p>
          <h1 className="font-semibold text-4xl">Security</h1>
          <p className="text-muted-foreground text-sm">
            Last updated {policyMeta.updated}
          </p>
        </header>
        <section className="space-y-4 text-base text-muted-foreground leading-relaxed">
          <p>
            Commitly uses encryption at rest and in transit, role-based access,
            secrets management, and continuous monitoring to keep your data
            private. Production access is limited to on-call engineers with
            hardware keys.
          </p>
          <h2 className="font-semibold text-foreground text-xl">Safeguards</h2>
          <p>
            We isolate customer data by workspace, store secrets in a dedicated
            vault, and monitor for anomalous behavior. Backups are encrypted and
            rotated every 12 hours.
          </p>
          <h2 className="font-semibold text-foreground text-xl">
            Responsible disclosure
          </h2>
          <p>
            If you discover a security issue, email {policyMeta.contact}.
            Include steps to reproduce so we can respond quickly.
          </p>
        </section>
      </article>
    </main>
  );
}
