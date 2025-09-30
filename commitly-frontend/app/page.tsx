'use client'

import { useCallback, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_COMMITLY_API_BASE || 'http://127.0.0.1:8000'

export default function Home() {
  const router = useRouter()
  const [repoLink, setRepoLink] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const parseSlug = useCallback((value: string) => {
    try {
      const url = new URL(value)
      const segments = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean)
      if (segments.length >= 2) {
        const owner = segments[segments.length - 2]
        const name = segments[segments.length - 1]
        return `${owner}/${name}`
      }
    } catch (err) {
      // ignore parsing errors
    }
    return null
  }, [])

  const encodeSlug = useCallback((slug: string) => slug.replace('/', '~~'), [])

  const handleSubmit = useCallback(async () => {
    setError(null)
    setStatus(null)
    const slug = parseSlug(repoLink)
    if (!slug) {
      setError('Please paste a valid GitHub repository URL.')
      return
    }

    setLoading(true)
    setStatus('Contacting GitHub and preparing an AI timeline…')
    try {
      const res = await fetch(`${API_BASE}/api/v1/repos/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: repoLink, persist: true, github_token: githubToken || undefined }),
      })
      if (!res.ok) {
        throw new Error('Import failed')
      }
      const data = await res.json()
      const resolvedSlug = slug || data.repo_id
      if (typeof window !== 'undefined' && Array.isArray(data.nodes)) {
        const storageKey = `timeline-preview:${resolvedSlug}`
        sessionStorage.setItem(storageKey, JSON.stringify(data.nodes))
      }
      setStatus('Done! Redirecting…')
      router.push(`/repo/${encodeURIComponent(encodeSlug(resolvedSlug))}/timeline`)
    } catch (err) {
      console.error(err)
      setError('Unable to generate timeline. Please check the link and try again.')
    } finally {
      setLoading(false)
    }
  }, [repoLink, parseSlug, encodeSlug, router])

  const isDisabled = useMemo(() => !repoLink || loading, [repoLink, loading])

  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full">
      <div className="flex gap-2 items-center justify-center">
        <div className="relative w-24 h-24">
          <Image src="/logos/logo_4x.png" alt="Commitly Logo" width={96} height={96} className="w-24 h-24" />
        </div>
        <p className="font-teachers font-bold text-white text-responsive-6xl whitespace-nowrap">
          commitly
        </p>
      </div>

      <div className="bg-white flex items-center justify-between px-3 py-1.5 rounded w-[30rem] max-w-[90vw] border border-white">
        <input
          type="text"
          placeholder="paste a github repo link"
          value={repoLink}
          onChange={(e) => setRepoLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
          className="font-teachers font-normal text-black text-responsive-4xl flex-1 bg-transparent border-none outline-none placeholder:text-black"
        />
        <button
          className="w-8 h-7 flex items-center justify-center disabled:opacity-40"
          onClick={handleSubmit}
          disabled={isDisabled}
          aria-label="Generate timeline"
        >
          <Image src="/icons/hammer_black.svg" alt="Generate" width={32} height={30} className="w-8 h-7" />
        </button>
      </div>

      <input
        type="text"
        placeholder="optional: github personal access token"
        value={githubToken}
        onChange={(e) => setGithubToken(e.target.value)}
        className="bg-transparent border border-white/30 rounded px-3 py-2 text-white w-[30rem] max-w-[90vw] font-teachers"
      />

      {status && <p className="text-white/70 text-sm">{status}</p>}
      {error && <p className="text-red-400 text-sm max-w-md text-center">{error}</p>}
    </div>
  )
}
