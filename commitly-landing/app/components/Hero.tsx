'use client'

import Image from 'next/image'
import { WaitlistForm } from './WaitlistForm'

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
                className="relative bg-hero rounded-2xl max-w-[1808px] mx-auto px-6 lg:px-14 overflow-hidden hero-height"
            >
                <div className="gradient-vignette pointer-events-none" />

                <div className="text-center max-w-[1100px] mx-auto pt-16 relative z-10">
                    <h1 className="h1-hero font-semibold">The AI Code Tutor</h1>
                    <p className="sub-hero mt-3">
                        Paste a github repo link, and let AI guide you build the project you want.
                    </p>

                    <WaitlistForm onHeroSubmit={onHeroSubmit} heroEmail={heroEmail} setHeroEmail={setHeroEmail} isSubmittingWaitlist={isSubmittingWaitlist} waitlistButtonLabel={waitlistButtonLabel} />

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
                <div className="hidden sm:block w-full max-w-[1180px] mx-auto mt-8 sm:mt-14 pb-8 px-4 sm:px-0">
                    <div className="rounded-md overflow-hidden editor-shadow">
                        <Image
                            src="/editor-mock.jpg"
                            width={1180}
                            height={738}
                            alt="Editor mock"
                            priority
                            className="w-full h-auto"
                            style={{
                                maxWidth: '100%',
                                height: 'auto',
                                aspectRatio: '1180/738'
                            }}
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
