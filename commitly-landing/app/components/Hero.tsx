'use client'

import Image from 'next/image'

type WaitlistStatus = 'idle' | 'success' | 'error' | 'duplicate'

interface HeroProps {
    heroEmail: string
    setHeroEmail: (email: string) => void
    waitlistCount: number | null
    waitlistStatus: WaitlistStatus
    isSubmittingWaitlist: boolean
    waitlistButtonLabel: string
    onHeroSubmit: (e: React.FormEvent) => void
}

export default function Hero({
    heroEmail,
    setHeroEmail,
    waitlistCount,
    waitlistStatus,
    isSubmittingWaitlist,
    waitlistButtonLabel,
    onHeroSubmit
}: HeroProps) {
    return (
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
                    <form onSubmit={onHeroSubmit} className="mt-6 flex items-center justify-center">
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
    )
}
