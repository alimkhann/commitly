'use client'

import Image from 'next/image'

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
    return (
        <section className="w-full bg-black">
            <div className="max-w-[1344px] mx-auto px-6 sm:px-8 lg:px-20 xl:px-28 2xl:px-40">
                <div className="flex items-center justify-between gap-8 pb-48">
                    <div className="flex-1">
                        <h2 className="footer-title font-semibold">Join Waitlist</h2>
                        <form onSubmit={onHeroSubmit} className="mt-6">
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
                            src="/icons/icon_4x.png"
                            alt="Commitly"
                            width={512}
                            height={512}
                            className="w-56 h-56 md:w-96 md:h-96 opacity-100"
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
    )
}
