'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

const API_BASE = (
    process.env.NEXT_PUBLIC_EDGE_API_BASE_URL ??
    ''
).trim()
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
let hasWarnedMissingEdgeApiBase = false

const WAITLIST_CACHE_KEY = 'commitly_waitlist_count'

type WaitlistStatus = 'idle' | 'success' | 'error' | 'duplicate'

function readCachedWaitlistCount() {
    if (typeof window === 'undefined') return null
    const rawValue = window.localStorage.getItem(WAITLIST_CACHE_KEY)
    if (!rawValue) return null
    const parsedValue = Number(rawValue)
    if (!Number.isFinite(parsedValue) || parsedValue < 0) return null
    return Math.floor(parsedValue)
}

function writeCachedWaitlistCount(value: number) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(WAITLIST_CACHE_KEY, String(Math.max(0, Math.floor(value))))
}

async function fetchWaitlistCountFromSupabase() {
    if (!(SUPABASE_URL && SUPABASE_ANON_KEY)) return null
    const response = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?select=id`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Range-Unit': 'items',
            Range: '0-0',
            Prefer: 'count=exact',
        },
        cache: 'no-store',
    })

    if (!response.ok) return null
    const rangeHeader = response.headers.get('content-range')
    if (!rangeHeader) return null

    const [, totalCount] = rangeHeader.split('/')
    const parsedCount = Number(totalCount)
    return Number.isFinite(parsedCount) && parsedCount >= 0
        ? Math.floor(parsedCount)
        : null
}

export function useWaitlist() {
    const { t } = useLanguage()
    const [heroEmail, setHeroEmail] = useState('')
    const [waitlistEmail, setWaitlistEmail] = useState('')

    const [waitlistCount, setWaitlistCount] = useState<number>(0)
    const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false)
    const [waitlistStatus, setWaitlistStatus] = useState<WaitlistStatus>('idle')

    const [showWaitlistModal, setShowWaitlistModal] = useState(false)

    useEffect(() => {
        const cachedCount = readCachedWaitlistCount()
        if (cachedCount !== null) {
            setWaitlistCount(cachedCount)
        }
    }, [])

    const fetchWaitlistCount = useCallback(async () => {
        if (!API_BASE) {
            if (!hasWarnedMissingEdgeApiBase) {
                console.warn('Missing NEXT_PUBLIC_EDGE_API_BASE_URL environment variable')
                hasWarnedMissingEdgeApiBase = true
            }
            const fallbackCount = await fetchWaitlistCountFromSupabase()
            if (fallbackCount !== null) {
                setWaitlistCount(fallbackCount)
                writeCachedWaitlistCount(fallbackCount)
                return
            }
            const cachedCount = readCachedWaitlistCount()
            if (cachedCount !== null) {
                setWaitlistCount(cachedCount)
            }
            return
        }
        try {
            const res = await fetch(`${API_BASE}/api/v1/waitlist/count`, { cache: 'no-store' })
            if (!res.ok) throw new Error(`Waitlist count request failed with ${res.status}`)
            const data = (await res.json()) as { count?: number }
            if (typeof data.count === 'number') {
                setWaitlistCount(data.count)
                writeCachedWaitlistCount(data.count)
            }
        } catch (error) {
            console.error('Failed to fetch waitlist count', error)
            const fallbackCount = await fetchWaitlistCountFromSupabase()
            if (fallbackCount !== null) {
                setWaitlistCount(fallbackCount)
                writeCachedWaitlistCount(fallbackCount)
                return
            }

            const cachedCount = readCachedWaitlistCount()
            if (cachedCount !== null) {
                setWaitlistCount(cachedCount)
            }
        }
    }, [])

    useEffect(() => {
        fetchWaitlistCount()
        const t = setInterval(fetchWaitlistCount, 30_000)
        return () => clearInterval(t)
    }, [fetchWaitlistCount])

    useEffect(() => {
        const open = showWaitlistModal
        document.body.classList.toggle('body-locked', open)
    }, [showWaitlistModal])

    const waitlistButtonLabel = useMemo(() => {
        if (isSubmittingWaitlist) return t.joiningButton
        if (waitlistStatus === 'success') return t.successMessage
        if (waitlistStatus === 'duplicate') return t.alreadyJoinedButton
        if (waitlistStatus === 'error') return t.tryAgainButton
        return t.joinWaitlistButton
    }, [isSubmittingWaitlist, waitlistStatus, t])

    const submitWaitlist = useCallback(
        async (email: string) => {
            if (!email) return
            if (!API_BASE) {
                setWaitlistStatus('error')
                return
            }
            setIsSubmittingWaitlist(true)
            try {
                const res = await fetch(`${API_BASE}/api/v1/waitlist/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, source: 'landing' }),
                })
                if (res.status === 409) {
                    setWaitlistStatus('duplicate')
                    fetchWaitlistCount()
                    return
                }
                if (!res.ok) throw new Error('failed')
                setWaitlistStatus('success')
                setWaitlistCount(c => {
                    const nextValue = c + 1
                    writeCachedWaitlistCount(nextValue)
                    return nextValue
                })
                fetchWaitlistCount()
            } catch (error) {
                console.error('Failed to submit waitlist entry', error)
                setWaitlistStatus('error')
            } finally {
                setIsSubmittingWaitlist(false)
                setTimeout(() => setWaitlistStatus('idle'), 2400)
            }
        },
        [fetchWaitlistCount]
    )

    const handleHeroSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault()
            const email = heroEmail
            setHeroEmail('')
            await submitWaitlist(email)
        },
        [heroEmail, submitWaitlist]
    )

    const handleWaitlistModalSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault()
            const email = waitlistEmail
            setWaitlistEmail('')
            await submitWaitlist(email)
            setTimeout(() => setShowWaitlistModal(false), 600)
        },
        [submitWaitlist, waitlistEmail]
    )

    return {
        // emails
        heroEmail,
        setHeroEmail,
        waitlistEmail,
        setWaitlistEmail,

        // counts & states
        waitlistCount,
        isSubmittingWaitlist,
        waitlistStatus,

        // ui states
        showWaitlistModal,
        setShowWaitlistModal,

        // labels
        waitlistButtonLabel,

        // handlers
        handleHeroSubmit,
        handleWaitlistModalSubmit,
    }
}
