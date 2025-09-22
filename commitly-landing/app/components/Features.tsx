'use client'

import Image from 'next/image'
import { useLanguage } from '../contexts/LanguageContext'

export default function Features() {
    const { t } = useLanguage()

    return (
        <section className="max-w-[1344px] mx-auto px-6 sm:px-8 lg:px-20 xl:px-28 2xl:px-40 pt-8 md:pt-12 pb-6 space-y-28">
            <div>
                <div className="text-center mb-6">
                    <h3 className="section-h">{t.feature1Title}</h3>
                    <p className="section-sub w-[80%] mx-auto">{t.feature1Subtitle}</p>
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
                    <h3 className="section-h">{t.feature2Title}</h3>
                    <p className="section-sub w-[80%] mx-auto">{t.feature2Subtitle}</p>
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
                    <h3 className="section-h">{t.feature3Title}</h3>
                    <p className="section-sub w-[80%] mx-auto">{t.feature3Subtitle}</p>
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
