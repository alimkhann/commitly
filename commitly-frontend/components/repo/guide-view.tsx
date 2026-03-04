"use client";

import { useAuth } from "@clerk/nextjs";
import {
  Check,
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
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import TabSwitch from "@/components/navigation/tab-switch";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatTree } from "@/lib/hooks/useChatTree";
import {
  type RepoIdentity,
  type RoadmapResponseBody,
  repoService,
} from "@/lib/services/repos";
import { normalizeTask } from "@/lib/roadmap/tasks";
import { cn } from "@/lib/utils";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

export default function GuideView() {
  const params = useParams();
  const repoId = params.repoId as string;
  const searchParams = useSearchParams();
  const { isSignedIn, getToken } = useAuth();
  const { language, t } = usePreferences();
  const { getBySlug, yourRepos, upsertRoadmap } = useRoadmapCatalog();

  const cachedRecord = getBySlug(repoId);
  const fullNameParam = searchParams?.get("fullName") ?? null;
  const repoUrlParam = searchParams?.get("repoUrl") ?? null;
  const identity: RepoIdentity | null = useMemo(() => {
    if (cachedRecord && "owner" in cachedRecord) {
      return {
        owner: cachedRecord.owner,
        repoName: cachedRecord.repoName,
        fullName: cachedRecord.fullName,
        slug: cachedRecord.slug,
      };
    }
    return (
      repoService.parseRepoInput(fullNameParam ?? "") ??
      repoService.parseRepoInput(repoUrlParam ?? "") ??
      (() => {
        const parts = repoId.split("-");
        if (parts.length >= 2) {
          const owner = parts[0];
          const repoName = parts.slice(1).join("-");
          return {
            owner,
            repoName,
            fullName: `${owner}/${repoName}`,
            slug: repoId,
          };
        }
        return null;
      })()
    );
  }, [cachedRecord, fullNameParam, repoId, repoUrlParam]);
  const [fetchedRoadmap, setFetchedRoadmap] = useState<RoadmapResponseBody | null>(
    cachedRecord && "repo" in cachedRecord
      ? (cachedRecord as RoadmapResponseBody)
      : null
  );
  const [translatedStage, setTranslatedStage] = useState<{
    stage_id: string;
    title: string;
    summary: string;
    goals: string[];
    prerequisites: string[];
    checkpoints: string[];
    tasks: Array<{
      label: string;
      steps: string[];
      files?: string[];
      commands?: string[];
    }>;
  } | null>(null);
  const [guideLoadError, setGuideLoadError] = useState<string | null>(null);
  const roadmap = useMemo(
    () =>
      (cachedRecord && "repo" in cachedRecord
        ? (cachedRecord as RoadmapResponseBody)
        : null) ?? fetchedRoadmap,
    [cachedRecord, fetchedRoadmap]
  );

  useEffect(() => {
    if (!identity || roadmap) {
      return;
    }
    let cancelled = false;
    const loadRoadmap = async () => {
      const response = await repoService.getCachedRoadmap(
        identity.owner,
        identity.repoName
      );
      if (cancelled) {
        return;
      }
      if (response.ok && response.data) {
        setFetchedRoadmap(response.data);
        upsertRoadmap(response.data);
        setGuideLoadError(null);
      } else if (!response.ok) {
        setGuideLoadError(
          response.error ?? t("guide_load_error", "Unable to load guide data.")
        );
      }
    };
    loadRoadmap();
    return () => {
      cancelled = true;
    };
  }, [identity, roadmap, t, upsertRoadmap]);

  const activeData = useMemo(() => {
    if (roadmap && identity) {
      return {
        identity: {
          owner: identity.owner,
          repoName: identity.repoName,
        },
        name: roadmap.repo.full_name,
        timeline: roadmap.timeline,
        guideThread: [] as Array<{
          id: string;
          role: "user" | "guide";
          message: string;
        }>,
      };
    }
    return null;
  }, [identity, roadmap]);

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

  useEffect(() => {
    if (!(activeData && stageContext && language !== "en")) {
      return;
    }

    let cancelled = false;
    const translateStage = async () => {
      const token = isSignedIn ? (await getToken?.()) ?? undefined : undefined;
      const response = await repoService.translateStages(
        {
          repo_full_name: activeData.name,
          target_language: language,
          stage_ids: [stageContext.id],
        },
        token
      );
      if (cancelled || !(response.ok && response.data?.translated.length)) {
        return;
      }
      const translated = response.data.translated[0];
      setTranslatedStage({
        stage_id: translated.stage_id,
        title: translated.title,
        summary: translated.summary,
        goals: translated.goals,
        prerequisites: translated.prerequisites,
        checkpoints: translated.checkpoints,
        tasks: translated.tasks,
      });
    };

    void translateStage();
    return () => {
      cancelled = true;
    };
  }, [activeData, getToken, isSignedIn, language, stageContext]);

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const markdownComponents = useMemo<Components>(
    () => ({
      a: (props) => (
        <a
          {...props}
          className="font-medium text-primary hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        />
      ),
    }),
    []
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getRequestOptions = async () => {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return {
      headers,
      body: {
        repo_full_name: `${activeData?.identity.owner}/${activeData?.identity.repoName}`,
        stage_id: stageId ?? undefined,
        preferred_language: language,
      },
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="font-medium text-sm">{t("guide", "Guide")}</p>
        <p className="text-muted-foreground text-sm">
          {guideLoadError ?? t("guide_loading", "Loading guide...")}
        </p>
      </div>
    );
  }

  const hasStage = Boolean(stageContext);
  const displayStageContext = (() => {
    if (!stageContext) {
      return null;
    }
    if (!(translatedStage && translatedStage.stage_id === stageContext.id)) {
      return stageContext;
    }
    return {
      ...stageContext,
      title: translatedStage.title || stageContext.title,
      summary: translatedStage.summary || stageContext.summary,
      goals: translatedStage.goals?.length ? translatedStage.goals : stageContext.goals,
      prerequisites: translatedStage.prerequisites?.length
        ? translatedStage.prerequisites
        : stageContext.prerequisites,
      checkpoints: translatedStage.checkpoints?.length
        ? translatedStage.checkpoints
        : stageContext.checkpoints,
      tasks: translatedStage.tasks?.length ? translatedStage.tasks : stageContext.tasks,
    };
  })();

  const renderChatInterface = () => (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-2xl border border-border/70 border-dashed bg-card p-8">
              <p className="text-muted-foreground text-sm">
                {t(
                  "guide_empty_state",
                  "No guide activity yet. Ask for a walkthrough to start the conversation."
                )}
              </p>
            </div>
          </div>
        ) : (
          messages.map((messageItem) => {
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
              <div className="group mb-6 flex flex-col gap-2" key={messageItem.id}>
                {messageItem.role !== "user" ? (
                  <article className="max-w-3xl space-y-4 text-base text-foreground leading-7">
                    <div className="prose prose-invert max-w-none prose-pre:border prose-pre:border-border/50 prose-pre:bg-muted/50 prose-p:leading-relaxed">
                      <Markdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
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
                      <div className="flex w-full flex-col gap-2 rounded-3xl bg-muted p-2 shadow-sm">
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
                            {t("cancel", "Cancel")}
                          </Button>
                          <Button
                            onClick={() => handleEditSubmit(messageItem.id)}
                            size="sm"
                          >
                            {t("save_submit", "Save & submit")}
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
            <div className="h-2 w-2 rounded-full bg-current" />
            <div className="h-2 w-2 rounded-full bg-current" />
            <div className="h-2 w-2 rounded-full bg-current" />
            <span>{t("thinking", "Thinking...")}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 pb-4">
        <form
          className="flex w-full items-end gap-3 rounded-3xl border border-border/70 bg-card p-2"
          onSubmit={handleSubmit}
        >
          <Textarea
            className="max-h-40 min-h-[44px] flex-1 resize-none border-none bg-transparent px-4 py-3 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isSignedIn || isLoading}
            onChange={handleInputChange}
            placeholder={
              isSignedIn
                ? t(
                  "guide_input_placeholder",
                  "Ask for context, code walkthroughs, or compare approaches..."
                )
                : t(
                  "guide_signin_placeholder",
                  "Sign in to start working with the AI guide."
                )
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

  if (hasStage && displayStageContext) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-card px-6 py-3">
          <div className="space-y-0.5">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
              {t("guide", "Guide")}
            </p>
            <h1 className="font-semibold text-sm">{activeData.name}</h1>
          </div>
          <TabSwitch repoId={repoId} />
        </div>
        <PanelGroup direction="horizontal" className="flex-1">
          <Panel defaultSize={60} minSize={30}>
            {renderChatInterface()}
          </Panel>
          <PanelResizeHandle className="w-px bg-border/10 hover:bg-border/50 transition-colors" />
          <Panel defaultSize={40} minSize={20} className="bg-card">
            <div className="h-full overflow-y-auto p-6">
              <div className="space-y-8">
                <div>
                  <Badge variant="outline" className="mb-3">
                    {t("stage_context", "Stage context")}
                  </Badge>
                  <h2 className="font-semibold text-2xl">{displayStageContext.title}</h2>
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    {displayStageContext.summary}
                  </p>
                </div>

                {displayStageContext.goals?.length ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("goals", "Goals")}
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {displayStageContext.goals.map((goal: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                          <span>{goal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {displayStageContext.tasks?.length ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("tasks", "Tasks")}
                    </p>
                    <div className="space-y-3">
                      {displayStageContext.tasks.map((rawTask: unknown, idx: number) => {
                        const task = normalizeTask(rawTask, idx);
                        return (
                          <div
                            key={idx}
                            className="rounded-xl border border-border/70 bg-background p-4"
                          >
                            <p className="font-medium text-sm">{task.label}</p>
                            {task.steps.length > 0 && (
                              <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                                {task.steps.map((step, stepIndex) => (
                                  <li className="flex items-start gap-2" key={stepIndex}>
                                    <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                            )}
                            {task.files.length > 0 && (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {task.files.map((filePath) => (
                                  <code
                                    className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                                    key={filePath}
                                  >
                                    {filePath}
                                  </code>
                                ))}
                              </div>
                            )}
                            {task.commands.length > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {task.commands.map((command) => (
                                  <code
                                    className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                                    key={command}
                                  >
                                    {command}
                                  </code>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <Button asChild variant="outline" className="w-full">
                  <Link
                    href={`/repo/${repoId}?view=timeline&fullName=${encodeURIComponent(
                      activeData.name
                    )}#${displayStageContext.id}`}
                  >
                    {t("view_full_stage_details", "View full stage details")}
                  </Link>
                </Button>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden px-6 pt-10 pb-4 lg:px-12">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">{t("guide", "Guide")}</p>
          <h1 className="font-semibold text-2xl">{activeData.name}</h1>
        </div>
        <TabSwitch repoId={repoId} />
      </div>

      <div className="mt-2 flex flex-1 flex-col min-h-0 w-full items-center">
        <div className="flex w-full max-w-3xl flex-1 flex-col overflow-hidden">
          {renderChatInterface()}
        </div>
      </div>
    </div>
  );
}
