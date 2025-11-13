import { policyMeta } from "@/data/policies"

export default function DataUsePage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">Legal</p>
          <h1 className="text-4xl font-semibold">Data use</h1>
          <p className="text-sm text-muted-foreground">
            Last updated {policyMeta.updated}
          </p>
        </header>
        <section className="space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            When you connect a repository, commitly clones it temporarily to extract structure, commits, and metadata.
            We store derived artifacts (like dependency graphs) for the lifespan of the timeline so we can regenerate hints.
          </p>
          <h2 className="text-xl font-semibold text-foreground">Processing</h2>
          <p>
            Processing happens on servers located in the US or EU. We do not retain Git history longer than necessary, and
            you can wipe all derived data by deleting the workspace or revoking GitHub access.
          </p>
          <h2 className="text-xl font-semibold text-foreground">Sharing</h2>
          <p>
            We do not sell your data. We only share it with infrastructure vendors (storage, observability) bound by strict
            confidentiality and security commitments.
          </p>
        </section>
      </article>
    </main>
  )
}
