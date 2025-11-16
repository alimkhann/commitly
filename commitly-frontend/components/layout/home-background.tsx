"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const Dither = dynamic(() => import("@/components/Dither"), {
  ssr: false,
  loading: () => null,
});

export default function HomeBackground() {
  const pathname = usePathname();

  if (pathname !== "/") {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <Dither
        colorNum={5}
        disableAnimation={false}
        enableMouseInteraction
        mouseRadius={0.3}
        trackPointerGlobally
        waveAmplitude={0.2}
        waveColor={[0.6, 0.6, 0.6]}
        waveFrequency={3.7}
        waveSpeed={0.04}
      />
    </div>
  );
}
