'use client'

import Image from 'next/image'
import { useLanguage } from '../contexts/LanguageContext'
import LanguageDropdown from './LanguageDropdown'

interface NavbarProps {
    isScrolled: boolean
    onDonateClick: () => void
    onWaitlistClick: () => void
}

export default function Navbar({ isScrolled, onDonateClick, onWaitlistClick }: NavbarProps) {
    const { t } = useLanguage()

    return (
        <div className="nav-shell">
            <header
                className={`nav-pill px-4 sm:px-6 lg:px-2 py-2 transition-all duration-300 ${isScrolled ? 'nav-scrolled' : 'nav-transparent'
                    }`}
            >
                <div className="w-full flex items-center justify-between">
                    <div className="px-2 flex items-center gap-2 sm:gap-3">
                        <Image
                            src="/icons/icon_1x.png"
                            alt="Commitly"
                            width={32}
                            height={32}
                            className="w-6 h-6 sm:w-8 sm:h-8"
                        />
                        <div className="text-lg sm:text-2xl font-semibold tracking-[-0.02em]">commitly</div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3">
                        <div className="hidden sm:block">
                            <LanguageDropdown />
                        </div>
                        <button
                            onClick={onDonateClick}
                            className="border border-white/20 rounded-md px-2 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm"
                        >
                            ♥️ Buy us a coffee
                        </button>
                        <button
                            onClick={onWaitlistClick}
                            className="btn-white text-xs sm:text-sm rounded-md px-2 sm:px-3.5 py-1.5 sm:py-2"
                        >
                            {t.joinWaitlist}
                        </button>
                    </div>
                </div>
            </header>
        </div>
    )
}
