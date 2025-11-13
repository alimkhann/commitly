"use client"

import Link from "next/link"
import { FormEvent, useMemo, useState } from "react"
import { GitBranch } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { repoService } from "@/lib/services/repos"

export default function Home() {
  const [repoLink, setRepoLink] = useState("")
  const examples = useMemo(() => repoService.listExamples(3), [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = repoLink.trim()
    if (!value) return

    const result = await repoService.queueImport(value)
    if (!result.ok && !result.skipped) {
      console.error(result.error ?? "Unable to queue repository import.")
    }

    setRepoLink("")
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
              value={repoLink}
              onChange={(event) => setRepoLink(event.target.value)}
              placeholder="https://github.com/your-org/your-repo"
              className="flex-1 text-base"
            />
            <Button type="submit" size="lg" className="text-base font-semibold">
              Generate roadmap
            </Button>
          </div>
        </form>

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
