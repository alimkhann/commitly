"use client"

import { useEffect, useState } from "react"
import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from "@clerk/nextjs"
import { UserProfile } from "@clerk/nextjs"

import { Button } from "@/components/ui/button"
import { githubService } from "@/lib/services/github"

export default function AccountPage() {
  const { isSignedIn, getToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadStatus() {
      if (!isSignedIn) return
      setLoading(true)
      setError(null)
      try {
        const token = (await getToken?.()) ?? undefined
        const response = await githubService.status(token)
        if (cancelled) return
        if (response.ok && response.data) {
          setConnected(response.data.connected)
          setGithubLogin(response.data.github_login ?? null)
        } else if (!response.ok && response.status === 401) {
          setConnected(false)
          setGithubLogin(null)
        }
      } catch {
        if (!cancelled) setError("Failed to check GitHub connection")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadStatus()
    return () => {
      cancelled = true
    }
  }, [getToken, isSignedIn])

  const handleDisconnect = async () => {
    if (!isSignedIn) return
    setLoading(true)
    setError(null)
    try {
      const token = (await getToken?.()) ?? undefined
      const response = await githubService.disconnect(token)
      if (!response.ok && response.error) {
        setError(response.error)
      }
      setConnected(false)
      setGithubLogin(null)
    } catch {
      setError("Failed to disconnect GitHub")
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!isSignedIn) return
    setLoading(true)
    setError(null)
    try {
      const token = (await getToken?.()) ?? undefined
      const response = await githubService.start(token, window.location.href)
      if (response.ok && response.data) {
        window.location.href = response.data.authorize_url
      } else if (response.error) {
        setError(response.error)
      }
    } catch {
      setError("Failed to start GitHub OAuth")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>

      <SignedIn>
        <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-3xl border border-border/80 bg-card/70 p-6 shadow-xl">
            <UserProfile
              appearance={{
                elements: {
                  card: "shadow-none border-border/60",
                },
              }}
              path="/account"
              routing="path"
            />
          </div>

          <div className="space-y-4 rounded-3xl border border-border/80 bg-card/70 p-6 shadow-xl">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-primary/70">
                Connections
              </p>
              <h2 className="text-xl font-semibold">GitHub</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your GitHub account to generate roadmaps from private and public repositories.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {connected ? "Connected" : loading ? "Checking…" : "Not connected"}
                </p>
                <p className="text-muted-foreground">
                  {connected && githubLogin
                    ? `Signed in as ${githubLogin}`
                    : "Sign in with your GitHub account"}
                </p>
              </div>
              <div className="flex gap-2">
                {connected ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={handleConnect}
                  >
                    Connect GitHub
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </SignedIn>
    </div>
  )
}
