import { policyMeta } from "@/data/policies";

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-primary text-sm uppercase tracking-[0.3em]">
            Legal
          </p>
          <h1 className="font-semibold text-4xl">Terms of use</h1>
          <p className="text-muted-foreground text-sm">
            Last updated {policyMeta.updated}
          </p>
        </header>
        <section className="space-y-4 text-base text-muted-foreground leading-relaxed">
          <p>
            These Terms of Use (“Terms”) govern how you access and use commitly,
            the timeline builder, our API, and any related services. By using
            the product you agree to these Terms, including updates we may post
            in this document. If you do not agree, don’t use the service.
          </p>
          <h2 className="font-semibold text-foreground text-xl">
            Use of the service
          </h2>
          <p>
            You may only use commitly for lawful purposes. You are responsible
            for the repositories you import, the content you submit, and
            ensuring you have rights to grant us access to that content. We may
            suspend accounts that abuse rate limits, attempt to reverse engineer
            the service, or otherwise disrupt other users.
          </p>
          <h2 className="font-semibold text-foreground text-xl">
            Intellectual property
          </h2>
          <p>
            Commitly retains ownership of the platform, documentation, and brand
            assets. You retain ownership of your code and data. We request
            limited access to analyze a repo and build timelines, and we delete
            derived data once you remove the repo from commitly.
          </p>
        </section>
      </article>
    </main>
  );
}
