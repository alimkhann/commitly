'use client'

import { useParams } from 'next/navigation'
import TabSwitch from '../../../components/TabSwitch'

export default function RepoGuidePage() {
  const params = useParams()
  const repoId = params.repoId as string

  return (
    <div className="flex flex-col items-center justify-start gap-2.5 h-full pt-8 px-0">
      {/* Tab Switch */}
      <TabSwitch repoId={repoId} />
      
      {/* Guide Content - Chat Interface */}
      <div className="flex flex-col items-start justify-between min-h-0 px-64 py-8 relative w-full flex-1">
        {/* Messages */}
        <div className="flex flex-col gap-2.5 items-start relative w-full">
          {/* Agent Message */}
          <div className="flex gap-2.5 items-start relative">
            <p className="font-teachers font-bold text-white text-responsive-4xl whitespace-nowrap">
              cho nado
            </p>
          </div>
          
          {/* User Message */}
          <div className="flex flex-col gap-2.5 items-end justify-center relative w-full">
            <div className="bg-white flex gap-2.5 items-center justify-end px-4 py-2 relative rounded">
              <p className="font-teachers font-bold text-black text-responsive-4xl whitespace-nowrap">
                pomogi etu repu zakodit'
              </p>
            </div>
          </div>
          
          {/* Agent Response */}
          <div className="flex gap-2.5 items-start relative">
            <p className="font-teachers font-bold text-white text-responsive-4xl whitespace-nowrap">
              ne
            </p>
          </div>
        </div>
        
        {/* Chat Input */}
        <div className="flex gap-2.5 items-start px-8 py-16 relative rounded border border-white w-full">
          <p className="font-teachers font-medium text-white text-responsive-4xl whitespace-nowrap">
            Ask for guidance
          </p>
        </div>
      </div>
    </div>
  )
}
