'use client'

import Image from 'next/image'

interface NavbarProps {
    isScrolled: boolean
    onSupportClick: () => void
    onWaitlistClick: () => void
}

export default function Navbar({ isScrolled, onSupportClick, onWaitlistClick }: NavbarProps) {
    return (
        <div className="nav-shell">
            <header
                className={`nav-pill px-4 sm:px-6 lg:px-2 py-2 transition-all duration-300 ${
                    isScrolled ? 'nav-scrolled' : 'nav-transparent'
                }`}
            >
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
                        <button 
                            onClick={onSupportClick} 
                            className="border border-white/20 rounded-md px-3.5 py-2 text-sm"
                        >
                            Support
                        </button>
                        <button 
                            onClick={onWaitlistClick} 
                            className="btn-white text-sm rounded-md"
                        >
                            Join waitlist
                        </button>
                    </div>
                </div>
            </header>
        </div>
    )
}
