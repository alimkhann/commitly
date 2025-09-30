'use client'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onSignOut: () => void
  onDeleteAccount: () => void
  email: string | null
  busy?: boolean
}

export default function SettingsModal({ open, onClose, onSignOut, onDeleteAccount, email, busy }: SettingsModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded border border-white bg-black/90 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-teachers text-white text-2xl">Account settings</h2>
          <button className="text-white/60 hover:text-white" onClick={onClose}>✕</button>
        </div>

        <div className="space-y-3 text-white/80 text-sm">
          <div>
            <p className="text-white/60 uppercase tracking-wide text-xs">Email</p>
            <p className="font-teachers text-lg text-white">{email || 'Unknown user'}</p>
          </div>

          <div className="border border-white/20 rounded p-3 space-y-2">
            <p className="font-teachers text-white text-base">Actions</p>
            <button
              className="w-full border border-white/60 text-white px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
              onClick={onSignOut}
              disabled={busy}
            >
              Log out
            </button>
            <button
              className="w-full border border-[#ba2623] text-[#ba2623] px-3 py-2 rounded hover:bg-[#ba2623]/10 disabled:opacity-50"
              onClick={onDeleteAccount}
              disabled={busy}
            >
              Delete account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
