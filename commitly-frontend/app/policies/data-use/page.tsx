export default function DataUsePage() {
    return (
        <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
            <article className="w-full max-w-[900px] flex flex-col gap-6">
                <header>
                    <h1 className="font-teachers font-bold text-[40px] sm:text-[56px] md:text-[64px] leading-tight">Data use</h1>
                    <p className="text-white/70">Last updated: 2025-09-30</p>
                </header>
                <section className="prose prose-invert max-w-none">
                    <p>
                        This section explains how we handle, use, and share the information you submit to Commitly.
                        We strive to protect your data and use it only for legitimate purposes in delivering the service.
                    </p>
                    <h2>Processing</h2>
                    <p>
                        We process your data to operate, maintain, and improve the service. We may analyze usage to
                        enhance reliability and performance.
                    </p>
                    <h2>Sharing</h2>
                    <p>
                        We do not sell your personal information. We may share data with service providers under
                        confidentiality agreements necessary to operate the platform.
                    </p>
                </section>
            </article>
        </main>
    )
}