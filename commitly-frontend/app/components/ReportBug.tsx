import { useEffect } from 'react'

interface ReportBugProps {
    isOpen: boolean
    onClose: () => void
}

export default function ReportBug({ isOpen, onClose }: ReportBugProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />

            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="relative w-full max-w-[800px] bg-black text-white rounded border border-white">
                    {/* Top */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white">
                        <h3 className="font-teachers text-[24px] sm:text-[28px]">What happened?</h3>
                        <button aria-label="Close" onClick={onClose} className="p-1 hover:bg-white/10 rounded">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 3L13 13M13 3L3 13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>

                    {/* Bottom */}
                    <div className="px-4 py-4 flex flex-col gap-4">
                        <div>
                            <label className="sr-only" htmlFor="bug-text">Tell us about the issue you encountered</label>
                            <textarea id="bug-text" rows={6} className="w-full bg-transparent border border-white rounded p-2 placeholder:text-white/65 outline-none"
                                placeholder="Tell us about the issue you encountered" />
                        </div>
                        <p className="text-[14px] text-white/70">
                            Any information you share may be reviewed to help improve commitly. If you have any additional questions, contact support.
                        </p>

                        <label className="inline-flex items-center gap-2 select-none">
                            <input type="checkbox" className="accent-white" />
                            <span className="text-[16px]">Include screenshot in report</span>
                        </label>

                        <div className="flex items-center justify-end">
                            <button onClick={onClose} className="px-3 py-2 rounded border border-white text-white hover:bg-white/10 mr-2">Cancel</button>
                            <button className="px-3 py-2 rounded bg-white text-black hover:bg-white/90">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}