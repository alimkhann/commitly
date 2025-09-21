'use client'

import { createPortal } from 'react-dom'

type SupportStatus = 'idle' | 'success' | 'error'

interface SupportModalProps {
    show: boolean
    supportEmail: string
    setSupportEmail: (email: string) => void
    message: string
    setMessage: (message: string) => void
    supportStatus: SupportStatus
    isSubmittingSupport: boolean
    supportButtonLabel: string
    onClose: () => void
    onSubmit: (e: React.FormEvent) => void
}

export default function SupportModal({
    show,
    supportEmail,
    setSupportEmail,
    message,
    setMessage,
    supportStatus,
    isSubmittingSupport,
    supportButtonLabel,
    onClose,
    onSubmit
}: SupportModalProps) {
    if (!show) return null

    return createPortal(
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50">
            <div className="bg-[#0d0f12] text-white rounded-2xl p-6 w-full max-w-md ring-1 ring-white/10">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-semibold">We're here to help</h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
                </div>
                <form onSubmit={onSubmit} className="space-y-3">
                    <input 
                        className="w-full bg-black/70 text-white placeholder-white/50 border border-white/10 rounded-lg px-4 h-11"
                        placeholder="Your email"
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        required 
                    />
                    <textarea 
                        className="w-full bg-black/70 text-white placeholder-white/50 border border-white/10 rounded-lg px-4 py-3 h-24 resize-none"
                        placeholder="Your question…"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required 
                    />
                    <button 
                        disabled={isSubmittingSupport || !supportEmail || !message}
                        className="w-full h-11 rounded-lg bg-white text-black font-medium disabled:opacity-60"
                    >
                        {supportButtonLabel}
                    </button>
                    {supportStatus !== 'idle' && (
                        <p className="text-sm text-white/70">
                            {supportStatus === 'success' && 'We received your message.'}
                            {supportStatus === 'error' && 'Something went wrong. Please try again.'}
                        </p>
                    )}
                </form>
            </div>
        </div>, 
        document.body
    )
}
