"use client"

import { useMemo, useState } from "react"
import {
  Bell,
  ShieldCheck,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

const SECTION_CONFIG = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "account", label: "Account", icon: User },
] as const

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<(typeof SECTION_CONFIG)[number]["id"]>(
    "general"
  )
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [mfaEnabled, setMfaEnabled] = useState(false)

  const activeLabel = useMemo(
    () => SECTION_CONFIG.find((section) => section.id === activeTab)?.label ?? "Settings",
    [activeTab]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
        <div className="flex h-[640px] overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl shadow-black/40">
          <aside className="w-60 border-r border-border/60 bg-background/60 p-4">
            <button
              aria-label="Close settings"
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors hover:border-border"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mt-6 space-y-1">
              {SECTION_CONFIG.map((section) => {
                const Icon = section.icon
                const isActive = activeTab === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveTab(section.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {section.label}
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="flex flex-1 flex-col">
            <div className="border-b border-border/60 p-6">
              <h2 className="text-2xl font-semibold">{activeLabel}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 text-sm">
              {activeTab === "general" && <GeneralSection />}
              {activeTab === "notifications" && (
                <NotificationsSection
                  notificationsEnabled={notificationsEnabled}
                  setNotificationsEnabled={setNotificationsEnabled}
                />
              )}
              {activeTab === "security" && (
                <SecuritySection mfaEnabled={mfaEnabled} setMfaEnabled={setMfaEnabled} />
              )}
              {activeTab === "account" && <AccountSectionContent />}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GeneralSection() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 p-4">
        <p className="font-medium">Theme</p>
        <p className="text-sm text-muted-foreground">
          Commitly follows your system preference by default.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary">
            System
          </Button>
          <Button size="sm" variant="ghost">
            Light
          </Button>
          <Button size="sm" variant="ghost">
            Dark
          </Button>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 p-4">
        <p className="font-medium">Language</p>
        <p className="text-sm text-muted-foreground">
          We auto-detect from your browser headers, but you can override it.
        </p>
        <Input placeholder="Prefer auto-detect" className="mt-3" />
      </div>
    </div>
  )
}

function NotificationsSection({
  notificationsEnabled,
  setNotificationsEnabled,
}: {
  notificationsEnabled: boolean
  setNotificationsEnabled: (value: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
        <div>
          <p className="font-medium">Timeline responses</p>
          <p className="text-sm text-muted-foreground">
            Get a push when commitly generates long-running timelines.
          </p>
        </div>
        <Switch
          checked={notificationsEnabled}
          onCheckedChange={setNotificationsEnabled}
        />
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
        <div>
          <p className="font-medium">Weekly digest</p>
          <p className="text-sm text-muted-foreground">
            Summary of repos, hints requested, and plan usage.
          </p>
        </div>
        <Switch />
      </div>
    </div>
  )
}

function SecuritySection({
  mfaEnabled,
  setMfaEnabled,
}: {
  mfaEnabled: boolean
  setMfaEnabled: (value: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
        <div>
          <p className="font-medium">Multi-factor authentication</p>
          <p className="text-sm text-muted-foreground">
            Required for accessing private repos inside commitly.
          </p>
        </div>
        <Switch checked={mfaEnabled} onCheckedChange={setMfaEnabled} />
      </div>
      <div className="rounded-2xl border border-border/60 p-4">
        <p className="font-medium">Active sessions</p>
        <p className="text-sm text-muted-foreground">
          Sign out anywhere you no longer recognize.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            Sign out this device
          </Button>
          <Button variant="destructive" size="sm">
            Sign out everywhere
          </Button>
        </div>
      </div>
    </div>
  )
}

function AccountSectionContent() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 p-4">
        <p className="font-medium">Plan</p>
        <p className="text-sm text-muted-foreground">Free · 2 repo timelines / week.</p>
        <Button className="mt-3" size="sm" variant="secondary">
          Manage plan
        </Button>
      </div>
      <div className="rounded-2xl border border-border/60 p-4">
        <p className="font-medium">Email</p>
        <p className="text-sm text-muted-foreground">zhanbo@commitly.dev</p>
      </div>
      <Separator />
      <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
        <div>
          <p className="font-medium text-destructive">Delete account</p>
          <p className="text-sm text-muted-foreground">
            Removes imported repos and history after a 7-day hold.
          </p>
        </div>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </div>
    </div>
  )
}
