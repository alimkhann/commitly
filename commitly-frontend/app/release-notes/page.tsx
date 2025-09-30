export default function ReleaseNotesPage() {
    return (
        <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
            <section className="w-full max-w-[900px] flex flex-col items-center gap-10">
                <h1 className="font-teachers font-bold text-[40px] sm:text-[56px] md:text-[64px] leading-tight text-center">
                    Release notes
                </h1>

                <div className="w-full flex flex-col gap-6">
                    {/* Example entry */}
                    <article className="border border-white rounded p-5 sm:p-6">
                        <header className="flex items-center justify-between">
                            <h2 className="font-teachers text-[22px] sm:text-[24px]">v0.1.0</h2>
                            <time className="text-white/70 text-[14px]">2025-09-30</time>
                        </header>
                        <ul className="list-disc pl-5 mt-3 space-y-2 text-white/90 text-[16px] sm:text-[18px]">
                            <li>Initial dark-themed release notes page.</li>
                            <li>Added policies and help center stub pages.</li>
                            <li>Report bug modal component scaffold.</li>
                        </ul>
                    </article>
                </div>
            </section>
        </main>
    )
}