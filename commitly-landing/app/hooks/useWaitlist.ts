'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

type WaitlistStatus = 'idle' | 'success' | 'error' | 'duplicate'

export function useWaitlist() {
    const { t } = useLanguage()
    const [heroEmail, setHeroEmail] = useState('')
    const [waitlistEmail, setWaitlistEmail] = useState('')

    const [waitlistCount, setWaitlistCount] = useState<number | null>(null)
    const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false)
    const [waitlistStatus, setWaitlistStatus] = useState<WaitlistStatus>('idle')

    const [showWaitlistModal, setShowWaitlistModal] = useState(false)

    const fetchWaitlistCount = useCallback(async () => {
        if (!API_BASE) {
            console.error('Missing NEXT_PUBLIC_API_BASE_URL environment variable')
            return
        }
        try {
            const res = await fetch(`${API_BASE}/api/v1/waitlist/count`)
            if (!res.ok) return
            const data = (await res.json()) as { count?: number }
            if (typeof data.count === 'number') setWaitlistCount(data.count)
        } catch (error) {
            console.error('Failed to fetch waitlist count', error)
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
                    return
                }
                if (!res.ok) throw new Error('failed')
                setWaitlistStatus('success')
                setWaitlistCount(c => (c ?? 0) + 1)
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
