'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSupabaseSession } from '@/lib/useSupabaseSession'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

type Mode = 'signin' | 'signup'

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { session } = useSupabaseSession()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session && open) {
      onClose()
    }
  }, [session, open, onClose])

  useEffect(() => {
    if (!open) {
      setError(null)
      setPassword('')
      setConfirmPassword('')
    }
  }, [open])

  if (!open) return null

  const switchMode = () => {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))
    setError(null)
  }

  const signInWithGoogle = async () => {
    setLoading(true)
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    } catch (err) {
      console.error(err)
      setError('Unable to start Google sign in right now.')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        onClose()
      } else {
        if (password !== confirmPassword) {
          setError('Passwords do not match.')
          return
        }
        const { error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        if (signUpError) throw signUpError
        setError('Check your inbox to confirm your email before signing in.')
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded border border-white bg-black/90 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-teachers text-white text-2xl">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <button className="text-white/60 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <input
            className="w-full bg-transparent border border-white/30 rounded px-3 py-2 text-white"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="w-full bg-transparent border border-white/30 rounded px-3 py-2 text-white"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
          {mode === 'signup' && (
            <input
              className="w-full bg-transparent border border-white/30 rounded px-3 py-2 text-white"
              placeholder="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            className="w-full bg-white text-black px-4 py-2 rounded font-teachers font-bold disabled:opacity-50"
            onClick={handleEmailAuth}
            disabled={loading}
          >
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
          <button
            className="w-full border border-white text-white px-4 py-2 rounded font-teachers hover:bg-white/10 disabled:opacity-50"
            onClick={signInWithGoogle}
            disabled={loading}
          >
            Continue with Google
          </button>
        </div>

        <div className="mt-6 text-center text-white/70 text-sm">
          {mode === 'signin' ? (
            <p>
              Don&apos;t have an account?{' '}
              <button className="underline" onClick={switchMode}>Create a new one</button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button className="underline" onClick={switchMode}>Sign in</button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
