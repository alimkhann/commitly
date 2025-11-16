"use client";

import { UserProfile, useAuth } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Bell, GitBranch, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { githubService } from "@/lib/services/github";

type AccountSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AccountSettingsDialog({
  open,
  onOpenChange,
}: AccountSettingsDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="-ml-16 mx-auto border-none bg-transparent p-0 shadow-none">
        <UserProfile
          appearance={{
            baseTheme: dark,
            variables: {
              colorBackground: "#050507",
              colorText: "#f5f6fb",
              borderRadius: "0.3rem",
            },
            elements: {},
          }}
          routing="hash"
        >
          <UserProfile.Page
            label="General"
            labelIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            url="general"
          >
            <GeneralPreferences />
          </UserProfile.Page>
          <UserProfile.Page
            label="Notifications"
            labelIcon={<Bell className="h-3.5 w-3.5" />}
            url="notifications"
          >
            <NotificationsPreferences />
          </UserProfile.Page>
          <UserProfile.Page
            label="Connections"
            labelIcon={<GitBranch className="h-3.5 w-3.5" />}
            url="connections"
          >
            <GithubConnectionPreferences />
          </UserProfile.Page>
        </UserProfile>
      </DialogContent>
    </Dialog>
  );
}

function GeneralPreferences() {
  return (
    <div className="space-y-5 py-6 text-foreground text-sm">
      <section className="rounded-3xl border-none p-6">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-base text-white">Theme</p>
            <p className="text-white/60 text-xs">
              Commitly follows your system preference by default. Override it to
              lock a theme.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-white/80">
            <Button className="rounded-full px-4" size="sm" variant="secondary">
              System
            </Button>
            <Button className="rounded-full px-4" size="sm" variant="ghost">
              Light
            </Button>
            <Button className="rounded-full px-4" size="sm" variant="ghost">
              Dark
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border-none p-6 text-foreground">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-base text-white">Language</p>
            <p className="text-white/60 text-xs">
              We auto-detect from your browser headers, but you can override it
              anytime.
            </p>
          </div>
          <Input
            className="mt-1 text-foreground placeholder:text-white/40"
            placeholder="Prefer auto-detect"
          />
        </div>
      </section>
    </div>
  );
}

function NotificationsPreferences() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);

  return (
    <div className="space-y-5 py-6 text-foreground text-sm">
      <section className="rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Timeline responses</p>
            <p className="text-white/60 text-xs">
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
            <p className="text-white/60 text-xs">
              Summary of repos, hints requested, and plan usage.
            </p>
          </div>
          <Switch
            checked={weeklyDigestEnabled}
            onCheckedChange={setWeeklyDigestEnabled}
          />
        </div>
      </section>
    </div>
  );
}

function GithubConnectionPreferences() {
  const { isSignedIn, getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      if (!isSignedIn) return;
      setLoading(true);
      setError(null);
      try {
        const token = (await getToken?.()) ?? undefined;
        const response = await githubService.status(token);
        if (cancelled) return;
        if (response.ok && response.data) {
          setConnected(response.data.connected);
          setGithubLogin(response.data.github_login ?? null);
        } else if (response.status === 401) {
          setConnected(false);
          setGithubLogin(null);
        }
      } catch {
        if (!cancelled) setError("Failed to check GitHub connection");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  const handleDisconnect = async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError(null);
    try {
      const token = (await getToken?.()) ?? undefined;
      const response = await githubService.disconnect(token);
      if (!response.ok && response.error) {
        setError(response.error);
      }
      setConnected(false);
      setGithubLogin(null);
    } catch {
      setError("Failed to disconnect GitHub");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError(null);
    try {
      const token = (await getToken?.()) ?? undefined;
      const response = await githubService.start(
        token,
        typeof window !== "undefined" ? window.location.href : undefined
      );
      if (response.ok && response.data) {
        window.location.href = response.data.authorize_url;
      } else if (response.error) {
        setError(response.error);
      }
    } catch {
      setError("Failed to start GitHub OAuth");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 py-6 text-foreground text-sm">
      <div className="rounded-3xl border border-border/60 bg-background/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium text-base text-white">GitHub</p>
            {(() => {
              let statusText =
                "Connect to generate roadmaps from your repositories.";
              if (connected && githubLogin) {
                statusText = `Connected as ${githubLogin}`;
              } else if (loading) {
                statusText = "Checking your GitHub connection...";
              }
              return <p className="text-white/60 text-xs">{statusText}</p>;
            })()}
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
          <div className="flex gap-2">
            {connected ? (
              <Button
                disabled={loading}
                onClick={handleDisconnect}
                size="sm"
                type="button"
                variant="outline"
              >
                Disconnect
              </Button>
            ) : (
              !loading && (
                <Button
                  onClick={handleConnect}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Connect GitHub
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
