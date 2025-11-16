"use client";

import { useAuth } from "@clerk/nextjs";
import {
  Copy,
  Edit2,
  SendHorizontal,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import TabSwitch from "@/components/navigation/tab-switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { repoService } from "@/lib/services/repos";

export default function RepoGuidePage() {
  const params = useParams();
  const repoId = params.repoId as string;
  const { isSignedIn } = useAuth();
  const repo = repoService.findById(repoId);
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const thread = useMemo(
    () => (isSignedIn ? (repo?.guideThread ?? []) : []),
    [repo, isSignedIn]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSignedIn) {
      return;
    }
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  if (!repo) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col px-6 pt-10 pb-4 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Guide</p>
          <h1 className="font-semibold text-2xl">{repo.name}</h1>
        </div>
        <TabSwitch repoId={repoId} />
      </div>

      <div className="mt-8 flex flex-1 flex-col items-center">
        <div className="mt-6 flex w-full max-w-3xl flex-1 flex-col justify-end gap-5 overflow-y-auto pb-6">
          {thread.length === 0 ? (
            <div className="rounded-2xl border border-border/60 border-dashed bg-card/40 p-6 text-center text-muted-foreground text-sm">
              No guide activity yet. Ask for a walkthrough to start the
              conversation.
            </div>
          ) : (
            [...thread].reverse().map((messageItem) => (
              <div className="group flex flex-col gap-1" key={messageItem.id}>
                {messageItem.role === "guide" ? (
                  <article className="space-y-4 text-base text-foreground leading-7">
                    <div className="prose prose-invert max-w-none">
                      {messageItem.message.split("\n").map((paragraph, idx) => (
                        <p
                          key={`${messageItem.id}-${idx}-${paragraph.slice(0, 8)}`}
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="rounded-full border border-border/60 px-2 py-1 hover:border-border"
                        type="button"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded-full border border-border/60 px-2 py-1 hover:border-border"
                        type="button"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded-full border border-border/60 px-2 py-1 hover:border-border"
                        type="button"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                ) : (
                  <div className="group ml-auto flex max-w-[65%] flex-col items-end gap-1">
                    <p className="rounded-3xl bg-primary px-4 py-3 text-base text-primary-foreground leading-relaxed shadow-sm">
                      {messageItem.message}
                    </p>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="rounded-full border border-border/60 px-2 py-1 hover:border-border"
                        type="button"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded-full border border-border/60 px-2 py-1 hover:border-border"
                        type="button"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        className="sticky bottom-0 mt-auto flex w-full max-w-4xl items-end gap-3 self-center rounded-full border border-border/60 bg-card/80 px-4 py-2 shadow-2xl"
        onSubmit={handleSubmit}
      >
        <Textarea
          className="max-h-40 min-h-[48px] flex-1 resize-none border-none bg-transparent focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isSignedIn}
          onChange={handleInputChange}
          placeholder={
            isSignedIn
              ? "Ask for context, code walkthroughs, or compare approaches..."
              : "Sign in to start working with the AI guide."
          }
          ref={textareaRef}
          rows={1}
          value={message}
        />
        <Button
          className="rounded-full"
          disabled={!isSignedIn}
          size="icon"
          type="submit"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
