'use client'

import { useRouter } from 'next/navigation'

export default function PlansPage() {
    const router = useRouter()
    return (
        <main className="min-h-screen w-full bg-black text-white px-6 py-8">
            <div className="max-w-[1856px] mx-auto">
                <div className="flex items-start justify-between">
                    <div />
                    <button
                        aria-label="Close"
                        onClick={() => router.back()}
                        className="p-2 hover:bg-white/10 rounded"
                    >
                        <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 3L13 13M13 3L3 13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <h1 className="font-teachers font-normal text-[40px] sm:text-[48px] text-center mt-8">Upgrade your plan</h1>

                <div className="w-[1344px] mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {/* Free */}
                    <section className="border-2 border-white rounded p-8 h-full flex flex-col gap-6">
                        <h2 className="font-teachers font-bold text-[32px]">Free</h2>
                        <div className="flex items-end gap-2">
                            <span className="text-[#A6A6A6] text-[20px]">$</span>
                            <span className="text-[64px] leading-none">0</span>
                            <div className="text-[#A6A6A6] text-[16px] leading-tight">
                                <div>USD/</div>
                                <div>month</div>
                            </div>
                        </div>
                        <p className="font-teachers text-[24px]">Plan description</p>
                        <button className="w-full bg-[#AFAFAF] text-black rounded py-2 text-[24px]">Current Plan</button>
                        <ul className="mt-2 space-y-3 text-[20px]">
                            <li>Plan feat 1</li>
                            <li>Plan feat 2</li>
                            <li>Plan feat 3</li>
                            <li>Plan feat 4</li>
                        </ul>
                    </section>

                    {/* Pro */}
                    <section className="border-2 border-white rounded p-8 h-full flex flex-col gap-6">
                        <h2 className="font-teachers font-bold text-[32px]">Pro</h2>
                        <div className="flex items-end gap-2">
                            <span className="text-[#A6A6A6] text-[20px]">$</span>
                            <span className="text-[64px] leading-none">15</span>
                            <div className="text-[#A6A6A6] text-[16px] leading-tight">
                                <div>USD/</div>
                                <div>month</div>
                            </div>
                        </div>
                        <p className="font-teachers text-[24px]">Plan description</p>
                        <button className="w-full bg-white text-black rounded py-2 text-[24px]">Get Pro</button>
                        <ul className="mt-2 space-y-3 text-[20px]">
                            <li>All free feats included</li>
                            <li>Plan feat 1</li>
                            <li>Plan feat 2</li>
                            <li>Plan feat 3</li>
                        </ul>
                    </section>

                    {/* Ultra */}
                    <section className="border-2 border-white rounded p-8 h-full flex flex-col gap-6">
                        <h2 className="font-teachers font-bold text-[32px]">Ultra</h2>
                        <div className="flex items-end gap-2">
                            <span className="text-[#A6A6A6] text-[20px]">$</span>
                            <span className="text-[64px] leading-none">100</span>
                            <div className="text-[#A6A6A6] text-[16px] leading-tight">
                                <div>USD/</div>
                                <div>month</div>
                            </div>
                        </div>
                        <p className="font-teachers text-[24px]">Plan description</p>
                        <button className="w-full bg-white text-black rounded py-2 text-[24px]">Get Ultra</button>
                        <ul className="mt-2 space-y-3 text-[20px]">
                            <li>All pro feats included</li>
                            <li>Plan feat 1</li>
                            <li>Plan feat 2</li>
                            <li>Plan feat 3</li>
                        </ul>
                    </section>
                </div>
            </div>
        </main>
    )
}