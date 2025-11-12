'use client'

import { usePathname } from 'next/navigation'

import Dither from '@/components/Dither'

export default function HomeBackground() {
    const pathname = usePathname()

    if (pathname !== '/') return null

    return (
        <div className="pointer-events-none fixed inset-0 z-0">
            <Dither
                waveColor={[0.6, 0.6, 0.6]}
                disableAnimation={false}
                enableMouseInteraction
                mouseRadius={0.3}
                colorNum={4}
                waveAmplitude={0.3}
                waveFrequency={3.7}
                waveSpeed={0.04}
                trackPointerGlobally
            />
        </div>
    )
}

