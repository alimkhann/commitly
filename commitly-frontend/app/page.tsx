"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { GitBranch } from "lucide-react"
import { useAuth } from "@clerk/nextjs"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { githubService } from "@/lib/services/github"
import { repoService, type RoadmapResponseBody } from "@/lib/services/repos"

export default function Home() {
  const [repoLink, setRepoLink] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestRoadmap, setLatestRoadmap] = useState<RoadmapResponseBody | null>(null)
  const [githubConnected, setGithubConnected] = useState(false)
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const [isCheckingGithub, setIsCheckingGithub] = useState(false)
  const { isSignedIn, getToken } = useAuth()
  const examples = useMemo(() => repoService.listExamples(3), [])

  useEffect(() => {
    let cancelled = false
    async function fetchStatus() {
      if (!isSignedIn || !getToken) {
        setGithubConnected(false)
        setGithubLogin(null)
        return
      }
      setIsCheckingGithub(true)
      try {
        const token = await getToken()
        const response = await githubService.status(token ?? undefined)
        if (!cancelled) {
          if (response.ok && response.data) {
            setGithubConnected(response.data.connected)
            setGithubLogin(response.data.github_login ?? null)
          } else {
            setGithubConnected(false)
            setGithubLogin(null)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setGithubConnected(false)
          setGithubLogin(null)
          console.error("Failed to check GitHub status", err)
        }
      } finally {
        if (!cancelled) {
          setIsCheckingGithub(false)
        }
      }
    }
    fetchStatus()
    return () => {
      cancelled = true
    }
  }, [getToken, isSignedIn])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = repoLink.trim()
    if (!value) return

    if (!isSignedIn) {
      console.warn("Sign in to generate personalized timelines.")
      return
    }

    if (!githubConnected) {
      setError("Connect GitHub before generating a roadmap.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    setLatestRoadmap(null)
    const token = getToken ? await getToken() : null
    const result = await repoService.generateRoadmap(value, token ?? undefined)
    setIsSubmitting(false)
    if (!result.ok && !result.skipped) {
      const message = result.error ?? "Unable to generate roadmap."
      console.error(message)
      setError(message)
      return
    }

    if (result.data) {
      setLatestRoadmap(result.data)
    }

    setRepoLink("")
  }

  const handleConnectGithub = async () => {
    if (!isSignedIn) return
    const token = (await getToken?.()) ?? undefined
    const response = await githubService.start(
      token,
      typeof window !== "undefined" ? `${window.location.origin}/oauth/github` : undefined
    )
    if (response.ok && response.data) {
      window.location.href = response.data.authorize_url
    } else if (response.error) {
      setError(response.error)
    }
  }

  return (
    <div className="relative flex flex-1 w-full items-center justify-center overflow-hidden px-6 py-12 lg:px-16">
      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-10 text-center py-16">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-primary/80">
            Repo-first learning
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Hey, builder. Ready to learn?
          </h1>
          <p className="text-lg">
            Drop a GitHub repo and we&apos;ll draft a roadmap that mirrors how the authors shipped it.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-3xl border border-border bg-card/70 p-6 shadow-2xl shadow-black/30"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              disabled={!isSignedIn || isSubmitting || !githubConnected}
              value={repoLink}
              onChange={(event) => setRepoLink(event.target.value)}
              placeholder="https://github.com/your-org/your-repo"
              className="flex-1 text-base"
            />
            <Button
              type="submit"
              size="lg"
              disabled={!isSignedIn || isSubmitting || !githubConnected}
              className="text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Generating..." : "Generate roadmap"}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive text-left">{error}</p>
          )}
          {!githubConnected && isSignedIn && (
            <div className="flex flex-col gap-3 text-left text-sm">
              <p className="text-muted-foreground">
                {isCheckingGithub
                  ? "Checking your GitHub connection..."
                  : "Connect GitHub to allow Commitly to read repository history."}
              </p>
              <Button type="button" variant="outline" onClick={handleConnectGithub} disabled={isCheckingGithub}>
                Connect GitHub
              </Button>
            </div>
          )}
          {githubConnected && githubLogin && (
            <p className="text-xs text-muted-foreground text-left">
              Connected as {githubLogin}
            </p>
          )}
        </form>

        {latestRoadmap && (
          <div className="space-y-4 rounded-3xl border border-border/80 bg-card/70 p-6 text-left">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-primary/70">
                Fresh timeline
              </p>
              <h3 className="mt-2 text-2xl font-semibold">
                {latestRoadmap.repo.full_name}
                {latestRoadmap.cached && (
                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                    Cached hit
                  </span>
                )}
              </h3>
              {latestRoadmap.repo.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {latestRoadmap.repo.description}
                </p>
              )}
            </div>
            <div className="space-y-3">
              {latestRoadmap.timeline.map((stage) => (
                <div
                  key={stage.id}
                  className="rounded-2xl border border-border/60 bg-background/80 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-primary/60">
                        {stage.id}
                      </p>
                      <h4 className="text-lg font-semibold">{stage.title}</h4>
                    </div>
                    <span className="text-sm text-muted-foreground">ETA {stage.eta}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{stage.summary}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                    {stage.tasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                  {stage.resources.length > 0 && (
                    <div className="mt-3 text-sm">
                      <span className="text-muted-foreground">Resources: </span>
                      {stage.resources.map((resource, index) => (
                        <span key={`${stage.id}-${resource.label}-${index}`}>
                          {index > 0 && <span className="text-muted-foreground"> · </span>}
                          <a
                            href={resource.href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {resource.label}
                          </a>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <p className="text-sm font-medium">Examples</p>
          <div className="flex flex-wrap justify-center gap-3">
            {examples.map((example) => (
              <Button key={example.id} variant="outline" className="gap-2" asChild>
                <Link href={`/repo/${example.id}/timeline`}>
                  {example.name}
                  <GitBranch className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
