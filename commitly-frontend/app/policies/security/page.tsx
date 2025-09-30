export default function SecurityPage() {
    return (
        <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
            <article className="w-full max-w-[900px] flex flex-col gap-6">
                <header>
                    <h1 className="font-teachers font-bold text-[40px] sm:text-[56px] md:text-[64px] leading-tight">Security</h1>
                    <p className="text-white/70">Last updated: 2025-09-30</p>
                </header>
                <section className="prose prose-invert max-w-none">
                    <p>
                        We take security seriously and implement technical and organizational safeguards to protect your data.
                    </p>
                    <h2>Safeguards</h2>
                    <p>
                        We use encryption in transit, access controls, and monitoring to secure systems and data.
                    </p>
                    <h2>Responsible disclosure</h2>
                    <p>
                        If you believe you've found a security issue, please report it to us so we can address it promptly.
                    </p>
                </section>
            </article>
        </main>
    )
}