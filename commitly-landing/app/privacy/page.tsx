'use client'
import { useMemo, useState, useEffect } from 'react'

const dict = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated',
    intro:
      'Commitly respects your privacy. This page collects only the data you voluntarily submit to join our waitlist or ask for support.',
    collectTitle: 'Information We Collect',
    c1: 'Email address (and optional name) when you join the waitlist.',
    c2: 'For attribution: referrer URL, UTM parameters, locale, timezone, and browser user agent.',
    c3: 'When you contact support: your email and the message you send.',
    useTitle: 'How We Use Information',
    u1: 'To confirm your waitlist signup and send product updates.',
    u2: 'To respond to support requests.',
    u3: 'To understand interest and improve our marketing (aggregate only).',
    shareTitle: 'Data Sharing',
    share:
      'We do not sell your data. We use Supabase to securely store submissions; service providers process data on our behalf only.',
    retainTitle: 'Data Retention',
    retain:
      'We keep your data until launch or until you ask us to delete it, unless the law requires longer.',
    rightsTitle: 'Your Rights',
    rights: 'Request access or deletion by emailing',
    kidsTitle: 'Children',
    kids: 'This site is intended for users 16+.',
    changeTitle: 'Changes',
    change: 'We may update this policy and will update the date above.',
    back: '← Back to home',
  },
} as const

export default function Privacy() {
  const [lang, setLang] = useState<'en'>('en')
  const t = useMemo(() => dict[lang], [lang])

  useEffect(() => { document.title = 'Commitly — Privacy' }, [])

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 lg:px-16 py-12 text-white">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <p className="mt-1 text-white/60">{t.updated}: {new Date().toLocaleDateString('en-US')}</p>

      <div className="mt-6 space-y-5 text-white/90">
        <p>{t.intro}</p>

        <h2 className="mt-6 text-xl font-semibold">{t.collectTitle}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t.c1}</li>
          <li>{t.c2}</li>
          <li>{t.c3}</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">{t.useTitle}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t.u1}</li>
          <li>{t.u2}</li>
          <li>{t.u3}</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">{t.shareTitle}</h2>
        <p>{t.share}</p>

        <h2 className="mt-6 text-xl font-semibold">{t.retainTitle}</h2>
        <p>{t.retain}</p>

        <h2 className="mt-6 text-xl font-semibold">{t.rightsTitle}</h2>
        <p>{t.rights} <strong>alimkhan.ergebayev@gmail.com</strong>.</p>

        <h2 className="mt-6 text-xl font-semibold">{t.kidsTitle}</h2>
        <p>{t.kids}</p>

        <h2 className="mt-6 text-xl font-semibold">{t.changeTitle}</h2>
        <p>{t.change}</p>

        <p className="pt-6">
          <a className="text-white underline underline-offset-4" href="/"> {t.back}</a>
        </p>
      </div>
    </main>
  )
}
