'use client'

import { useCallback, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useSupabaseSession } from '@/lib/useSupabaseSession'
import AuthModal from '../modals/AuthModal'
import SettingsModal from '../modals/SettingsModal'

interface AccountSectionProps {
  isCollapsed: boolean
}

interface HelpLink {
  label: string
  href: string
  icon: string
}

const HELP_LINKS: HelpLink[] = [
  { label: 'Help center', href: '/help/center', icon: '/icons/help.svg' },
  { label: 'Release notes', href: '/help/release-notes', icon: '/icons/note_text_white.svg' },
  { label: 'Terms & policies', href: '/help/terms-policies', icon: '/icons/pencil_line_white.svg' },
  { label: 'Report bug', href: '/help/report-bug', icon: '/icons/hammer_white.svg' },
]

export default function AccountSection({ isCollapsed }: AccountSectionProps) {
  const router = useRouter()
  const { session } = useSupabaseSession()
  const userEmail = session?.user.email || null

  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const toggleMenu = useCallback(() => {
    if (!session) {
      setAuthModalOpen(true)
      return
    }
    setMenuOpen((prev) => !prev)
    setHelpOpen(false)
  }, [session])

  const closeAll = useCallback(() => {
    setMenuOpen(false)
    setHelpOpen(false)
  }, [])

  const handleSignOut = useCallback(async () => {
    setBusy(true)
    try {
      await supabase.auth.signOut()
      closeAll()
      setSettingsOpen(false)
    } finally {
      setBusy(false)
    }
  }, [closeAll])

  const handleDeleteAccount = useCallback(async () => {
    if (!session?.access_token) return
    setBusy(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_COMMITLY_API_BASE || 'http://127.0.0.1:8000'}/api/v1/account/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      if (!res.ok) {
        throw new Error('Failed to delete account')
      }
      await supabase.auth.signOut()
      closeAll()
      setSettingsOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }, [session, closeAll])

  const helpItems = useMemo(() => HELP_LINKS, [])

  return (
    <>
      {menuOpen && (
        <div
          className="fixed inset-0 z-[5] bg-transparent"
          onClick={(event) => {
            event.stopPropagation()
            closeAll()
          }}
          aria-hidden="true"
        />
      )}

      <div className={`relative z-[10] flex flex-col w-full ${isCollapsed ? 'items-start pt-2' : 'items-start pt-4'}`}>
        {/* Dropdown */}
        <div
          className={`absolute bottom-full mb-2 flex flex-col gap-2 items-start px-4 py-3 rounded border border-white bg-black shadow-lg transition-all duration-300 ease-in-out ${isCollapsed ? 'left-0 min-w-[240px]' : 'left-0 right-0'}`}
          style={{ opacity: menuOpen ? 1 : 0, transform: menuOpen ? 'translateY(0)' : 'translateY(8px)', pointerEvents: menuOpen ? 'auto' : 'none' }}
        >
          {session && (
            <div className="flex gap-2 items-center w-full p-1">
              <div className="w-6 h-6 flex items-center justify-center">
                <Image src="/icons/profile_white.svg" alt="Profile" width={24} height={24} className="w-6 h-6" />
              </div>
              <p className="font-teachers text-white/80 text-responsive-xl whitespace-nowrap overflow-hidden text-ellipsis">
                {userEmail}
              </p>
            </div>
          )}

          {session && (
            <button
              className="flex gap-2 items-center w-full hover:bg-white/15 rounded transition-colors p-1"
              onClick={() => setHelpOpen((prev) => !prev)}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Image src="/icons/help.svg" alt="Help" width={20} height={20} className="w-5 h-5" />
              </div>
              <p className="font-teachers text-white text-responsive-xl">Help</p>
              <div className="ml-auto w-4 h-4 flex items-center justify-center">
                <Image src="/icons/chevron_right_white.svg" alt="open" width={12} height={12} className="w-4 h-4" />
              </div>
            </button>
          )}

          {session && helpOpen && (
            <div className="w-full border border-white/20 rounded p-2 space-y-2">
              {helpItems.map((item) => (
                <button
                  key={item.href}
                  className="flex gap-2 items-center w-full hover:bg-white/15 rounded px-2 py-1 text-left"
                  onClick={() => {
                    router.push(item.href)
                    closeAll()
                  }}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <Image src={item.icon} alt={item.label} width={20} height={20} className="w-5 h-5" />
                  </div>
                  <span className="font-teachers text-white text-responsive-base">{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {session && (
            <button
              className="flex gap-2 items-center w-full hover:bg-white/15 rounded transition-colors p-1"
              onClick={() => {
                setSettingsOpen(true)
                closeAll()
              }}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Image src="/icons/settings_white.svg" alt="Settings" width={20} height={20} className="w-5 h-5" />
              </div>
              <p className="font-teachers text-white text-responsive-xl">Settings</p>
            </button>
          )}

          {session && (
            <button
              className="flex gap-2 items-center w-full hover:bg-white/15 rounded transition-colors p-1"
              onClick={handleSignOut}
              disabled={busy}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Image src="/icons/logout.svg" alt="Sign out" width={20} height={20} className="w-5 h-5" />
              </div>
              <p className="font-teachers text-white text-responsive-xl">Sign out</p>
            </button>
          )}
        </div>

        {/* Account Button */}
        <button
          onClick={toggleMenu}
          className={`${isCollapsed ? 'flex items-center justify-start w-full px-2 py-1.5 rounded' : 'flex items-center gap-2.5 px-4 py-2 rounded w-full'} border border-transparent hover:bg-white/15 transition-colors`}
        >
          <div className={`relative w-8 h-8 transition-transform duration-300 ${isCollapsed ? 'translate-x-[6px]' : ''}`}>
            <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
          </div>
          {!isCollapsed && (
            <p className="font-teachers text-white text-[20px] whitespace-nowrap">
              {session ? userEmail : 'Sign in'}
            </p>
          )}
        </button>

        {!session && authModalOpen && (
          <AuthModal
            open={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
          />
        )}

        {session && (
          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
            email={userEmail}
            busy={busy}
          />
        )}
      </div>
    </>
  )
}
