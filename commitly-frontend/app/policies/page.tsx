export default function PoliciesPage() {
    return (
        <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6">
            <section className="w-full max-w-[800px] flex flex-col items-center gap-12">
                <h1 className="font-teachers font-bold text-[40px] sm:text-[56px] md:text-[64px] leading-tight text-center">
                    Terms & policies
                </h1>

                <div className="w-full border border-white rounded p-6 sm:p-8">
                    <div className="flex flex-col gap-6">
                        <h2 className="font-teachers text-[28px] sm:text-[32px]">Legal</h2>

                        <ul className="list-disc pl-6 flex flex-col gap-3 text-white/90 text-[18px] sm:text-[20px]">
                            <li>
                                <a href="/policies/terms-of-use" className="underline hover:opacity-80">Terms of use</a>: Terms that govern use of commitly and its other services for individuals.
                            </li>
                            <li>
                                <a href="/policies/privacy-policy" className="underline hover:opacity-80">Privacy policy</a>: Practices with respect to personal information we collect from or about you.
                            </li>
                            <li>
                                <a href="/policies/data-use" className="underline hover:opacity-80">Data use</a>: How we handle, use, and share your submitted information.
                            </li>
                            <li>
                                <a href="/policies/security" className="underline hover:opacity-80">Security</a>: How we protect your data through technical and organizational safeguards.
                            </li>
                        </ul>
                    </div>
                </div>
            </section>
        </main>
    )
}