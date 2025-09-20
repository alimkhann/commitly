'use client'
import { useMemo, useState, useEffect } from 'react'

const dict = {
  en: {
    title: 'Terms of Service',
    updated: 'Last updated',
    intro:
      'These Terms govern your use of the Commitly landing site and your participation in our waitlist. By submitting your email you agree to receive updates, beta invites, and launch announcements. You can unsubscribe any time.',
    useTitle: 'Use of the Site',
    use1: 'Do not attempt to disrupt, probe, or misuse the service.',
    use2: 'All content is provided “as is” without warranties.',
    waitlistTitle: 'Waitlist',
    waitlist:
      'Joining the waitlist does not guarantee access, features, or specific timelines.',
    ipTitle: 'Intellectual Property',
    ip: 'All trademarks, logos, and content on this site are owned by Commitly unless otherwise stated.',
    limitTitle: 'Limitation of Liability',
    limit:
      'To the maximum extent permitted by law, Commitly is not liable for indirect, incidental, or consequential damages.',
    contactTitle: 'Contact',
    contact: 'Questions? Email',
    back: '← Back to home',
  },
} as const

export default function Terms() {
  const [lang, setLang] = useState<'en'>('en')
  const t = useMemo(() => dict[lang], [lang])

  useEffect(() => { document.title = 'Commitly — Terms' }, [])

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 lg:px-16 py-12 text-white">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <p className="mt-1 text-white/60">{t.updated}: {new Date().toLocaleDateString('en-US')}</p>

      <div className="mt-6 space-y-5 text-white/90">
        <p>{t.intro}</p>

        <h2 className="mt-6 text-xl font-semibold">{t.useTitle}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t.use1}</li>
          <li>{t.use2}</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">{t.waitlistTitle}</h2>
        <p>{t.waitlist}</p>

        <h2 className="mt-6 text-xl font-semibold">{t.ipTitle}</h2>
        <p>{t.ip}</p>

        <h2 className="mt-6 text-xl font-semibold">{t.limitTitle}</h2>
        <p>{t.limit}</p>

        <h2 className="mt-6 text-xl font-semibold">{t.contactTitle}</h2>
        <p>{t.contact} <strong>alimkhan.ergebayev@gmail.com</strong>.</p>

        <p className="pt-6">
          <a className="text-white underline underline-offset-4" href="/"> {t.back}</a>
        </p>
      </div>
    </main>
  )
}
