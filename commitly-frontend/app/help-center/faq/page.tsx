export default function FAQPage() {
    return (
        <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
            <section className="w-full max-w-[900px] flex flex-col gap-8">
                <header>
                    <h1 className="font-teachers font-bold text-[40px] sm:text-[56px] md:text-[64px] leading-tight">FAQ</h1>
                    <p className="text-white/70">Frequently asked questions about Commitly.</p>
                </header>

                <div className="space-y-6">
                    <div>
                        <h2 className="font-teachers text-[22px] sm:text-[24px]">What is Commitly?</h2>
                        <p className="text-white/90">Commitly is an AI code tutor that helps you build and understand repositories quickly.</p>
                    </div>
                    <div>
                        <h2 className="font-teachers text-[22px] sm:text-[24px]">How do I report a bug?</h2>
                        <p className="text-white/90">Open the account menu and choose Report bug. A modal will appear to submit details.</p>
                    </div>
                    <div>
                        <h2 className="font-teachers text-[22px] sm:text-[24px]">Where can I find policies?</h2>
                        <p className="text-white/90">Visit the Help center, then open Terms & policies for all legal documents.</p>
                    </div>
                </div>

                <div className="pt-2">
                    <a href="/help-center" className="underline hover:opacity-80">Back to Help center</a>
                </div>
            </section>
        </main>
    )
}