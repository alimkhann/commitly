"use client"

import { useEffect, useState } from "react"
import { Bell, GitBranch, SlidersHorizontal } from "lucide-react"
import { UserProfile, useAuth } from "@clerk/nextjs"
import { dark } from "@clerk/themes"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { githubService } from "@/lib/services/github"

type AccountSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AccountSettingsDialog({
  open,
  onOpenChange,
}: AccountSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-auto border-none bg-transparent p-0 shadow-none -ml-16">
        <UserProfile
          routing="hash"
          appearance={{
            baseTheme: dark,
            variables: {
              colorBackground: "#050507",
              colorText: "#f5f6fb",
              borderRadius: "0.3rem",
            },
            elements: {
            },
          }}
        >
          <UserProfile.Page label="General" url="general" labelIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}>
            <GeneralPreferences />
          </UserProfile.Page>
          <UserProfile.Page label="Notifications" url="notifications" labelIcon={<Bell className="h-3.5 w-3.5" />}>
            <NotificationsPreferences />
          </UserProfile.Page>
          <UserProfile.Page label="Connections" url="connections" labelIcon={<GitBranch className="h-3.5 w-3.5" />}>
            <GithubConnectionPreferences />
          </UserProfile.Page>
        </UserProfile>
      </DialogContent>
    </Dialog>
  )
}

function GeneralPreferences() {
  return (
    <div className="space-y-5 py-6 text-sm text-foreground">
      <section className="rounded-3xl border-none p-6">
        <div className="space-y-3">
          <div>
            <p className="text-base font-medium text-white">Theme</p>
            <p className="text-xs text-white/60">
              Commitly follows your system preference by default. Override it to lock a theme.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-white/80">
            <Button size="sm" variant="secondary" className="rounded-full px-4">
              System
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full px-4">
              Light
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full px-4">
              Dark
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border-none p-6 text-foreground">
        <div className="space-y-3">
          <div>
            <p className="text-base font-medium text-white">Language</p>
            <p className="text-xs text-white/60">
              We auto-detect from your browser headers, but you can override it anytime.
            </p>
          </div>
          <Input
            placeholder="Prefer auto-detect"
            className="mt-1 text-foreground placeholder:text-white/40"
          />
        </div>
      </section>
    </div>
  )
}

function NotificationsPreferences() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false)

  return (
    <div className="space-y-5 py-6 text-sm text-foreground">
      <section className="rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Timeline responses</p>
            <p className="text-xs text-white/60">
              Get a push when commitly generates long-running timelines.
            </p>
          </div>
          <Switch
            checked={notificationsEnabled}
            onCheckedChange={setNotificationsEnabled}
          />
        </div>
      </section>
      <section className="rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Weekly digest</p>
            <p className="text-xs text-white/60">
              Summary of repos, hints requested, and plan usage.
            </p>
          </div>
          <Switch checked={weeklyDigestEnabled} onCheckedChange={setWeeklyDigestEnabled} />
        </div>
      </section>
    </div>
  )
}

function GithubConnectionPreferences() {
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
        } else if (response.status === 401) {
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
      const response = await githubService.start(token, typeof window !== "undefined" ? window.location.href : undefined)
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
    <div className="space-y-4 py-6 text-sm text-foreground">
      <div className="rounded-3xl border border-border/60 bg-background/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-base font-medium text-white">GitHub</p>
            <p className="text-xs text-white/60">
              {connected && githubLogin
                ? `Connected as ${githubLogin}`
                : loading
                  ? "Checking your GitHub connection..."
                  : "Connect to generate roadmaps from your repositories."}
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex gap-2">
            {connected ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            ) : (
              !loading && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleConnect}
                >
                  Connect GitHub
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
