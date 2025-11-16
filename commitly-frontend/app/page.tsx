"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { isSignedIn, getToken } = useAuth();
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
      setError("Connect GitHub before generating a roadmap.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const identity = repoService.parseRepoInput(value);
    if (!identity) {
      setIsSubmitting(false);
      setError("Enter a valid GitHub repository URL (owner/name).");
      return;
    }

    const canonicalUrl = `https://github.com/${identity.fullName}`;
    markPending(identity);

    const params = new URLSearchParams({
      repoUrl: canonicalUrl,
      fullName: identity.fullName,
      intent: "generate",
    });

    router.push(`/repo/${identity.slug}/timeline?${params.toString()}`);
    setRepoLink("");
    setIsSubmitting(false);
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
      setError(response.error);
    }
  };

  return (
    <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden px-6 py-12 lg:px-16">
      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-10 py-16 text-center">
        <div className="space-y-4">
          <p className="text-primary/80 text-sm uppercase tracking-[0.3em]">
            Repo-first learning
          </p>
          <h1 className="font-semibold text-4xl leading-tight tracking-tight sm:text-5xl">
            Hey, builder. Ready to learn?
          </h1>
          <p className="text-lg">
            Drop a GitHub repo and we&apos;ll draft a roadmap that mirrors how
            the authors shipped it.
          </p>
        </div>

        <form
          className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-3xl border border-border bg-card/70 p-6 shadow-2xl shadow-black/30"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              className="flex-1 text-base"
              disabled={!isSignedIn || isSubmitting || !githubConnected}
              onChange={(event) => setRepoLink(event.target.value)}
              placeholder="https://github.com/your-org/your-repo"
              value={repoLink}
            />
            <Button
              className="font-semibold text-base disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isSignedIn || isSubmitting || !githubConnected}
              size="lg"
              type="submit"
            >
              {isSubmitting ? "Generating..." : "Generate roadmap"}
            </Button>
          </div>
          {error && (
            <p className="text-left text-destructive text-sm">{error}</p>
          )}
          {!githubConnected && isSignedIn && (
            <div className="flex flex-col gap-3 text-left text-sm">
              <p className="text-muted-foreground">
                {isCheckingGithub
                  ? "Checking your GitHub connection..."
                  : "Connect GitHub to allow Commitly to read repository history."}
              </p>
              {!isCheckingGithub && (
                <Button
                  onClick={handleConnectGithub}
                  type="button"
                  variant="outline"
                >
                  Connect GitHub
                </Button>
              )}
            </div>
          )}
          {githubConnected && githubLogin && (
            <p className="text-left text-muted-foreground text-xs">
              Connected as {githubLogin}
            </p>
          )}
        </form>

        {/*
        <div className="space-y-4">
          <p className="text-sm font-medium">Examples</p>
          <div className="flex flex-wrap justify-center gap-3">
            {repoService.listExamples(3).map((example) => (
              <Button key={example.id} variant="outline" className="gap-2" asChild>
                <Link href={`/repo/${example.id}/timeline`}>
                  {example.name}
                  <GitBranch className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </div>
        </div>
        */}
      </section>
    </div>
  );
}
