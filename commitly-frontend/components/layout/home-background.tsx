"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const Dither = dynamic(() => import("@/components/dither"), {
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
        disableAnimation
        enableMouseInteraction={false}
        mouseRadius={0.3}
        trackPointerGlobally={false}
        waveAmplitude={0.2}
        waveColor={[0.6, 0.6, 0.6]}
        waveFrequency={3.7}
        waveSpeed={0}
      />
    </div>
  );
}
