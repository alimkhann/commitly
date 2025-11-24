"use client";

import { useAuth } from "@clerk/nextjs";
import {
  ChevronDown,
  Copy,
  Edit2,
  SendHorizontal,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TabSwitch from "@/components/navigation/tab-switch";
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { repoService } from "@/lib/services/repos";

export default function RepoGuidePage() {
  const params = useParams();
  const repoId = params.repoId as string;
  const searchParams = useSearchParams();
  const { isSignedIn, getToken } = useAuth();
  const { getBySlug } = useRoadmapCatalog();

  const cachedRecord = getBySlug(repoId);

  const activeData = useMemo(() => {
    if (cachedRecord && "repo" in cachedRecord) {
      return {
        identity: {
          owner: cachedRecord.owner,
          repoName: cachedRecord.repoName,
        },
        name: cachedRecord.repo.full_name,
        timeline: cachedRecord.timeline,
        guideThread: [] as Array<{
          id: string;
          role: "user" | "guide";
          message: string;
        }>,
      };
    }
    return null;
  }, [cachedRecord]);

  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<
    Array<{ id: string; role: "user" | "guide"; message: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Initialize chat history from static data if available and empty
  useEffect(() => {
    if (
      activeData?.guideThread &&
      chatHistory.length === 0 &&
      activeData.guideThread.length > 0
    ) {
      setChatHistory(
        activeData.guideThread.map((item) => ({
          ...item,
          role: item.role as "user" | "guide",
        }))
      );
    }
  }, [activeData, chatHistory.length]);

  const stageId = searchParams?.get("stage");

  const stageContext = useMemo(() => {
    if (!(activeData && stageId)) {
      return null;
    }
    return activeData.timeline.find((stage) => stage.id === stageId) ?? null;
  }, [activeData, stageId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(isSignedIn && message.trim()) || isLoading || !activeData) {
      return;
    }

    const userMsg = message.trim();
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const newHistory = [
      ...chatHistory,
      { id: Date.now().toString(), role: "user" as const, message: userMsg },
    ];
    setChatHistory(newHistory);
    setIsLoading(true);

    try {
      const token = await getToken();
      const response = await repoService.chat(
        activeData.identity.owner,
        activeData.identity.repoName,
        userMsg,
        stageId ?? undefined,
        token ?? undefined
      );

      if (response.ok && response.data) {
        setChatHistory((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "guide",
            message: response.data!.response,
          },
        ]);
      } else {
        // Fallback error message
        setChatHistory((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "guide",
            message: "Sorry, I encountered an error. Please try again.",
          },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "guide",
          message: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  if (!activeData) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col px-6 pt-10 pb-4 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Guide</p>
          <h1 className="font-semibold text-2xl">{activeData.name}</h1>
        </div>
        <TabSwitch repoId={repoId} />
      </div>

      <div className="mt-8 flex flex-1 flex-col items-center">
        {stageContext && (
          <div className="mb-6 w-full max-w-3xl space-y-6 rounded-3xl border border-border/50 bg-card/70 p-6 shadow-inner">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <Badge variant="outline">Timeline context</Badge>
                <div>
                  <p className="font-semibold text-lg">{stageContext.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {stageContext.summary}
                  </p>
                </div>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/repo/${repoId}/timeline#${stageContext.id}`}>
                  Back to stage
                </Link>
              </Button>
            </div>

            {/* Goals Section */}
            {stageContext.goals && stageContext.goals.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-[11px] text-muted-foreground uppercase tracking-widest">
                    Goals
                  </h4>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <ul className="space-y-2">
                  {stageContext.goals.map((goal: string, idx: number) => (
                    <li
                      className="flex items-start gap-2.5 text-muted-foreground text-sm"
                      key={idx}
                    >
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tasks Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-[11px] text-muted-foreground uppercase tracking-widest">
                  {isSignedIn ? "Tasks" : "Tasks · Sign in to start"}
                </h4>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              <div className="space-y-3">
                {stageContext.tasks.map((task, idx) => (
                  <div
                    className="rounded-lg border border-border/50 bg-background/40 p-3.5 transition-colors hover:bg-background/60"
                    key={idx}
                  >
                    <p className="font-medium text-foreground text-sm">
                      {task.title}
                    </p>
                    <div className="mt-2.5 space-y-1.5">
                      <p className="text-muted-foreground text-xs">
                        {task.description}
                      </p>
                    </div>
                    {task.file_path && (
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground/80">
                          File:
                        </span>
                        {task.file_path}
                      </div>
                    )}
                    {task.code_snippet && (
                      <div className="mt-2.5 space-y-1">
                        <div className="w-fit rounded bg-muted/50 px-2 py-1 font-mono text-[10px] text-foreground/90">
                          $ {task.code_snippet}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Code Examples Section */}
            {stageContext.code_examples &&
              stageContext.code_examples.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[11px] text-muted-foreground uppercase tracking-widest">
                      Code Examples
                    </h4>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  <div className="space-y-3">
                    {stageContext.code_examples.map((example: any, idx: number) => (
                      <Collapsible className="group/code" key={idx}>
                        <div className="rounded-lg border border-border/50 bg-muted/30">
                          <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium font-mono text-xs">
                                  {example.file}
                                </span>
                                <Badge
                                  className="h-4 px-1 text-[9px]"
                                  variant="outline"
                                >
                                  {example.language}
                                </Badge>
                              </div>
                              <p className="line-clamp-1 text-[11px] text-muted-foreground">
                                {example.description}
                              </p>
                            </div>
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]/code:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-border/50 border-t p-3 pt-0">
                              <p className="mb-2 text-[11px] text-muted-foreground">
                                {example.description}
                              </p>
                              <pre className="overflow-x-auto rounded-md bg-background p-3 font-mono text-[10px] leading-relaxed">
                                <code>{example.snippet}</code>
                              </pre>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}

            {/* Resources Section */}
            {stageContext.resources.length > 0 && (
              <div className="pt-2">
                <div className="flex flex-wrap gap-2">
                  {stageContext.resources.map((resource: { label: string; href: string }) => (
                    <a
                      className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      href={resource.href}
                      key={resource.label}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span>{resource.label}</span>
                      <span className="opacity-50">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="mt-6 flex w-full max-w-3xl flex-1 flex-col justify-end gap-5 overflow-y-auto pb-6">
          {chatHistory.length === 0 ? (
            <div className="rounded-2xl border border-border/60 border-dashed bg-card/40 p-6 text-center text-muted-foreground text-sm">
              No guide activity yet. Ask for a walkthrough to start the
              conversation.
            </div>
          ) : (
            chatHistory.map((messageItem) => (
              <div className="group flex flex-col gap-1" key={messageItem.id}>
                {messageItem.role === "guide" ? (
                  <article className="space-y-4 text-base text-foreground leading-7">
                    <div className="prose prose-invert max-w-none prose-pre:border prose-pre:border-border/50 prose-pre:bg-muted/50 prose-p:leading-relaxed">
                      <Markdown
                        components={{
                          a: ({ node, ...props }) => (
                            <a
                              {...(props as any)}
                              className="font-medium text-primary hover:underline"
                              rel="noopener noreferrer"
                              target="_blank"
                            />
                          ),
                        }}
                        remarkPlugins={[remarkGfm]}
                      >
                        {messageItem.message}
                      </Markdown>
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
                  <div className="group ml-auto flex max-w-[85%] flex-col items-end gap-1">
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
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="h-2 w-2 animate-bounce rounded-full bg-current" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:0.2s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:0.4s]" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="sticky bottom-6 mt-auto flex w-full justify-center px-4">
        <form
          className="flex w-full max-w-4xl items-end gap-3 rounded-3xl border border-border/60 bg-card/80 p-2 shadow-2xl backdrop-blur-md"
          onSubmit={handleSubmit}
        >
          <Textarea
            className="max-h-40 min-h-[44px] flex-1 resize-none border-none bg-transparent px-4 py-3 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isSignedIn || isLoading}
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
            className="mr-0.5 mb-0.5 h-11 w-11 shrink-0 rounded-full"
            disabled={!isSignedIn || isLoading || !message.trim()}
            size="icon"
            type="submit"
          >
            <SendHorizontal className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
