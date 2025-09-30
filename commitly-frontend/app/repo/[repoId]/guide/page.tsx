'use client'

import { useParams } from 'next/navigation'
import TabSwitch from '../../../components/TabSwitch'
import { useState } from 'react'

const SAMPLE_DIALOG = [
  { role: 'assistant' as const, content: 'Hey! Drop me a milestone and I will propose the next steps.' },
  { role: 'user' as const, content: 'How do I make the authentication flow production-ready?' },
  { role: 'assistant' as const, content: 'Start by enabling Google + password, add email verification, then wire the delete-account endpoint we provide in settings.' },
]

export default function RepoGuidePage() {
  const params = useParams()
  const encodedRepoId = params.repoId as string
  const [draft, setDraft] = useState('')

  return (
    <div className="flex flex-col items-center justify-start gap-2.5 h-full pt-8 px-0">
      <TabSwitch repoId={encodedRepoId} />

      <div className="flex flex-col items-start justify-between min-h-0 px-16 py-8 relative w-full flex-1 gap-8">
        <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto">
          {SAMPLE_DIALOG.map((message, idx) => (
            <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`${message.role === 'user' ? 'bg-white text-black' : 'border border-white/40 text-white'} px-5 py-3 rounded max-w-3xl whitespace-pre-wrap font-teachers text-lg` }>
                {message.content}
              </div>
            </div>
          ))}
        </div>

        <div className="w-full max-w-4xl mx-auto">
          <div className="flex gap-3 items-start px-8 py-6 rounded border border-white">
            <input
              className="flex-1 bg-transparent text-white outline-none text-2xl"
              placeholder="Ask for guidance"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              className="bg-white text-black px-5 py-3 rounded font-teachers font-bold disabled:opacity-50 text-lg"
              disabled={!draft}
              onClick={() => setDraft('')}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
