'use client'

import { useParams } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'
import TabSwitch from '../../../components/TabSwitch'

export default function RepoTimelinePage() {
  const params = useParams()
  const repoId = params.repoId as string

  return (
    <div className="bg-black relative size-full min-h-screen">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-start gap-2.5 h-full pt-8 px-0">
          {/* Tab Switch */}
          <TabSwitch repoId={repoId} />
          
          {/* Timeline Content */}
          <div className="flex flex-col items-center justify-between min-h-0 px-64 py-8 relative w-full flex-1">
            <p className="font-teachers font-bold text-white text-[32px] whitespace-nowrap">
              это пока хз как делать
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
