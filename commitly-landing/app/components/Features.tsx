'use client'

import Image from 'next/image'
import { useLanguage } from '../contexts/LanguageContext'
import Iridescence from './Iridiscence'

export default function Features() {
    const { t } = useLanguage()

    return (
        <section className="max-w-[1344px] mx-auto px-6 sm:px-8 lg:px-20 xl:px-28 2xl:px-40 pt-8 md:pt-12 pb-6 space-y-28">
            <div>
                <div className="text-center mb-6">
                    <h3 className="section-h">{t.feature1Title}</h3>
                    <p className="section-sub w-[80%] mx-auto">{t.feature1Subtitle}</p>
                </div>
                <div className="relative isolate noise feature-card overflow-hidden rounded-xl">
                    <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
                        <Iridescence
                            color={[1, 0.7, 0.8]}
                            mouseReact={false}
                            amplitude={0.2}
                            speed={0.25}
                            rotation={37}
                        />
                    </div>
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
                <div className="relative isolate noise feature-card overflow-hidden rounded-xl">
                    <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
                        <Iridescence
                            color={[0.8, 1, 0.7]}
                            mouseReact={false}
                            amplitude={0.1}
                            speed={0.3}
                            rotation={71}
                        />
                    </div>
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
                <div className="relative isolate noise feature-card overflow-hidden rounded-xl">
                    <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
                        <Iridescence
                            color={[0.7, 0.8, 1]}
                            mouseReact={false}
                            amplitude={0.1}
                            speed={0.2}
                            rotation={132}
                        />
                    </div>
                    <div className="gradient-vignette" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Image src="/icon-bulb.svg" alt="Lightbulb" width={230} height={340} />
                    </div>
                </div>
            </div>
        </section>
    )
}
