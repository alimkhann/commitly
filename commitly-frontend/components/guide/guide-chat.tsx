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
import { useParams, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRoadmapCatalog } from "@/components/providers/roadmap-catalog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatTree } from "@/lib/hooks/useChatTree";
import { cn } from "@/lib/utils";

export default function GuideChat() {
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
      },
    };
  };

  const submitCurrentInput = async () => {
    if (!(isSignedIn && input.trim()) || isLoading || !activeData) {
      return;
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const options = await getRequestOptions();
    await sendMessage(input, options);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitCurrentInput();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitCurrentInput();
    }
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
      <div className="flex h-full items-center justify-center p-4 text-center text-muted-foreground text-sm">
        Select a repository to start chatting.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {stageContext && (
        <div className="border-b border-white/10 bg-card/30 p-4">
          <div className="space-y-2">
            <Badge variant="outline">Context: {stageContext.title}</Badge>
            <p className="line-clamp-2 text-muted-foreground text-xs">
              {stageContext.summary}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-6">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-muted-foreground text-sm">
              Ask for a walkthrough or context about this stage.
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
                <div className="group flex flex-col gap-2" key={messageItem.id}>
                  {messageItem.role !== "user" ? (
                    <div className="flex flex-col gap-2">
                      <div className="prose prose-invert max-w-none text-sm prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
                        <Markdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                          {messageItem.content}
                        </Markdown>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopy(messageItem.content, messageItem.id)}
                        >
                          {copiedId === messageItem.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-6 w-6", messageItem.feedback === "up" && "text-primary")}
                          onClick={() => setFeedback(messageItem.id, "up")}
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-6 w-6", messageItem.feedback === "down" && "text-destructive")}
                          onClick={() => setFeedback(messageItem.id, "down")}
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="ml-auto max-w-[85%]">
                      {editingMessageId === messageItem.id ? (
                        <div className="flex flex-col gap-2 rounded-xl bg-card p-2 shadow-sm">
                          <Textarea
                            className="min-h-[60px] resize-none border-none bg-transparent focus-visible:ring-0"
                            onChange={(e) => setEditContent(e.target.value)}
                            value={editContent}
                          />
                          <div className="flex justify-end gap-2">
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
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="group/user relative">
                          <div className="rounded-2xl bg-primary px-4 py-2 text-primary-foreground text-sm shadow-sm">
                            {messageItem.content}
                          </div>
                          <div className="absolute -bottom-6 right-0 flex items-center gap-1 opacity-0 transition-opacity group-hover/user:opacity-100">
                            {siblingCount > 1 && (
                              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                                <button
                                  className="p-1 hover:text-foreground disabled:opacity-30"
                                  disabled={currentSiblingIndex === 0}
                                  onClick={() => navigateBranch(messageItem.id, "prev")}
                                >
                                  <ChevronLeft className="h-3 w-3" />
                                </button>
                                <span>
                                  {currentSiblingIndex + 1}/{siblingCount}
                                </span>
                                <button
                                  className="p-1 hover:text-foreground disabled:opacity-30"
                                  disabled={currentSiblingIndex === siblingCount - 1}
                                  onClick={() => navigateBranch(messageItem.id, "next")}
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEditStart(messageItem.id, messageItem.content)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
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

      <div className="border-t border-white/10 bg-card/30 p-4 backdrop-blur-md">
        <form
          className="relative flex items-end gap-2 rounded-xl border border-white/10 bg-black/20 p-2 shadow-inner"
          onSubmit={handleSubmit}
        >
          <Textarea
            className="max-h-32 min-h-[40px] flex-1 resize-none border-none bg-transparent px-3 py-2 text-sm focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isSignedIn || isLoading}
            onChange={handleInputChange}
            placeholder={
              isSignedIn
                ? "Ask a question..."
                : "Sign in to chat"
            }
            ref={textareaRef}
            rows={1}
            value={input}
            onKeyDown={handleKeyDown}
          />
          <Button
            className="h-8 w-8 shrink-0 rounded-lg"
            disabled={!isSignedIn || isLoading || !input.trim()}
            size="icon"
            type="submit"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
