import Image from 'next/image'

interface SuccessPageProps {
    searchParams: {
        checkout_id?: string
        customer_session_token?: string
    }
}

export default function SuccessPage({ searchParams }: SuccessPageProps) {
    const checkoutId = searchParams.checkout_id

    return (
        <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-16 sm:px-6">
            <div className="w-full max-w-2xl">
                <div className="rounded-3xl border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.55)] overflow-hidden">
                    <div className="bg-hero relative flex flex-col items-center text-center gap-5 px-8 py-12 sm:px-14 sm:py-16">
                        <div className="flex items-center gap-3 rounded-full bg-black/40 px-4 py-2 backdrop-blur-sm">
                            <Image src="/icons/icon_1x.png" alt="Commitly" width={32} height={32} className="w-7 h-7" />
                            <span className="uppercase tracking-[0.32em] text-xs text-white/70">Commitly</span>
                        </div>

                        <div className="space-y-3">
                            <h1 className="text-[2.2rem] leading-tight font-semibold sm:text-[2.6rem]">Thank you! ☕️</h1>
                            <p className="text-base text-white/80 sm:text-lg">
                                Your support fuels the roadmap. We just received your coffee — you rock.
                            </p>
                        </div>

                        {checkoutId && (
                            <div className="w-full rounded-xl border border-white/15 bg-black/30 p-4 text-sm text-white/70 backdrop-blur-sm sm:text-base">
                                <p className="font-medium text-white/80">Checkout reference</p>
                                <p className="mt-1 font-mono text-xs sm:text-sm text-white/70 break-all">{checkoutId}</p>
                            </div>
                        )}

                        <a
                            href="/"
                            className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/90"
                        >
                            ← Back to home
                        </a>
                    </div>
                </div>
            </div>
        </main>
    )
}
