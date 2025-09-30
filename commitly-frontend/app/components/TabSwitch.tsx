'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface TabSwitchProps {
  repoId: string
}

export default function TabSwitch({ repoId }: TabSwitchProps) {
  const pathname = usePathname()
  
  const isTimelineActive = pathname.includes('/timeline') || pathname === `/repo/${repoId}`
  const isGuideActive = pathname.includes('/guide')

  return (
    <div className="flex gap-0 items-start p-1 relative rounded border border-white">
      <Link
        href={`/repo/${repoId}/timeline`}
        className={`flex gap-2 items-center justify-center px-0 py-0 relative rounded w-28 transition-colors ${
          isTimelineActive
            ? 'bg-white text-black'
            : 'text-white hover:bg-white/15'
        }`}
      >
        <p className={`font-teachers font-extrabold text-responsive-2xl whitespace-nowrap ${
          isTimelineActive ? 'text-black' : 'text-white'
        }`}>
          timeline
        </p>
      </Link>
      
      <Link
        href={`/repo/${repoId}/guide`}
        className={`flex gap-2 items-center justify-center px-0 py-0 relative rounded w-28 transition-colors ${
          isGuideActive
            ? 'bg-white text-black'
            : 'text-white hover:bg-white/15'
        }`}
      >
        <p className={`font-teachers font-extrabold text-responsive-2xl whitespace-nowrap ${
          isGuideActive ? 'text-black' : 'text-white'
        }`}>
          guide
        </p>
      </Link>
    </div>
  )
}
