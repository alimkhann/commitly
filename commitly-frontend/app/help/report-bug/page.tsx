'use client'

import { useState } from 'react'

export default function ReportBugPage() {
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submit = async () => {
    if (!description) return
    // TODO: wire to backend support endpoint
    setSubmitted(true)
    setDescription('')
  }

  return (
    <div className="flex flex-col gap-6 p-12 text-white max-w-2xl">
      <h1 className="font-teachers text-5xl">Report a bug</h1>
      <p className="text-white/70">
        Found something broken? Let us know so we can polish the timeline experience.
      </p>
      <textarea
        className="min-h-[160px] bg-transparent border border-white/30 rounded px-4 py-3 text-white"
        placeholder="Describe what happened, steps to reproduce, and the repo you were inspecting."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button
        className="self-start bg-white text-black px-4 py-2 rounded font-teachers disabled:opacity-50"
        disabled={!description}
        onClick={submit}
      >
        Submit report
      </button>
      {submitted && <p className="text-green-400">Thanks! We&apos;ll look into it.</p>}
    </div>
  )
}
