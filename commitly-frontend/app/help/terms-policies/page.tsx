export default function TermsPoliciesPage() {
  return (
    <div className="flex flex-col gap-6 p-12 text-white">
      <h1 className="font-teachers text-5xl">Terms &amp; Policies</h1>
      <p className="text-white/80 text-lg max-w-2xl">
        This lightweight summary highlights how Commitly handles your data while we finalise the legal copy.
      </p>
      <div className="space-y-4 text-white/70">
        <section>
          <h2 className="font-teachers text-3xl text-white">Usage</h2>
          <p>Imports are limited by GitHub rate limits. Abuse, spam, or infringing content may be removed.</p>
        </section>
        <section>
          <h2 className="font-teachers text-3xl text-white">Privacy</h2>
          <p>We store minimal repository metadata and AI summaries to speed up future imports. Chat history is retained per user and can be deleted from settings.</p>
        </section>
        <section>
          <h2 className="font-teachers text-3xl text-white">Security</h2>
          <p>Authentication is handled by Supabase. You may revoke access or delete your account at any time.</p>
        </section>
      </div>
    </div>
  )
}
