'use client'

import { useLanguage } from '../contexts/LanguageContext'

interface WaitlistFormProps {
    onHeroSubmit: (e: React.FormEvent) => void
    heroEmail: string
    setHeroEmail: (email: string) => void
    isSubmittingWaitlist: boolean
    waitlistButtonLabel: string
}

export const WaitlistForm = ({onHeroSubmit, heroEmail, setHeroEmail, isSubmittingWaitlist, waitlistButtonLabel}: WaitlistFormProps) => {
    const { t } = useLanguage()

    return (
        <>
            {/* Connected input + button */}
            <form onSubmit={onHeroSubmit} className="mt-6 flex items-center justify-center">
            <div className="flex w-full max-w-[640px] rounded-lg overflow-hidden bg-black/70 shadow-[0_10px_30px_rgba(0,0,0,.45)] ring-1 ring-inset ring-white/10">
                <input
                    className="flex-1 px-2 sm:px-5 bg-transparent text-white placeholder-white/60 border-none outline-none h-10 sm:h-12 text-xs sm:text-base"
                    placeholder={t.emailPlaceholder}
                    value={heroEmail}
                    onChange={(e) => setHeroEmail(e.target.value)}
                />
                <button
                    className="btn-white rounded-none px-2 sm:px-5 text-xs sm:text-base whitespace-nowrap"
                    disabled={isSubmittingWaitlist || !heroEmail}
                >
                    {waitlistButtonLabel}
                </button>
            </div>
        </form>
        </>
    )
}