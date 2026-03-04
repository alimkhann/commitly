"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { GlobalUsage } from "@/lib/services/repos";
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mapGithubOAuthError } from "@/lib/services/error-messages";
import { githubService } from "@/lib/services/github";
import { repoService } from "@/lib/services/repos";

export default function Home() {
  const router = useRouter();
  const [repoLink, setRepoLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [isCheckingGithub, setIsCheckingGithub] = useState(false);
  const [globalUsage, setGlobalUsage] = useState<GlobalUsage | null>(null);
  const { isSignedIn, getToken } = useAuth();
  const { t } = usePreferences();
  const { markPending } = useRoadmapCatalog();

  useEffect(() => {
    let cancelled = false;
    /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: auth + GitHub status check */
    async function fetchStatus() {
      if (!(isSignedIn && getToken)) {
        setGithubConnected(false);
        setGithubLogin(null);
        return;
      }
      setIsCheckingGithub(true);
      try {
        const token = await getToken();
        const response = await githubService.status(token ?? undefined);
        if (!cancelled) {
          if (response.ok && response.data) {
            setGithubConnected(response.data.connected);
            setGithubLogin(response.data.github_login ?? null);
          } else {
            setGithubConnected(false);
            setGithubLogin(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setGithubConnected(false);
          setGithubLogin(null);
          console.error("Failed to check GitHub status", err);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingGithub(false);
        }
      }
    }
    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  useEffect(() => {
    let cancelled = false;
    const fetchUsage = async () => {
      const response = await repoService.getGlobalUsage();
      if (!(cancelled || !response.ok || !response.data)) {
        setGlobalUsage(response.data);
      }
    };
    fetchUsage();
    const intervalId = window.setInterval(fetchUsage, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = repoLink.trim();
    if (!value) {
      return;
    }

    if (!isSignedIn) {
      console.warn("Sign in to generate personalized timelines.");
      return;
    }

    if (!githubConnected) {
      setError(t("connect_github_before_generate", "Connect GitHub before generating a roadmap."));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const identity = repoService.parseRepoInput(value);
    if (!identity) {
      setIsSubmitting(false);
      setError(t("invalid_repo_url", "Enter a valid GitHub repository URL (owner/name)."));
      return;
    }

    const canonicalUrl = `https://github.com/${identity.fullName}`;
    markPending(identity);

    const params = new URLSearchParams();
    if (identity.fullName) params.set("fullName", identity.fullName);
    if (canonicalUrl) params.set("repoUrl", canonicalUrl);
    params.set("intent", "generate");
    router.push(`/repo/${identity.slug}?view=timeline&${params.toString()}`);
  };

  const handleConnectGithub = async () => {
    if (!isSignedIn) {
      return;
    }
    const token = (await getToken?.()) ?? undefined;
    const response = await githubService.start(
      token,
      typeof window !== "undefined"
        ? `${window.location.origin}/oauth/github`
        : undefined
    );
    if (response.ok && response.data) {
      window.location.href = response.data.authorize_url;
    } else if (response.error) {
      const errorCode =
        "errorCode" in response ? response.errorCode : undefined;
      setError(mapGithubOAuthError(errorCode, response.error, t));
    }
  };

  return (
    <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden px-6 py-12 lg:px-16">
      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-10 py-16 text-center">
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs uppercase tracking-[0.28em]">
            {t("home_kicker", "Repo-first learning")}
          </p>
          <h1 className="font-semibold text-4xl leading-tight tracking-tight sm:text-5xl">
            {t("home_title", "Hey, builder. Ready to learn?")}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t(
              "home_subtitle",
              "Drop a GitHub repo and we'll draft a roadmap that mirrors how the authors shipped it."
            )}
          </p>
        </div>

        <form
          className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-border/70 bg-card p-6"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Input
              className="h-11 flex-1 border-border/70 bg-background text-base"
              disabled={!isSignedIn || isSubmitting || !githubConnected}
              onChange={(event) => setRepoLink(event.target.value)}
              placeholder="https://github.com/your-org/your-repo"
              value={repoLink}
            />
            <Button
              className="h-11 font-semibold text-base disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isSignedIn || isSubmitting || !githubConnected}
              size="lg"
              type="submit"
            >
              {isSubmitting
                ? t("generating", "Generating...")
                : t("generate_roadmap", "Generate roadmap")}
            </Button>
          </div>
          {error && (
            <p className="text-left text-destructive text-sm">{error}</p>
          )}
          {!githubConnected && isSignedIn && (
            <div className="flex flex-col gap-3 text-left text-sm">
              <p className="text-muted-foreground">
                {isCheckingGithub
                  ? t("github_checking", "Checking your GitHub connection...")
                  : t(
                    "github_connect_required",
                    "Connect GitHub to allow Commitly to read repository history."
                  )}
              </p>
              {!isCheckingGithub && (
                <Button
                  onClick={handleConnectGithub}
                  type="button"
                  variant="secondary"
                >
                  {t("connect_github", "Connect GitHub")}
                </Button>
              )}
            </div>
          )}
          {githubConnected && githubLogin && (
            <p className="text-left text-muted-foreground text-xs">
              {t("connected_as", "Connected as")} {githubLogin}
            </p>
          )}
        </form>

        {globalUsage && (
          <div className="mx-auto w-full max-w-2xl rounded-2xl border border-border/70 bg-card px-5 py-4 text-left">
            <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
              {t("shared_token_pool", "Shared AI token pool")}
            </p>
            <p className="mt-1 font-medium text-sm">
              {globalUsage.remaining.toLocaleString()} /{" "}
              {globalUsage.daily_limit.toLocaleString()}{" "}
              {t("tokens_left", "tokens left")}
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              {t("mode", "Mode")}: {globalUsage.mode} · {t("resets", "resets")}{" "}
              {new Date(globalUsage.reset_at).toLocaleString()}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
