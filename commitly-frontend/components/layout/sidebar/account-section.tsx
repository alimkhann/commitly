"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignOutButton,
  SignUpButton,
  useUser,
} from "@clerk/nextjs";
import {
  Bug,
  ExternalLink,
  HelpCircle,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ReportBug from "@/components/modals/report-bug";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import AccountSettingsDialog from "./account-settings-dialog";

type AccountSectionProps = {
  isCollapsed: boolean;
};

export default function AccountSection({ isCollapsed }: AccountSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, user, isSignedIn } = useUser();
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [reportBugOpen, setReportBugOpen] = useState(false);

  useEffect(() => {
    if (searchParams?.get("settings") !== "connections") return;
    const timeoutId = window.setTimeout(() => {
      setAccountSettingsOpen(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  const displayName = useMemo(() => {
    if (!user) {
      return "Workspace";
    }
    return (
      user.fullName ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "Workspace"
    );
  }, [user]);

  const planLabel = useMemo(() => {
    if (!user) {
      return "Sign in to manage plan";
    }
    const publicMeta = user.publicMetadata as
      | Record<string, unknown>
      | undefined;
    const planName = (publicMeta?.planName as string | undefined) ?? undefined;
    if (typeof planName === "string" && planName.trim().length > 0) {
      return planName;
    }
    return "Free plan";
  }, [user]);

  const initials = useMemo(
    () =>
      displayName
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "CW",
    [displayName]
  );

  return (
    <>
      <SignedIn>
        <div
          className={cn(
            "border-border/40 border-t px-4 py-4",
            isCollapsed && "px-2"
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Open workspace menu"
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isCollapsed
                    ? "flex-col bg-transparent hover:bg-muted/30"
                    : "justify-between bg-[#111827] hover:bg-[#141b26]"
                )}
                disabled={!(isLoaded && isSignedIn)}
                type="button"
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
                      <p className="font-semibold text-sm leading-tight">
                        {displayName}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {planLabel}
                      </p>
                    </div>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                align="center"
                className="w-[min(300px,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-[#0d1117] p-3 shadow-2xl"
                side="top"
                sideOffset={16}
              >
                <DropdownMenuItem onClick={() => setAccountSettingsOpen(true)}>
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
                    <DropdownMenuSubContent className="w-[min(280px,calc(100vw-3rem))] rounded-xl border border-border/70 bg-[#0d1117] shadow-xl">
                      <DropdownMenuItem
                        onClick={() => router.push("/help-center")}
                      >
                        Help center
                        <ExternalLink className="ml-auto h-3.5 w-3.5" />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push("/release-notes")}
                      >
                        Release notes
                        <ExternalLink className="ml-auto h-3.5 w-3.5" />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push("/policies")}
                      >
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

        <AccountSettingsDialog
          onOpenChange={setAccountSettingsOpen}
          open={accountSettingsOpen}
        />
        <ReportBug onOpenChange={setReportBugOpen} open={reportBugOpen} />
      </SignedIn>

      <SignedOut>
        <div
          className={cn(
            "border-border/40 border-t px-4 py-4",
            isCollapsed && "px-2"
          )}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <SignInButton mode="modal">
                <Button className="h-12 w-12 rounded-2xl" size="icon">
                  →
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button
                  className="h-12 w-12 rounded-2xl"
                  size="icon"
                  variant="secondary"
                >
                  +
                </Button>
              </SignUpButton>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-[#0d1117] p-4 text-center">
              <p className="font-semibold text-sm">Sign in to track progress</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Sync repo timelines, save task states, and unlock the workspace
                menu.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <SignInButton mode="modal">
                  <Button className="w-full">Sign in</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button className="w-full" variant="secondary">
                    Create account
                  </Button>
                </SignUpButton>
              </div>
            </div>
          )}
        </div>
      </SignedOut>
    </>
  );
}
