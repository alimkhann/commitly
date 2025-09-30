'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import AccountSection from './AccountSection/AccountSection'
import { useSupabaseSession } from '@/lib/useSupabaseSession'

const API_BASE = process.env.NEXT_PUBLIC_COMMITLY_API_BASE || 'http://127.0.0.1:8000'

interface RepoLinkItem {
  id: string
  slug: string
  encodedSlug: string
  owner: string
  name: string
  timeline_id?: string | null
}

function Logo() {
  return (
    <div className="relative w-12 h-12">
      <Image src="/logos/logo_4x.png" alt="Commitly Logo" width={48} height={48} className="w-12 h-12" />
    </div>
  )
}

interface NewRepoDialogProps {
  open: boolean
  onClose: () => void
  sessionAccessToken?: string | null
  onImported: (slug: string) => void
}

function NewRepoDialog({ open, onClose, sessionAccessToken, onImported }: NewRepoDialogProps) {
  const [repoUrl, setRepoUrl] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const GUEST_REPO_KEY = 'commitly_guest_repo'

  const reset = () => {
    setRepoUrl('')
    setGithubToken('')
    setError(null)
    setStatus(null)
    setLoading(false)
  }

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open])

  const parseSlug = (value: string) => {
    try {
      const url = new URL(value)
      const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean)
      if (parts.length >= 2) {
        const owner = parts[parts.length - 2]
        const name = parts[parts.length - 1]
        return `${owner}/${name}`
      }
    } catch (err) {
      // ignore
    }
    return null
  }

  const handleSubmit = async () => {
    setError(null)
    const slug = parseSlug(repoUrl)
    if (!slug) {
      setError('Enter a valid GitHub repository URL.')
      return
    }
    setLoading(true)
    setStatus('Contacting GitHub and preparing AI timeline…')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionAccessToken) {
        headers['Authorization'] = `Bearer ${sessionAccessToken}`
      }
      const res = await fetch(`${API_BASE}/api/v1/repos/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: repoUrl,
          github_token: githubToken || undefined,
          persist: true,
        })
      })
      if (!res.ok) {
        throw new Error('Failed to import repository')
      }
      setStatus('Finalising layout and caching results…')
      const importData = await res.json()
      const nextSlug = slug || importData.repo_id
      if (typeof window !== 'undefined' && Array.isArray(importData.nodes)) {
        const storageKey = `timeline-preview:${nextSlug}`
        sessionStorage.setItem(storageKey, JSON.stringify(importData.nodes))
      }
      setStatus('Done!')
      onImported(nextSlug)
    } catch (err) {
      console.error(err)
      setError('Import failed. Please verify the URL or provide a GitHub token for private repositories.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded border border-white bg-black/90 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-teachers text-white text-2xl">Paste a GitHub repo link</h2>
          <button className="text-white/60 hover:text-white" onClick={onClose}>✕</button>
        </div>
        <p className="text-white/70 text-sm">We cache analysed repositories so the next person loads them instantly.</p>
        <input
          className="w-full bg-transparent border border-white/30 rounded px-3 py-2 text-white"
          placeholder="https://github.com/vercel/next.js"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        <input
          className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-white"
          placeholder="Optional GitHub token (for private repos or higher rate limits)"
          value={githubToken}
          onChange={(e) => setGithubToken(e.target.value)}
        />
        {status && <p className="text-white/60 text-sm">{status}</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button className="text-white/70" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="bg-white text-black px-4 py-2 rounded font-teachers font-bold disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading || !repoUrl}
          >
            {loading ? 'Generating…' : 'Generate timeline'}
          </button>
          <button
            className="border border-white px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading || !repoUrl}
            title="Generate timeline"
          >
            <Image src="/icons/hammer_white.svg" alt="Generate" width={24} height={24} className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { session } = useSupabaseSession()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [repos, setRepos] = useState<RepoLinkItem[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [newRepoOpen, setNewRepoOpen] = useState(false)

  const encodeSlug = useCallback((slug: string) => slug.replace('/', '~~'), [])
  const fetchRepos = useCallback(async () => {
    setLoadingRepos(true)
    try {
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const scope = session ? 'mine' : 'public'
      const res = await fetch(`${API_BASE}/api/v1/repos?scope=${scope}`, { headers })
      if (res.ok) {
        const data = await res.json()
        const formatted: RepoLinkItem[] = (data || []).map((repo: any) => ({
          id: repo.id,
          owner: repo.owner,
          name: repo.name,
          slug: repo.slug,
          encodedSlug: encodeSlug(repo.slug),
          timeline_id: repo.timeline_id,
        }))
        setRepos(formatted)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingRepos(false)
    }
  }, [session, encodeSlug])

  useEffect(() => {
    if (session) {
      fetchRepos()
    } else {
      setRepos([])
      setLoadingRepos(false)
    }
  }, [fetchRepos, session])

  const toggleCollapse = () => setIsCollapsed((prev) => !prev)

  const isRepoActive = useCallback((encodedSlug: string) => pathname.startsWith(`/repo/${encodedSlug}`), [pathname])

  const handleImported = (slug: string) => {
    const encoded = encodeSlug(slug)
    setNewRepoOpen(false)
    fetchRepos()
    router.push(`/repo/${encodeURIComponent(encoded)}/timeline`)
  }

  return (
    <div className={`bg-black h-full relative border-r border-white transition-[width] duration-300 ease-in-out ${isCollapsed ? 'w-responsive-sidebar-collapsed' : 'w-responsive-sidebar'}`}>
      <div className="flex flex-col h-full items-start justify-between p-2.5">
        <div className="flex flex-col gap-12 items-start w-full">
          <div className={`flex items-center w-full ${isCollapsed ? 'justify-start pl-0 pr-0' : 'justify-between pl-0 pr-3'}`}>
            {isCollapsed ? (
              <button onClick={toggleCollapse} className="flex items-center justify-start w-full">
                <Logo />
              </button>
            ) : (
              <>
                <Link href="/">
                  <Logo />
                </Link>
                <button className="relative w-8 h-8 hover:bg-white/15 rounded transition-colors" onClick={toggleCollapse} title="Collapse sidebar">
                  <Image src="/icons/collapse.svg" alt="Collapse" width={32} height={32} className="w-8 h-8" />
                </button>
              </>
            )}
          </div>

          <div className={`flex flex-col gap-2 w-full ${isCollapsed ? 'items-center' : 'items-start'}`}>
            <button
              className={`${isCollapsed ? 'w-full h-12 flex items-center justify-start' : 'flex gap-2.5 items-center w-full h-12'} hover:bg-white/15 rounded transition-colors p-1`}
              title="New repo"
              onClick={() => setNewRepoOpen(true)}
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <Image src="/icons/hammer_white.svg" alt="New repo" width={32} height={32} className="w-8 h-8 shrink-0" />
              </div>
              {!isCollapsed && (
                <p className="font-teachers font-normal text-white text-responsive-4xl whitespace-nowrap">New repo</p>
              )}
            </button>
            <Link
              href="/search"
              className={`${isCollapsed ? 'w-full h-12 flex items-center justify-start' : 'flex gap-2.5 items-center w-full h-12'} hover:bg-white/15 rounded transition-colors p-1`}
              title="Search repo"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <Image src="/icons/magnifyingglass_white.svg" alt="Search repo" width={32} height={32} className="w-8 h-8 shrink-0" />
              </div>
              {!isCollapsed && (
                <p className="font-teachers font-normal text-white text-responsive-4xl whitespace-nowrap">Search repo</p>
              )}
            </Link>
          </div>

          <div className={`w-full flex-1 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto pr-1'}`}>
            {session && repos.length > 0 && (
              <>
                {!isCollapsed && (
                  <p className="font-teachers font-normal text-white text-responsive-3xl mb-2">
                    Your repos
                  </p>
                )}
                <div className="flex flex-col gap-2 w-full">
                  {repos.map((repo) => (
                    <Link
                      key={repo.id}
                      href={`/repo/${encodeURIComponent(repo.encodedSlug)}/timeline`}
                      className={`flex items-center px-2 py-1 rounded w-full transition-colors ${
                        isRepoActive(repo.encodedSlug)
                          ? 'bg-white text-black'
                          : 'border border-white text-white hover:bg-white/15'
                      }`}
                    >
                      <p className={`font-teachers font-normal text-responsive-3xl whitespace-nowrap overflow-hidden text-ellipsis ${
                        isRepoActive(repo.encodedSlug) ? 'text-black' : 'text-white'
                      }`}>
                        {repo.slug}
                      </p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <AccountSection isCollapsed={isCollapsed} />
      </div>

      <NewRepoDialog
        open={newRepoOpen}
        onClose={() => setNewRepoOpen(false)}
        sessionAccessToken={session?.access_token}
        onImported={handleImported}
      />
    </div>
  )
}
