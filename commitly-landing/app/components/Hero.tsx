'use client'

import Image from 'next/image'
import { WaitlistForm } from './WaitlistForm'
import { useLanguage } from '../contexts/LanguageContext'
import ColorBends from './ColorBends'
import CountUp from './CountUp'

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
    const { t } = useLanguage()

    return (
        <section className="w-full px-8 pt-2 pb-32">
            <div className="relative isolate rounded-2xl max-w-[1808px] mx-auto px-6 lg:px-14 overflow-hidden flex flex-col bg-black">
                <div aria-hidden className="absolute inset-0 -z-10">
                    <ColorBends
                        colors={["#FF0000", "#00FF00", "#0000FF"]}
                        rotation={0}
                        speed={0.2}
                        scale={1}
                        frequency={1}
                        warpStrength={1}
                        mouseInfluence={1}
                        parallax={0.5}
                        noise={0.1}
                        trackPointerGlobally
                        transparent
                    />
                </div>

                <div className="text-center max-w-[1100px] mx-auto pt-16 relative z-10 pb-14">
                    <h1 className="h1-hero font-semibold">
                        {t.heroTitle}
                    </h1>
                    <p className="sub-hero mt-3">
                        {t.heroSubtitle}
                    </p>

                    <WaitlistForm onHeroSubmit={onHeroSubmit} heroEmail={heroEmail} setHeroEmail={setHeroEmail} isSubmittingWaitlist={isSubmittingWaitlist} waitlistButtonLabel={waitlistButtonLabel} />

                    {/* Counter */}
                    <div className="mt-3 counter-shadow inline-flex items-center gap-2">
                        <span className="dot-green" />
                        <span><span className="text-green-400">{
                            <CountUp
                                from={0}
                                to={waitlistCount ?? 0}
                                separator=","
                                direction="up"
                                duration={1}
                                className="count-up-text"
                            />
                        }</span> {t.peopleJoined}</span>
                    </div>
                    {waitlistStatus !== 'idle' && (
                        <div className="mt-2 text-sm text-white/80">
                            {waitlistStatus === 'success' && t.successMessage}
                            {waitlistStatus === 'duplicate' && t.duplicateMessage}
                            {waitlistStatus === 'error' && t.errorMessage}
                        </div>
                    )}
                </div>

                {/* Editor mock */}
                <div className="hidden sm:block w-full max-w-[1180px] mx-auto px-4 sm:px-0" style={{ height: '26.25rem' }}>
                    <div className="rounded-t-md overflow-hidden editor-shadow h-full">
                        <Image
                            src="/editor-mock.jpg"
                            width={1180}
                            height={738}
                            alt="Editor mock"
                            priority
                            className="w-full h-full object-cover object-top"
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
