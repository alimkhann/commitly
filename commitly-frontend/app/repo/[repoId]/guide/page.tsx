"use client";

import { useAuth } from "@clerk/nextjs";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  useCallback,
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
import { useChatTree } from "@/lib/hooks/useChatTree";
import { cn } from "@/lib/utils";

export default function RepoGuidePage() {
  const params = useParams();
  const repoId = params.repoId as string;
  const searchParams = useSearchParams();
  const { isSignedIn, getToken } = useAuth();
  const { getBySlug, yourRepos } = useRoadmapCatalog();

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

  const isSynced = useMemo(() => {
    if (!activeData) return false;
    return yourRepos.some((r) => r.repo_full_name === activeData.name);
  }, [activeData, yourRepos]);

  const stageId = searchParams?.get("stage");

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, [getToken]);

  const stageContext = useMemo(() => {
    if (!(activeData && stageId)) {
      return null;
    }
    return activeData.timeline.find((stage) => stage.id === stageId) ?? null;
  }, [activeData, stageId]);

  const {
    messages,
    treeState,
    sendMessage,
    editMessage,
    navigateBranch,
    isLoading,
    input,
    setInput,
    setFeedback,
  } = useChatTree({
    api: "/api/chat",
    historyApi: "/api/chat/history",
    repo_full_name: activeData?.name ?? repoId,
    stage_id: stageId ?? null,
    authHeaders,
    persistEnabled: isSynced,
  });

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isStageOpen, setIsStageOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getRequestOptions = async () => {
    const token = await getToken();
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: {
        repo_full_name: `${activeData?.identity.owner}/${activeData?.identity.repoName}`,
        stage_id: stageId ?? undefined,
      },
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("[GuidePage] submit", {
      isSignedIn,
      inputLength: input.trim().length,
      isLoading,
      hasActiveData: !!activeData,
    });
    if (!(isSignedIn && input.trim()) || isLoading || !activeData) {
      return;
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const options = await getRequestOptions();
    await sendMessage(input, options);
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleEditStart = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditContent(currentContent);
  };

  const handleEditSubmit = async (messageId: string) => {
    if (!editContent.trim()) return;
    setEditingMessageId(null);
    const options = await getRequestOptions();
    await editMessage(messageId, editContent, options);
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!activeData) {
    return null;
  }

  const hasStage = Boolean(stageContext);

  return (
    <div className="flex flex-1 flex-col px-6 pt-10 pb-4 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Guide</p>
          <h1 className="font-semibold text-2xl">{activeData.name}</h1>
        </div>
        <TabSwitch repoId={repoId} />
      </div>

      <div
        className={
          hasStage
            ? "mt-8 grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_auto]"
            : "mt-8 flex w-full flex-col"
        }
      >
        <div className="flex flex-col items-center">
          {stageContext && (
            <div className="mb-6 w-full max-w-3xl space-y-6 rounded-3xl border border-border/50 bg-card/70 p-6 shadow-inner lg:hidden">
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
            </div>
          )}
          <div className="mt-0 flex w-full max-w-3xl flex-1 flex-col justify-end gap-5 overflow-y-auto pb-6">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-border/60 border-dashed bg-card/40 p-6 text-center text-muted-foreground text-sm">
                No guide activity yet. Ask for a walkthrough to start the
                conversation.
              </div>
            ) : (
              (messages as any[]).map((messageItem) => {
                const node = treeState.messages[messageItem.id];
                let siblings: string[] = [];
                if (node?.parentId) {
                  const parent = treeState.messages[node.parentId];
                  if (parent) siblings = parent.childrenIds;
                } else if (node) {
                  siblings = treeState.rootIds || [];
                }

                const siblingCount = siblings.length;
                const currentSiblingIndex = siblings.indexOf(messageItem.id);

                return (
                  <div className="group flex flex-col gap-1" key={messageItem.id}>
                    {messageItem.role !== "user" ? (
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
                            {messageItem.content}
                          </Markdown>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            className="rounded-full border border-border/60 px-2 py-1 hover:border-border"
                            type="button"
                            onClick={() => handleCopy(messageItem.content, messageItem.id)}
                          >
                            {copiedId === messageItem.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            className={`rounded-full border px-2 py-1 hover:border-border ${messageItem.feedback === "up" ? "bg-primary/10 border-primary text-primary" : "border-border/60"}`}
                            type="button"
                            onClick={() => setFeedback(messageItem.id, "up")}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className={`rounded-full border px-2 py-1 hover:border-border ${messageItem.feedback === "down" ? "bg-destructive/10 border-destructive text-destructive" : "border-border/60"}`}
                            type="button"
                            onClick={() => setFeedback(messageItem.id, "down")}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </article>
                    ) : (
                      <div
                        className={cn(
                          "group flex flex-col gap-1",
                          editingMessageId === messageItem.id
                            ? "w-full"
                            : "ml-auto max-w-[85%] items-end"
                        )}
                      >
                        {editingMessageId === messageItem.id ? (
                          <div className="flex w-full flex-col gap-2 rounded-3xl bg-card p-2 shadow-sm">
                            <Textarea
                              className="min-h-[60px] resize-none border-none bg-transparent focus-visible:ring-0"
                              onChange={(e) => setEditContent(e.target.value)}
                              value={editContent}
                            />
                            <div className="flex justify-end gap-2 px-2 pb-1">
                              <Button
                                onClick={() => setEditingMessageId(null)}
                                size="sm"
                                variant="ghost"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleEditSubmit(messageItem.id)}
                                size="sm"
                              >
                                Save & Submit
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              {siblingCount > 1 && (
                                <div className="flex items-center gap-1 text-muted-foreground text-xs font-medium select-none">
                                  <button
                                    className="p-1 hover:text-foreground disabled:opacity-30 transition-colors"
                                    disabled={currentSiblingIndex === 0}
                                    onClick={() =>
                                      navigateBranch(messageItem.id, "prev")
                                    }
                                  >
                                    <ChevronLeft className="h-3 w-3" />
                                  </button>
                                  <span className="min-w-[2rem] text-center">
                                    {currentSiblingIndex + 1} / {siblingCount}
                                  </span>
                                  <button
                                    className="p-1 hover:text-foreground disabled:opacity-30 transition-colors"
                                    disabled={
                                      currentSiblingIndex === siblingCount - 1
                                    }
                                    onClick={() =>
                                      navigateBranch(messageItem.id, "next")
                                    }
                                  >
                                    <ChevronRight className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                              <p className="rounded-3xl bg-primary px-4 py-3 text-base text-primary-foreground leading-relaxed shadow-sm">
                                {messageItem.content}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                className="rounded-full border border-border/60 px-2 py-1 hover:border-border"
                                type="button"
                                onClick={() =>
                                  handleCopy(messageItem.content, messageItem.id)
                                }
                              >
                                {copiedId === messageItem.id ? (
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                className="rounded-full border border-border/60 px-2 py-1 hover:border-border"
                                onClick={() =>
                                  handleEditStart(
                                    messageItem.id,
                                    messageItem.content
                                  )
                                }
                                type="button"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
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

      {stageContext && (
        <aside className="hidden lg:block">
            <Collapsible
              className={`sticky top-20 overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-inner transition-all duration-200 ${
                isStageOpen ? "w-[360px] p-5" : "w-12 p-2"
              }`}
              open={isStageOpen}
              onOpenChange={setIsStageOpen}
            >
              <div className="flex items-start justify-between gap-3">
                {isStageOpen ? (
                  <div className="space-y-1">
                    <Badge variant="outline">Stage</Badge>
                    <div>
                      <p className="font-semibold text-lg">{stageContext.title}</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {stageContext.summary}
                      </p>
                    </div>
                  </div>
                ) : null}

                <CollapsibleTrigger className="rounded-full border border-border/60 p-2 text-muted-foreground hover:text-foreground">
                  {isStageOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="space-y-4 pt-4">
                {stageContext.goals?.length ? (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Goals</p>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {stageContext.goals.map((goal: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/80" />
                          <span>{goal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {stageContext.tasks?.length ? (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tasks</p>
                    <div className="space-y-2">
                      {stageContext.tasks.map((task: any, idx: number) => (
                        <div key={idx} className="rounded-xl border border-border/50 bg-background/60 p-3">
                          <p className="text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.description}</p>
                          {task.file_path && (
                            <p className="mt-2 text-[11px] text-muted-foreground">File: {task.file_path}</p>
                          )}
                          {task.code_snippet && (
                            <code className="mt-2 block rounded bg-muted/50 px-2 py-1 text-[10px] text-foreground">
                              $ {task.code_snippet}
                            </code>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {stageContext.resources?.length ? (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Resources</p>
                    <div className="flex flex-wrap gap-2">
                      {stageContext.resources.map((resource: { label: string; href: string }) => (
                        <a
                          key={resource.label}
                          href={resource.href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {resource.label}
                          <span className="opacity-60">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <Button asChild size="sm" variant="secondary" className="w-full justify-between">
                  <Link href={`/repo/${repoId}/timeline#${stageContext.id}`}>
                    View full stage
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </aside>
        )}
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
            value={input}
          />
          <Button
            className="mr-0.5 mb-0.5 h-11 w-11 shrink-0 rounded-full"
            disabled={!isSignedIn || isLoading || !input.trim()}
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
