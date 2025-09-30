export default function HelpCenterPage() {
    return (
        <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
            <section className="w-full max-w-[900px] flex flex-col items-center gap-12">
                <h1 className="font-teachers font-bold text-[40px] sm:text-[56px] md:text-[64px] leading-tight text-center">
                    Help center
                </h1>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                    <a href="/policies" className="border border-white rounded p-5 hover:bg-white/10 transition-colors">
                        <h2 className="font-teachers text-[22px] sm:text-[24px] mb-2">Terms & policies</h2>
                        <p className="text-white/80 text-[16px] sm:text-[18px]">Legal, privacy, data use, and security.</p>
                    </a>

                    <a href="/release-notes" className="border border-white rounded p-5 hover:bg-white/10 transition-colors">
                        <h2 className="font-teachers text-[22px] sm:text-[24px] mb-2">Release notes</h2>
                        <p className="text-white/80 text-[16px] sm:text-[18px]">What changed in each version.</p>
                    </a>

                    <a href="/help-center/getting-started" className="border border-white rounded p-5 hover:bg-white/10 transition-colors">
                        <h2 className="font-teachers text-[22px] sm:text-[24px] mb-2">Getting started</h2>
                        <p className="text-white/80 text-[16px] sm:text-[18px]">Basics to help you set up.</p>
                    </a>

                    <a href="/help-center/faq" className="border border-white rounded p-5 hover:bg-white/10 transition-colors">
                        <h2 className="font-teachers text-[22px] sm:text-[24px] mb-2">FAQ</h2>
                        <p className="text-white/80 text-[16px] sm:text-[18px]">Answers to common questions.</p>
                    </a>
                </div>
            </section>
        </main>
    )
}