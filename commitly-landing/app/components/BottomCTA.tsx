'use client'

import Image from 'next/image'
import { WaitlistForm } from './WaitlistForm'
import { useLanguage } from '../contexts/LanguageContext'
import LanguageDropdown from './LanguageDropdown'

type WaitlistStatus = 'idle' | 'success' | 'error' | 'duplicate'

interface BottomCTAProps {
    heroEmail: string
    setHeroEmail: (email: string) => void
    isSubmittingWaitlist: boolean
    waitlistButtonLabel: string
    onHeroSubmit: (e: React.FormEvent) => void
}

export default function BottomCTA({
    heroEmail,
    setHeroEmail,
    isSubmittingWaitlist,
    waitlistButtonLabel,
    onHeroSubmit
}: BottomCTAProps) {
    const { t } = useLanguage()

    return (
        <section className="w-full bg-black">
            <div className="max-w-[1344px] mx-auto px-6 sm:px-8 lg:px-20 xl:px-28 2xl:px-40">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-8 pb-24 sm:pb-48">
                    <div className="flex-1 w-full sm:w-auto">
                        <h2 className="footer-title font-semibold">{t.joinWaitlistTitle}</h2>
                        <WaitlistForm onHeroSubmit={onHeroSubmit} heroEmail={heroEmail} setHeroEmail={setHeroEmail} isSubmittingWaitlist={isSubmittingWaitlist} waitlistButtonLabel={waitlistButtonLabel} />
                    </div>

                    <div className="hidden sm:block flex-shrink-0">
                        <Image
                            src="/icons/icon_4x.png"
                            alt="Commitly"
                            width={512}
                            height={512}
                            className="w-56 h-56 md:w-96 md:h-96 opacity-100"
                            style={{
                                maxWidth: '100%',
                                height: 'auto',
                                aspectRatio: '512/512'
                            }}
                        />
                    </div>
                </div>

                <footer className="mt-16 flex flex-wrap items-end justify-between gap-6 text-[#999] pb-24">
                    <div className="flex items-center gap-2 text-base">
                        <span>{t.copyright}</span>
                        <span>•</span>
                        <a className="underline-offset-2 hover:underline" href="https://linkedin.com/in/alimkhan-yergebayev" target="_blank">Contact Us</a>
                    </div>
                    <nav className="flex items-center gap-6 text-base">
                        <a href="/terms" className="text-[#d9d9d9] hover:underline underline-offset-2">{t.terms}</a>
                        <a href="/privacy" className="text-[#d9d9d9] hover:underline underline-offset-2">{t.privacy}</a>
                        <div className="sm:hidden">
                            <LanguageDropdown variant="footer" />
                        </div>
                    </nav>
                </footer>
            </div>
        </section>
    )
}
