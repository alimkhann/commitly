'use client'

import { WaitlistForm } from './WaitlistForm'
import { useLanguage } from '../contexts/LanguageContext'
import ColorBends from './ColorBends'
import CountUp from './CountUp'

type WaitlistStatus = 'idle' | 'success' | 'error' | 'duplicate'

interface HeroProps {
    heroEmail: string
    setHeroEmail: (email: string) => void
    waitlistCount: number
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
        <section className="w-full pt-2 pb-32">
            <div className="relative isolate w-full overflow-hidden flex flex-col bg-black min-h-[calc(100vh-1rem)] justify-center px-6 lg:px-14">
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
                                to={waitlistCount}
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
            </div>
        </section>
    )
}
