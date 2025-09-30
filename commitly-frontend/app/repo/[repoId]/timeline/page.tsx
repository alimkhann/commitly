'use client'

import { useParams } from 'next/navigation'
import TabSwitch from '../../../components/TabSwitch'
import { useCallback, useEffect, useMemo, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_COMMITLY_API_BASE || 'http://127.0.0.1:8000'

type TimelineNode = {
  id: string
  commit_sha: string
  title?: string | null
  summary?: string | null
  author?: string | null
  committed_at?: string | null
  position_index: number
  x: number
  y: number
  files_changed?: number
  additions?: number
  deletions?: number
}

export default function RepoTimelinePage() {
  const params = useParams()
  const encodedRepoId = params.repoId as string
  const decodeSlug = useCallback((value: string) => value.replace('~~', '/'), [])
  const repoId = useMemo(() => decodeSlug(encodedRepoId), [encodedRepoId, decodeSlug])

  const [nodes, setNodes] = useState<TimelineNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [diffs, setDiffs] = useState<Record<string, { patch_summary?: string | null, patch_full?: string | null }>>({})
  const [guidanceDraft, setGuidanceDraft] = useState('')

  const containerStyle = useMemo(() => ({ width: '100%', height: '100%', position: 'relative' as const }), [])

  const fetchTimeline = useCallback(async (targetRepoId: string) => {
    try {
      const timelineRes = await fetch(`${API_BASE}/api/v1/repos/${encodeURIComponent(targetRepoId)}/timeline`)
      if (!timelineRes.ok) throw new Error('Failed to load timeline')
      const data = await timelineRes.json()
      setNodes(data.nodes || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    if (!repoId) {
      return
    }
    const previewKey = `timeline-preview:${repoId}`
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(previewKey)
      if (cached) {
        try {
          const parsed: TimelineNode[] = JSON.parse(cached)
          setNodes(parsed)
          sessionStorage.removeItem(previewKey)
          return
        } catch (err) {
          console.error('Failed to parse cached timeline preview', err)
          sessionStorage.removeItem(previewKey)
        }
      }
    }
    fetchTimeline(repoId)
  }, [repoId, fetchTimeline])

  const toggleExpand = useCallback(async (sha: string) => {
    setExpanded(prev => ({ ...prev, [sha]: !prev[sha] }))
    if (!diffs[sha]) {
      try {
        const res = await fetch(`${API_BASE}/api/v1/repos/commits/${encodeURIComponent(sha)}/diff`)
        if (res.ok) {
          const data = await res.json()
          setDiffs(prev => ({ ...prev, [sha]: { patch_summary: data.patch_summary, patch_full: data.patch_full } }))
        }
      } catch (e) {
        console.error(e)
      }
    }
  }, [diffs])

  return (
    <div className="flex flex-col items-center justify-start gap-2.5 h-full pt-8 px-0">
      {/* Tab Switch */}
      <TabSwitch repoId={encodedRepoId} />
      {/* Status */}
      <div className="flex flex-col gap-3 items-start justify-start px-8 py-4 relative w-full max-w-4xl">
        <p className="text-white/70 text-sm">
          Use “New repo” in the sidebar whenever you want to generate a fresh AI timeline. Popular repositories are cached so the next import is instant.
        </p>
      </div>
      {/* Timeline Content */}
      <div className="flex flex-col items-center justify-start min-h-0 px-16 py-8 relative w-full flex-1 gap-8">
        <div className="relative w-full overflow-auto" style={{ height: '100%' }}>
          <div className="relative" style={containerStyle}>
            {nodes.map((n) => (
              <div
                key={n.id}
                className="absolute"
                style={{ left: n.x, top: n.y }}
              >
                <div
                  className="border border-white/40 rounded px-3 py-2 cursor-pointer hover:bg-white/10"
                  onClick={() => toggleExpand(n.commit_sha)}
                >
                  <div className="font-teachers font-bold text-white">
                    {n.title || n.commit_sha.substring(0, 7)}
                  </div>
                  <div className="text-white/70 text-sm">
                    {n.author} • {n.files_changed} files • +{n.additions} -{n.deletions}
                  </div>
                </div>
                {expanded[n.commit_sha] && (
                  <div className="mt-2 border border-white/20 rounded p-3 max-w-xl whitespace-pre-wrap text-white/90">
                    {diffs[n.commit_sha]?.patch_summary || 'Loading diff…'}
                  </div>
                )}
              </div>
            ))}
            {nodes.length === 0 && (
              <div className="text-white/50 text-center mt-24">
                <p className="font-teachers text-xl">No timeline yet for this repo.</p>
                <p className="text-sm">Import a repository to see milestones here.</p>
              </div>
            )}
          </div>
        </div>
        <div className="w-full max-w-4xl mx-auto">
          <div className="flex gap-3 items-start px-8 py-6 rounded border border-white">
            <input
              className="flex-1 bg-transparent text-white outline-none text-2xl"
              placeholder="Ask for guidance"
              value={guidanceDraft}
              onChange={(e) => setGuidanceDraft(e.target.value)}
            />
            <button
              className="bg-white text-black px-5 py-3 rounded font-teachers font-bold disabled:opacity-50 text-lg"
              disabled={!guidanceDraft}
              onClick={() => setGuidanceDraft('')}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
