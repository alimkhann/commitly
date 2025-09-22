'use client'

import { useEffect, useRef, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import BottomCTA from './components/BottomCTA'
import WaitlistModal from './components/WaitlistModal'
import { useWaitlistAndDonate } from './hooks/useWaitlistAndDonate'

export default function Page() {
    const [isScrolled, setIsScrolled] = useState(false)
    const navRef = useRef<HTMLDivElement | null>(null)

    const {
        heroEmail,
        setHeroEmail,
        waitlistEmail,
        setWaitlistEmail,
        waitlistCount,
        isSubmittingWaitlist,
        waitlistStatus,
        showWaitlistModal,
        setShowWaitlistModal,
        waitlistButtonLabel,
        handleHeroSubmit,
        handleWaitlistModalSubmit,
        donate,
    } = useWaitlistAndDonate()

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

    return (
        <div className="min-h-screen w-full bg-black">
            <Navbar
                isScrolled={isScrolled}
                onDonateClick={donate}
                onWaitlistClick={() => setShowWaitlistModal(true)}
            />

            <Hero
                heroEmail={heroEmail}
                setHeroEmail={setHeroEmail}
                waitlistCount={waitlistCount}
                waitlistStatus={waitlistStatus}
                isSubmittingWaitlist={isSubmittingWaitlist}
                waitlistButtonLabel={waitlistButtonLabel}
                onHeroSubmit={handleHeroSubmit}
            />

            <Features />

            <BottomCTA
                heroEmail={heroEmail}
                setHeroEmail={setHeroEmail}
                isSubmittingWaitlist={isSubmittingWaitlist}
                waitlistButtonLabel={waitlistButtonLabel}
                onHeroSubmit={handleHeroSubmit}
            />

            <WaitlistModal
                show={showWaitlistModal}
                waitlistEmail={waitlistEmail}
                setWaitlistEmail={setWaitlistEmail}
                waitlistStatus={waitlistStatus}
                isSubmittingWaitlist={isSubmittingWaitlist}
                waitlistButtonLabel={waitlistButtonLabel}
                onClose={() => setShowWaitlistModal(false)}
                onSubmit={handleWaitlistModalSubmit}
            />
        </div>
    )
}
