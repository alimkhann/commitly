"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Filter, GitBranch, Search } from "lucide-react"

import { repoService } from "@/lib/services/repos"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [difficulty, setDifficulty] = useState<"all" | "beginner" | "intermediate" | "advanced">("all")
  const repoList = useMemo(() => repoService.list(), [])

  const filteredRepos = useMemo(() => {
    return repoList.filter((repo) => {
      const matchesQuery =
        repo.name.toLowerCase().includes(query.toLowerCase()) ||
        repo.description.toLowerCase().includes(query.toLowerCase())
      const matchesDifficulty =
        difficulty === "all" || repo.difficulty === difficulty
      return matchesQuery && matchesDifficulty
    })
  }, [query, difficulty, repoList])

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-10 lg:px-16">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">
          Repo directory
        </p>
        <h1 className="text-3xl font-semibold">Search synced repositories</h1>
        <p className="text-base text-muted-foreground">
          Filter by difficulty, language, or keywords to jump into an existing timeline.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-xl shadow-black/25 backdrop-blur-lg">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="deepseek, ncnn, microsoft/vscode..."
              className="border-0 bg-transparent text-base focus-visible:ring-0"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "beginner", "intermediate", "advanced"] as const).map(
              (level) => (
                <Button
                  key={level}
                  variant={difficulty === level ? "secondary" : "ghost"}
                  className="capitalize"
                  onClick={() => setDifficulty(level)}
                >
                  {level}
                </Button>
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Showing {filteredRepos.length} repositories
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredRepos.map((repo) => (
          <Card
            key={repo.id}
            className="flex flex-col border-border/60 bg-card/70 shadow-lg shadow-black/20"
          >
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-xl">{repo.name}</CardTitle>
                <Badge variant="outline" className="text-xs uppercase tracking-wide">
                  {repo.difficulty}
                </Badge>
              </div>
              <CardDescription>{repo.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                <span>
                  {repo.language} • {repo.updatedAt}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {repo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted/40 px-3 py-1 text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Button className="w-full" variant="secondary" asChild>
                <Link href={`/repo/${repo.id}/timeline`}>Open timeline</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
