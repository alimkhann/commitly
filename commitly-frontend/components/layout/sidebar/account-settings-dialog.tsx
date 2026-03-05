"use client";

import { UserProfile, useAuth } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Archive, GitBranch, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mapGithubOAuthError } from "@/lib/services/error-messages";
import { githubService } from "@/lib/services/github";

type AccountSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AccountSettingsDialog({
  open,
  onOpenChange,
}: AccountSettingsDialogProps) {
  const { theme, t } = usePreferences();
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      setIsDarkMode(theme === "dark" || (theme === "system" && media.matches));
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="mx-auto max-w-4xl border border-border/70 bg-card p-0 shadow-2xl">
        <UserProfile
          appearance={{
            baseTheme: isDarkMode ? dark : undefined,
            variables: {
              colorBackground: isDarkMode ? "#0b1020" : "#ffffff",
              colorText: isDarkMode ? "#f5f6fb" : "#111827",
              borderRadius: "0.3rem",
            },
            elements: {},
          }}
          routing="hash"
        >
          <UserProfile.Page
            label={t("settings_preferences", "Preferences")}
            labelIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            url="preferences"
          >
            <GeneralPreferences />
          </UserProfile.Page>
          <UserProfile.Page
            label={t("connections", "Connections")}
            labelIcon={<GitBranch className="h-3.5 w-3.5" />}
            url="connections"
          >
            <GithubConnectionPreferences />
          </UserProfile.Page>
          <UserProfile.Page
            label={t("archived_repositories", "Archived repositories")}
            labelIcon={<Archive className="h-3.5 w-3.5" />}
            url="archived"
          >
            <ArchivedRepositoriesPreferences />
          </UserProfile.Page>
        </UserProfile>
      </DialogContent>
    </Dialog>
  );
}

function GeneralPreferences() {
  const { theme, language, setTheme, setLanguage, saving, t, languageNames } =
    usePreferences();

  return (
    <div className="space-y-5 py-6 text-foreground text-sm">
      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-base text-foreground">{t("settings_preferences", "Preferences")}</p>
            <p className="text-muted-foreground text-xs">{t("preferences_description", "Choose your theme and language. Changes persist on your account.")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs" htmlFor="theme-preference">
                {t("theme", "Theme")}
              </label>
              <Select
                onValueChange={(value) =>
                  setTheme(value as "system" | "light" | "dark")
                }
                value={theme}
              >
                <SelectTrigger id="theme-preference">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">{t("theme_system", "System")}</SelectItem>
                  <SelectItem value="light">{t("theme_light", "Light")}</SelectItem>
                  <SelectItem value="dark">{t("theme_dark", "Dark")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs" htmlFor="language-preference">
                {t("language", "Language")}
              </label>
              <Select
                onValueChange={(value) =>
                  setLanguage(value as "en" | "zh-HK" | "kz" | "ru")
                }
                value={language}
              >
                <SelectTrigger id="language-preference">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(languageNames).map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            {saving ? t("saving", "Saving...") : t("saved", "Saved")}
          </p>
        </div>
      </section>
    </div>
  );
}

function GithubConnectionPreferences() {
  const { t } = usePreferences();
  const { isSignedIn, getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: manageable auth/status flow */
    async function loadStatus() {
      if (!isSignedIn) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const token = (await getToken?.()) ?? undefined;
        const response = await githubService.status(token);
        if (cancelled) {
          return;
        }
        if (response.ok && "data" in response && response.data) {
          setConnected(response.data.connected);
          setGithubLogin(response.data.github_login ?? null);
        } else if ("status" in response && response.status === 401) {
          setConnected(false);
          setGithubLogin(null);
        }
      } catch {
        if (!cancelled) {
          setError(t("github_status_failed", "Failed to check GitHub connection"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn, t]);

  const handleDisconnect = async () => {
    if (!isSignedIn) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = (await getToken?.()) ?? undefined;
      const response = await githubService.disconnect(token);
      if (!response.ok && response.error) {
        const errorCode =
          "errorCode" in response ? response.errorCode : undefined;
        setError(mapGithubOAuthError(errorCode, response.error, t));
      }
      setConnected(false);
      setGithubLogin(null);
    } catch {
      setError(t("github_disconnect_failed", "Failed to disconnect GitHub"));
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!isSignedIn) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = (await getToken?.()) ?? undefined;
      const response = await githubService.start(
        token,
        typeof window !== "undefined"
          ? `${window.location.origin}/oauth/github`
          : undefined
      );
      if (response.ok && "data" in response && response.data) {
        window.location.href = response.data.authorize_url;
      } else if ("error" in response && response.error) {
        const errorCode =
          "errorCode" in response ? response.errorCode : undefined;
        setError(mapGithubOAuthError(errorCode, response.error, t));
      }
    } catch {
      setError(t("github_oauth_start_failed", "Failed to start GitHub OAuth"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 py-6 text-foreground text-sm">
      <div className="rounded-3xl border border-border/60 bg-background/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium text-base text-foreground">{t("github", "GitHub")}</p>
            {(() => {
              let statusText =
                t("github_connect_blurb", "Connect to generate roadmaps from your repositories.");
              if (connected && githubLogin) {
                statusText = `${t("connected_as", "Connected as")} ${githubLogin}`;
              } else if (loading) {
                statusText = t("github_checking", "Checking your GitHub connection...");
              }
              return <p className="text-muted-foreground text-xs">{statusText}</p>;
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
                {t("disconnect", "Disconnect")}
              </Button>
            ) : (
              !loading && (
                <Button
                  onClick={handleConnect}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("connect_github", "Connect GitHub")}
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchivedRepositoriesPreferences() {
  const { t } = usePreferences();
  const { archivedRepos, unarchive } = useRoadmapCatalog();
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleUnarchive = async (fullName: string) => {
    setLoading((prev) => ({ ...prev, [fullName]: true }));
    try {
      await unarchive(fullName);
    } finally {
      setLoading((prev) => ({ ...prev, [fullName]: false }));
    }
  };

  return (
    <div className="space-y-4 py-6 text-foreground text-sm">
      {archivedRepos.length === 0 ? (
        <div className="rounded-3xl border border-border/60 bg-background/60 p-6 text-center">
          <Archive className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-base text-foreground">
            {t("no_archived_repositories", "No archived repositories")}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            {t(
              "archived_repositories_hint",
              "Repositories you archive appear here. You can unarchive them anytime."
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {archivedRepos.map((repo) => {
            const isLoading = loading[repo.repo_full_name] ?? false;
            return (
              <div
                className="rounded-3xl border border-border/60 bg-background/60 p-4"
                key={repo.repo_full_name}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium text-base text-foreground">
                      {repo.repo_full_name}
                    </p>
                    {repo.repo?.description && (
                      <p className="line-clamp-2 text-muted-foreground text-xs">
                        {repo.repo.description}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {t("archived_readonly", "Archived repositories are read-only")}
                    </p>
                  </div>
                  <Button
                    disabled={isLoading}
                    onClick={() => handleUnarchive(repo.repo_full_name)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {isLoading
                      ? t("unarchiving", "Unarchiving...")
                      : t("unarchive", "Unarchive")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
