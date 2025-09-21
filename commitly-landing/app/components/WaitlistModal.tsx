'use client'

import { createPortal } from 'react-dom'
import { useLanguage } from '../contexts/LanguageContext'

type WaitlistStatus = 'idle' | 'success' | 'error' | 'duplicate'

interface WaitlistModalProps {
    show: boolean
    waitlistEmail: string
    setWaitlistEmail: (email: string) => void
    waitlistStatus: WaitlistStatus
    isSubmittingWaitlist: boolean
    waitlistButtonLabel: string
    onClose: () => void
    onSubmit: (e: React.FormEvent) => void
}

export default function WaitlistModal({
    show,
    waitlistEmail,
    setWaitlistEmail,
    waitlistStatus,
    isSubmittingWaitlist,
    waitlistButtonLabel,
    onClose,
    onSubmit
}: WaitlistModalProps) {
    const { t } = useLanguage()

    if (!show) return null

    return createPortal(
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50">
            <div className="bg-[#0d0f12] text-white rounded-2xl p-6 w-full max-w-md ring-1 ring-white/10">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-semibold">{t.joinWaitlistModalTitle}</h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
                </div>
                <form onSubmit={onSubmit} className="space-y-3">
                    <div className="flex rounded-lg overflow-hidden bg-black/70 ring-1 ring-inset ring-white/10">
                        <input 
                            className="input-dark flex-1 px-5"
                            placeholder={t.modalEmailPlaceholder}
                            value={waitlistEmail}
                            onChange={(e) => setWaitlistEmail(e.target.value)} 
                        />
                        <button 
                            disabled={isSubmittingWaitlist || !waitlistEmail}
                            className="btn-white rounded-none px-5 disabled:opacity-60"
                        >
                            {waitlistButtonLabel}
                        </button>
                    </div>
                    {waitlistStatus !== 'idle' && (
                        <p className="text-sm text-white/70">
                            {waitlistStatus === 'success' && t.modalSuccessMessage}
                            {waitlistStatus === 'duplicate' && t.modalDuplicateMessage}
                            {waitlistStatus === 'error' && t.modalErrorMessage}
                        </p>
                    )}
                </form>
            </div>
        </div>, 
        document.body
    )
}
