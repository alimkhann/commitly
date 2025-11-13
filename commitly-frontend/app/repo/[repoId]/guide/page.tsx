"use client"

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Copy, Edit2, SendHorizontal, ThumbsDown, ThumbsUp } from "lucide-react"

import { repoService } from "@/lib/services/repos"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import TabSwitch from "@/components/navigation/tab-switch"

export default function RepoGuidePage() {
  const params = useParams()
  const repoId = params.repoId as string
  const repo = repoService.findById(repoId)
  const [message, setMessage] = useState("")
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const thread = useMemo(() => repo?.guideThread ?? [], [repo])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [thread])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  if (!repo) {
    return null
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-4 pt-10 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Guide</p>
          <h1 className="text-2xl font-semibold">{repo.name}</h1>
        </div>
        <TabSwitch repoId={repoId} />
      </div>

      <div className="mt-8 flex flex-1 flex-col items-center">
        <div className="mt-6 flex w-full max-w-3xl flex-1 flex-col justify-end gap-5 overflow-y-auto pb-6">
          {[...thread].reverse().map((messageItem) => (
            <div
              key={messageItem.id}
              className="flex flex-col gap-1 group"
            >
              {messageItem.role === "guide" ? (
                <article className="space-y-4 text-base leading-7 text-foreground">
                  <div className="prose prose-invert max-w-none">
                    {messageItem.message.split("\n").map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    <button className="rounded-full border border-border/60 px-2 py-1 hover:border-border">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button className="rounded-full border border-border/60 px-2 py-1 hover:border-border">
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button className="rounded-full border border-border/60 px-2 py-1 hover:border-border">
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ) : (
                <div className="group ml-auto flex max-w-[65%] flex-col items-end gap-1">
                  <p className="rounded-3xl bg-primary px-4 py-3 text-base leading-relaxed text-primary-foreground shadow-sm">
                    {messageItem.message}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    <button className="rounded-full border border-border/60 px-2 py-1 hover:border-border">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button className="rounded-full border border-border/60 px-2 py-1 hover:border-border">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 mt-auto flex w-full max-w-4xl items-end gap-3 self-center rounded-full border border-border/60 bg-card/80 px-4 py-2 shadow-2xl"
      >
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          rows={1}
          placeholder="Ask for context, code walkthroughs, or compare approaches..."
          className="min-h-[48px] max-h-40 flex-1 resize-none border-none bg-transparent focus-visible:ring-0"
        />
        <Button type="submit" size="icon" className="rounded-full">
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
