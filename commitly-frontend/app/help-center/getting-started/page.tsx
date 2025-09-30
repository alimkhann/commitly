export default function GettingStartedPage() {
    return (
        <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
            <section className="w-full max-w-[900px] flex flex-col gap-8">
                <header>
                    <h1 className="font-teachers font-bold text-[40px] sm:text-[56px] md:text-[64px] leading-tight">Getting started</h1>
                    <p className="text-white/70">A quick guide to set up and use Commitly.</p>
                </header>

                <ol className="list-decimal pl-6 space-y-3 text-white/90 text-[18px] sm:text-[20px]">
                    <li>Paste a GitHub repository URL on the home page.</li>
                    <li>Use the left sidebar to navigate repo views and the help center.</li>
                    <li>Open the account menu to find settings, release notes, and policies.</li>
                    <li>Report issues via the Report bug option to help us improve.</li>
                </ol>

                <div className="pt-2">
                    <a href="/help-center" className="underline hover:opacity-80">Back to Help center</a>
                </div>
            </section>
        </main>
    )
}