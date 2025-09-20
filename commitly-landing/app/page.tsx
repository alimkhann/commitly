'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'

const API_BASE = process.env.NEXT_PUBLIC_COMMITLY_API_BASE ?? 'https://commitly-m005.onrender.com'

type WaitlistStatus = 'idle' | 'success' | 'error' | 'duplicate'
type SupportStatus = 'idle' | 'success' | 'error'

export default function Page() {
    const [heroEmail, setHeroEmail] = useState('')
    const [waitlistEmail, setWaitlistEmail] = useState('')
    const [supportEmail, setSupportEmail] = useState('')
    const [message, setMessage] = useState('')

    const [waitlistCount, setWaitlistCount] = useState<number | null>(null)
    const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false)
    const [waitlistStatus, setWaitlistStatus] = useState<WaitlistStatus>('idle')
    const [isSubmittingSupport, setIsSubmittingSupport] = useState(false)
    const [supportStatus, setSupportStatus] = useState<SupportStatus>('idle')

    const [showWaitlistModal, setShowWaitlistModal] = useState(false)
    const [showSupportModal, setShowSupportModal] = useState(false)
    const [isScrolled, setIsScrolled] = useState(false)

    const navRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const setVar = () => {
            const h = navRef.current?.offsetHeight ?? 96
            document.documentElement.style.setProperty('--navH', `${h}px`)
        }
        setVar()
        window.addEventListener('resize', setVar)
        return () => window.removeEventListener('resize', setVar)
    }, [])

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50)
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const fetchWaitlistCount = useCallback(async () => {
        if (!API_BASE) {
            console.error('Missing NEXT_PUBLIC_COMMITLY_API_BASE environment variable')
            return
        }
        try {
            const res = await fetch(`${API_BASE}/api/v1/waitlist/count`)
            if (!res.ok) return
            const data = (await res.json()) as { count?: number }
            if (typeof data.count === 'number') setWaitlistCount(data.count)
        } catch (error) {
            console.error('Failed to fetch waitlist count', error)
        }
    }, [])

    useEffect(() => {
        fetchWaitlistCount()
        const t = setInterval(fetchWaitlistCount, 30_000)
        return () => clearInterval(t)
    }, [fetchWaitlistCount])

    useEffect(() => {
        const open = showWaitlistModal || showSupportModal
        document.body.classList.toggle('body-locked', open)
    }, [showWaitlistModal, showSupportModal])

    const waitlistButtonLabel = useMemo(() => {
        if (isSubmittingWaitlist) return 'Joining…'
        if (waitlistStatus === 'success') return "You're in! 🚀"
        if (waitlistStatus === 'duplicate') return 'Already joined'
        if (waitlistStatus === 'error') return 'Try again'
        return 'Join Waitlist'
    }, [isSubmittingWaitlist, waitlistStatus])

    const supportButtonLabel = useMemo(() => {
        if (isSubmittingSupport) return 'Sending…'
        if (supportStatus === 'success') return 'Thanks! We’ll reply soon.'
        if (supportStatus === 'error') return 'Try again'
        return 'Send'
    }, [isSubmittingSupport, supportStatus])

    const submitWaitlist = useCallback(
        async (email: string) => {
            if (!email) return
            if (!API_BASE) {
                setWaitlistStatus('error')
                return
            }
            setIsSubmittingWaitlist(true)
            try {
                const res = await fetch(`${API_BASE}/api/v1/waitlist/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, source: 'landing' }),
                })
                if (res.status === 409) {
                    setWaitlistStatus('duplicate')
                    return
                }
                if (!res.ok) throw new Error('failed')
                setWaitlistStatus('success')
                setWaitlistCount(c => (c ?? 0) + 1)
                fetchWaitlistCount()
            } catch (error) {
                console.error('Failed to submit waitlist entry', error)
                setWaitlistStatus('error')
            } finally {
                setIsSubmittingWaitlist(false)
                setTimeout(() => setWaitlistStatus('idle'), 2400)
            }
        },
        [fetchWaitlistCount]
    )

    const handleHeroSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault()
            const email = heroEmail
            setHeroEmail('')
            await submitWaitlist(email)
        },
        [heroEmail, submitWaitlist]
    )

    const handleWaitlistModalSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault()
            const email = waitlistEmail
            setWaitlistEmail('')
            await submitWaitlist(email)
            setTimeout(() => setShowWaitlistModal(false), 600)
        },
        [submitWaitlist, waitlistEmail]
    )

    const handleSupportSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault()
            if (!supportEmail || !message) return
            if (!API_BASE) {
                setSupportStatus('error')
                return
            }
            setIsSubmittingSupport(true)
            try {
                const res = await fetch(`${API_BASE}/api/v1/support/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: supportEmail, message }),
                })
                if (!res.ok) throw new Error('failed')
                setSupportStatus('success')
                setSupportEmail('')
                setMessage('')
                setTimeout(() => setShowSupportModal(false), 900)
            } catch (error) {
                console.error('Failed to submit support request', error)
                setSupportStatus('error')
            } finally {
                setIsSubmittingSupport(false)
                setTimeout(() => setSupportStatus('idle'), 2400)
            }
        },
        [message, supportEmail]
    )

    return (
        <div className="min-h-screen w-full bg-black">

            {/* NAV */}
            <div className="nav-shell">
                <header
                    ref={navRef}
                    className={`nav-pill px-4 sm:px-6 lg:px-2 py-2 transition-all duration-300 ${isScrolled ? 'nav-scrolled' : 'nav-transparent'
                    }`}>
                    <div className="w-full flex items-center justify-between">
                        <div className="px-2 flex items-center gap-3">
                            <Image
                                src="/icon.png"
                                alt="Commitly"
                                width={32}
                                height={32}
                                className="w-8 h-8"
                            />
                            <div className="text-2xl font-semibold tracking-[-0.02em]">commitly</div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSupportModal(true)} className="border border-white/20 rounded-md px-3.5 py-2 text-sm">
                                Support
                            </button>
                            <button onClick={() => setShowWaitlistModal(true)} className="btn-white text-sm rounded-md">
                                Join waitlist
                            </button>
                        </div>
                    </div>
                </header>
            </div>

            {/* HERO */}
            <section className="w-full px-8 pt-8 pb-32">
                <div
                    className="relative bg-hero rounded-2xl max-w-[1808px] mx-auto px-6 lg:px-14 overflow-hidden"
                    style={{ height: 'calc(100svh - var(--navH, 96px) - 48px)' }}
                >
                    <div className="gradient-vignette pointer-events-none" />

                    <div className="text-center max-w-[1100px] mx-auto pt-16 relative z-10">
                        <h1 className="h1-hero font-semibold">The AI Code Tutor</h1>
                        <p className="sub-hero mt-3">
                            Paste a github repo link, and let AI guide you build the project you want.
                        </p>

                        {/* Connected input + button */}
                        <form onSubmit={handleHeroSubmit} className="mt-6 flex items-center justify-center">
                            <div className="flex w-[min(640px,90vw)] rounded-lg overflow-hidden bg-black/70 shadow-[0_10px_30px_rgba(0,0,0,.45)] ring-1 ring-inset ring-white/10">
                                <input
                                    className="flex-1 px-5 bg-transparent text-white placeholder-white/60 border-none outline-none h-12 text-base"
                                    placeholder="johndoe@example.com"
                                    value={heroEmail}
                                    onChange={(e) => setHeroEmail(e.target.value)}
                                />
                                <button
                                    className="btn-white rounded-none px-5"
                                    disabled={isSubmittingWaitlist || !heroEmail}
                                >
                                    {waitlistButtonLabel}
                                </button>
                            </div>
                        </form>

                        {/* Counter */}
                        <div className="mt-3 counter-shadow inline-flex items-center gap-2">
                            <span className="dot-green" />
                            <span><span className="text-green-400">{waitlistCount ?? 0}</span> people already joined</span>
                        </div>
                        {waitlistStatus !== 'idle' && (
                            <div className="mt-2 text-sm text-white/80">
                                {waitlistStatus === 'success' && "You're in! 🚀"}
                                {waitlistStatus === 'duplicate' && "You're already on the list."}
                                {waitlistStatus === 'error' && 'Something went wrong. Please try again.'}
                            </div>
                        )}
                    </div>

                    {/* Editor mock */}
                    <div className="max-w-[1180px] mx-auto mt-14 pb-8">
                        <div className="rounded-md overflow-hidden editor-shadow">
                            <Image
                                src="/editor-mock.jpg"
                                width={1180}
                                height={738}
                                alt="Editor mock"
                                priority
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* FEATURES */}
            <section className="max-w-[1344px] mx-auto px-6 sm:px-8 lg:px-20 xl:px-28 2xl:px-40 pt-8 md:pt-12 pb-6 space-y-28">
                <div>
                    <div className="text-center mb-6">
                        <h3 className="section-h">Commit History Roadmap</h3>
                        <p className="section-sub">Turn any repo’s commit history into clear chapters with the key diffs.</p>
                    </div>
                    <div className="relative bg-card-1 noise feature-card overflow-hidden">
                        <div className="gradient-vignette" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Image src="/icon-commit.svg" alt="Commit tree" width={230} height={191} />
                        </div>
                    </div>
                </div>

                <div>
                    <div className="text-center mb-6">
                        <h3 className="section-h">Hands-on tasks &amp; tests</h3>
                        <p className="section-sub">Small, scoped tasks with failing tests — learn by making red turn green.</p>
                    </div>
                    <div className="relative bg-card-2 noise feature-card overflow-hidden">
                        <div className="gradient-vignette" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Image src="/icon-check.svg" alt="Checklist" width={230} height={206} />
                        </div>
                    </div>
                </div>

                <div>
                    <div className="text-center mb-6">
                        <h3 className="section-h">Socratic hints</h3>
                        <p className="section-sub">Hints first. If you’re stuck, reveal a tiny patch — not a wall of code.</p>
                    </div>
                    <div className="relative bg-card-3 noise feature-card overflow-hidden">
                        <div className="gradient-vignette" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Image src="/icon-bulb.svg" alt="Lightbulb" width={230} height={340} />
                        </div>
                    </div>
                </div>
            </section>

            {/* BOTTOM CTA */}
            <section className="w-full bg-black">
                <div className="max-w-[1344px] mx-auto px-6 sm:px-8 lg:px-20 xl:px-28 2xl:px-40">
                    <div className="flex items-center justify-between gap-8 pb-48">
                        <div className="flex-1">
                            <h2 className="footer-title font-semibold">Join Waitlist</h2>
                            <form onSubmit={handleHeroSubmit} className="mt-6">
                                <div className="flex w-[min(640px,90vw)] rounded-lg overflow-hidden bg-black/70 shadow-[0_10px_30px_rgba(0,0,0,.45)] ring-1 ring-inset ring-white/10">
                                    <input
                                        className="input-dark flex-1 px-5"
                                        placeholder="johndoe@example.com"
                                        value={heroEmail}
                                        onChange={(e) => setHeroEmail(e.target.value)}
                                    />
                                    <button
                                        className="btn-white rounded-none px-5"
                                        disabled={isSubmittingWaitlist || !heroEmail}
                                    >
                                        {waitlistButtonLabel}
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="flex-shrink-0">
                            <Image
                                src="/icon.png"
                                alt="Commitly"
                                width={512}
                                height={512}
                                className="w-56 h-56 md:w-96 md:h-96 opacity-60"
                            />
                        </div>
                    </div>

                    <footer className="mt-16 flex flex-wrap items-end justify-between gap-6 text-[#999] pb-24">
                        <div className="flex items-center gap-2 text-base">
                            <span>© 2025 Commitly</span>
                            <span>•</span>
                            <a className="underline-offset-2 hover:underline" href="https://github.com/alimkhann" target="_blank">Alimkhan Yergebayev</a>
                        </div>
                        <nav className="flex items-center gap-6 text-base">
                            <a href="/terms" className="text-[#d9d9d9] hover:underline underline-offset-2">Terms</a>
                            <a href="/privacy" className="text-[#d9d9d9] hover:underline underline-offset-2">Privacy</a>
                        </nav>
                    </footer>
                </div>
            </section>

            {/* Waitlist Modal */}
            {showWaitlistModal && createPortal(
                <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50">
                    <div className="bg-[#0d0f12] text-white rounded-2xl p-6 w-full max-w-md ring-1 ring-white/10">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xl font-semibold">Join the Waitlist</h3>
                            <button onClick={() => setShowWaitlistModal(false)} className="text-white/60 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleWaitlistModalSubmit} className="space-y-3">
                            <div className="flex rounded-lg overflow-hidden bg-black/70 ring-1 ring-inset ring-white/10">
                                <input className="input-dark flex-1 px-5"
                                    placeholder="email@domain.com"
                                    value={waitlistEmail}
                                    onChange={(e) => setWaitlistEmail(e.target.value)} />
                                <button disabled={isSubmittingWaitlist || !waitlistEmail}
                                    className="btn-white rounded-none px-5 disabled:opacity-60">
                                    {waitlistButtonLabel}
                                </button>
                            </div>
                            {waitlistStatus !== 'idle' && (
                                <p className="text-sm text-white/70">
                                    {waitlistStatus === 'success' && 'You are on the list! 🚀'}
                                    {waitlistStatus === 'duplicate' && "Looks like you're already signed up."}
                                    {waitlistStatus === 'error' && 'Something went wrong. Please try again.'}
                                </p>
                            )}
                        </form>
                    </div>
                </div>, document.body)}

            {/* Support Modal */}
            {showSupportModal && createPortal(
                <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50">
                    <div className="bg-[#0d0f12] text-white rounded-2xl p-6 w-full max-w-md ring-1 ring-white/10">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xl font-semibold">We’re here to help</h3>
                            <button onClick={() => setShowSupportModal(false)} className="text-white/60 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleSupportSubmit} className="space-y-3">
                            <input className="w-full bg-black/70 text-white placeholder-white/50 border border-white/10 rounded-lg px-4 h-11"
                                placeholder="Your email"
                                value={supportEmail}
                                onChange={(e) => setSupportEmail(e.target.value)}
                                required />
                            <textarea className="w-full bg-black/70 text-white placeholder-white/50 border border-white/10 rounded-lg px-4 py-3 h-24 resize-none"
                                placeholder="Your question…"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                required />
                            <button disabled={isSubmittingSupport || !supportEmail || !message}
                                className="w-full h-11 rounded-lg bg-white text-black font-medium disabled:opacity-60">
                                {supportButtonLabel}
                            </button>
                            {supportStatus !== 'idle' && (
                                <p className="text-sm text-white/70">
                                    {supportStatus === 'success' && 'We received your message.'}
                                    {supportStatus === 'error' && 'Something went wrong. Please try again.'}
                                </p>
                            )}
                        </form>
                    </div>
                </div>, document.body)}
        </div>
    )
}
