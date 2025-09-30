export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
            <article className="w-full max-w-[900px] flex flex-col gap-6">
                <header>
                    <h1 className="font-teachers font-bold text-[40px] sm:text-[56px] md:text-[64px] leading-tight">Privacy policy</h1>
                    <p className="text-white/70">Last updated: 2025-09-30</p>
                </header>
                <section className="prose prose-invert max-w-none">
                    <p>
                        This Privacy Policy describes how we collect, use, and share information about you when you
                        use Commitly. We are committed to safeguarding your privacy and handling your data responsibly.
                    </p>
                    <h2>Information we collect</h2>
                    <p>
                        We may collect information you provide directly, such as account details, and information
                        collected automatically, such as device and usage data.
                    </p>
                    <h2>How we use information</h2>
                    <p>
                        We use information to provide and improve the service, communicate with you, and ensure the
                        security and integrity of the platform.
                    </p>
                </section>
            </article>
        </main>
    )
}