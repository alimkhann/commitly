import { policyMeta } from "@/data/policies";

export default function DataUsePage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">
            Legal
          </p>
          <h1 className="font-semibold text-4xl">Data use</h1>
          <p className="text-muted-foreground text-sm">
            Last updated {policyMeta.updated}
          </p>
        </header>
        <section className="space-y-4 text-base text-muted-foreground leading-relaxed">
          <p>
            When you connect a repository, commitly clones it temporarily to
            extract structure, commits, and metadata. We store derived artifacts
            (like dependency graphs) for the lifespan of the timeline so we can
            regenerate hints.
          </p>
          <h2 className="font-semibold text-foreground text-xl">Processing</h2>
          <p>
            Processing happens on servers located in the US or EU. We do not
            retain Git history longer than necessary, and you can wipe all
            derived data by deleting the workspace or revoking GitHub access.
          </p>
          <h2 className="font-semibold text-foreground text-xl">Sharing</h2>
          <p>
            We do not sell your data. We only share it with infrastructure
            vendors (storage, observability) bound by strict confidentiality and
            security commitments.
          </p>
        </section>
      </article>
    </main>
  );
}
