'use client'

import Image from 'next/image'

export default function Features() {
    return (
        <section className="max-w-[1344px] mx-auto px-6 sm:px-8 lg:px-20 xl:px-28 2xl:px-40 pt-8 md:pt-12 pb-6 space-y-28">
            <div>
                <div className="text-center mb-6">
                    <h3 className="section-h">Commit History Roadmap</h3>
                    <p className="section-sub">Turn any repo's commit history into clear chapters with the key diffs.</p>
                </div>
                <div className="relative bg-card-1 noise feature-card overflow-hidden">
                    <div className="gradient-vignette" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Image src="/icon-commit.svg" alt="Commit tree" width={230} height={191} />
                    </div>
                </div>
            </div>

            <div>
                <div className="text-center mb-6">
                    <h3 className="section-h">Hands-on tasks &amp; tests</h3>
                    <p className="section-sub">Small, scoped tasks with failing tests — learn by making red turn green.</p>
                </div>
                <div className="relative bg-card-2 noise feature-card overflow-hidden">
                    <div className="gradient-vignette" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Image src="/icon-check.svg" alt="Checklist" width={230} height={206} />
                    </div>
                </div>
            </div>

            <div>
                <div className="text-center mb-6">
                    <h3 className="section-h">Socratic hints</h3>
                    <p className="section-sub">Hints first. If you're stuck, reveal a tiny patch — not a wall of code.</p>
                </div>
                <div className="relative bg-card-3 noise feature-card overflow-hidden">
                    <div className="gradient-vignette" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Image src="/icon-bulb.svg" alt="Lightbulb" width={230} height={340} />
                    </div>
                </div>
            </div>
        </section>
    )
}
