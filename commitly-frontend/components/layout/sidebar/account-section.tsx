"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bug,
  ExternalLink,
  HelpCircle,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react"
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignOutButton,
  SignUpButton,
  useUser,
} from "@clerk/nextjs"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import ReportBug from "@/components/modals/report-bug"
import SettingsDialog from "./settings-dialog"

type AccountSectionProps = {
  isCollapsed: boolean
}

export default function AccountSection({ isCollapsed }: AccountSectionProps) {
  const router = useRouter()
  const { isLoaded, user, isSignedIn } = useUser()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reportBugOpen, setReportBugOpen] = useState(false)

  const displayName = useMemo(() => {
    if (!user) return "Workspace"
    return user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Workspace"
  }, [user])

  const planLabel = useMemo(() => {
    if (!user) return "Sign in to manage plan"
    const metadataPlan =
      (user.publicMetadata?.planName as string | undefined) ??
      (user.privateMetadata?.planName as string | undefined)
    return metadataPlan || "Free plan"
  }, [user])

  const initials = useMemo(() => {
    return displayName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
      || "CW"
  }, [displayName])

  return (
    <>
      <SignedIn>
        <div
          className={cn(
            "border-t border-border/40 px-4 py-4",
            isCollapsed && "px-2"
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isCollapsed
                    ? "flex-col bg-transparent hover:bg-muted/30"
                    : "justify-between bg-card/50 hover:bg-muted/30"
                )}
                aria-label="Open workspace menu"
                disabled={!isLoaded || !isSignedIn}
              >
                <div
                  className={cn(
                    "flex items-center gap-3",
                    isCollapsed && "flex-col"
                  )}
                >
                  <Avatar className="h-11 w-11 bg-muted">
                    <AvatarImage alt={displayName} src={user?.imageUrl ?? ""} />
                    <AvatarFallback className="text-sm uppercase">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="text-left">
                      <p className="text-sm font-semibold leading-tight">
                        {displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {planLabel}
                      </p>
                    </div>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                side="top"
                align="center"
                sideOffset={16}
                className="w-[min(300px,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-card/95 p-3 shadow-2xl backdrop-blur"
              >
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/plans")}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade plan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Help & resources
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent
                      side="left"
                      align="start"
                      sideOffset={12}
                      className="w-[min(280px,calc(100vw-3rem))] rounded-xl border border-border/60 bg-card/95 shadow-xl backdrop-blur"
                    >
                      <DropdownMenuItem onClick={() => router.push("/help-center")}>
                        Help center
                        <ExternalLink className="ml-auto h-3.5 w-3.5" />
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push("/release-notes")}>
                        Release notes
                        <ExternalLink className="ml-auto h-3.5 w-3.5" />
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push("/policies")}>
                        Terms & policies
                        <ExternalLink className="ml-auto h-3.5 w-3.5" />
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setReportBugOpen(true)}>
                        <Bug className="mr-2 h-4 w-4" />
                        Report a bug
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <SignOutButton>
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </SignOutButton>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        </div>

        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        <ReportBug open={reportBugOpen} onOpenChange={setReportBugOpen} />
      </SignedIn>

      <SignedOut>
        <div
          className={cn(
            "border-t border-border/40 px-4 py-4",
            isCollapsed && "px-2"
          )}
        >
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-center shadow-inner">
            <p className="text-sm font-semibold">Sign in to track progress</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sync repo timelines, save task states, and unlock the workspace menu.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <SignInButton mode="modal">
                <Button className="w-full">Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="secondary" className="w-full">
                  Create account
                </Button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </SignedOut>
    </>
  )
}
