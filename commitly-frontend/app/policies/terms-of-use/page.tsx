export default function TermsOfUsePage() {
    return (
        <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
            <article className="w-full max-w-[900px] flex flex-col gap-6">
                <header>
                    <h1 className="font-teachers font-bold text-[40px] sm:text-[56px] md:text-[64px] leading-tight">Terms of use</h1>
                    <p className="text-white/70">Last updated: 2025-09-30</p>
                </header>
                <section className="prose prose-invert max-w-none">
                    <p>
                        These Terms of Use ("Terms") govern your access to and use of Commitly, including any
                        content, functionality, and services offered on or through Commitly. By accessing or using
                        Commitly, you agree to be bound by these Terms.
                    </p>
                    <h2>Use of the Service</h2>
                    <p>
                        You agree to use the service only for lawful purposes and in accordance with these Terms.
                        You are responsible for your conduct and any content you provide.
                    </p>
                    <h2>Intellectual Property</h2>
                    <p>
                        The service and its original content, features, and functionality are owned by Commitly and
                        are protected by international copyright, trademark, and other intellectual property laws.
                    </p>
                </section>
            </article>
        </main>
    )
}