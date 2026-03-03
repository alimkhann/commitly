import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export type MessageFeedback = "up" | "down";

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  feedback?: MessageFeedback;
}

export interface MessageNode {
  id: string;
  role: string;
  content: string;
  parentId: string | null;
  childrenIds: string[];
  createdAt: Date;
  feedback?: MessageFeedback;
}

export interface ChatTreeState {
  messages: Record<string, MessageNode>;
  headId: string | null;
  rootIds: string[];
}

type UseChatTreeOptions = {
  api?: string;
  repo_full_name: string;
  stage_id?: string | null;
  historyApi?: string;
  authHeaders?: () => Promise<Record<string, string>>;
  persistEnabled?: boolean;
};

type ChatRequestOptions = {
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
};

function parseDataStreamLine(line: string): string {
  // Vercel AI data stream v1: lines like `0:"text"`
  if (!line.startsWith("0:")) {
    return "";
  }
  try {
    return JSON.parse(line.slice(2));
  } catch {
    return "";
  }
}

function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function normalizeMessage(value: unknown): ChatMessage | null {
  if (!(value && typeof value === "object")) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.content !== "string") {
    return null;
  }

  const feedback: MessageFeedback | undefined =
    raw.feedback === "up" || raw.feedback === "down" ? raw.feedback : undefined;

  return {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : uuidv4(),
    role: typeof raw.role === "string" && raw.role.length > 0 ? raw.role : "assistant",
    content: raw.content,
    createdAt: toDate(raw.createdAt),
    feedback,
  };
}

function buildTreeFromMessages(history: ChatMessage[]): ChatTreeState {
  const messages: Record<string, MessageNode> = {};
  const rootIds: string[] = [];
  let parentId: string | null = null;

  history.forEach((message) => {
    const node: MessageNode = {
      id: message.id,
      role: message.role,
      content: message.content,
      parentId,
      childrenIds: [],
      createdAt: message.createdAt,
      feedback: message.feedback,
    };

    messages[node.id] = node;

    if (parentId && messages[parentId]) {
      messages[parentId] = {
        ...messages[parentId],
        childrenIds: [...messages[parentId].childrenIds, node.id],
      };
    } else {
      rootIds.push(node.id);
    }

    parentId = node.id;
  });

  return {
    messages,
    rootIds,
    headId: parentId,
  };
}

export function useChatTree(options: UseChatTreeOptions) {
  const {
    api = "/api/chat",
    repo_full_name,
    stage_id,
    historyApi = "/api/chat/history",
    authHeaders,
    persistEnabled,
  } = options;

  const [treeState, setTreeState] = useState<ChatTreeState>({
    messages: {},
    headId: null,
    rootIds: [],
  });
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const abortRef = useRef<AbortController | null>(null);

  const getThread = useCallback(
    (headId: string | null, nodes: Record<string, MessageNode>): ChatMessage[] => {
      const thread: ChatMessage[] = [];
      let currentId = headId;
      while (currentId) {
        const node = nodes[currentId];
        if (!node) {
          break;
        }
        thread.unshift({
          id: node.id,
          role: node.role,
          content: node.content,
          createdAt: node.createdAt,
          feedback: node.feedback,
        });
        currentId = node.parentId;
      }
      return thread;
    },
    []
  );

  const addNode = useCallback(
    (content: string, role: string, id: string, parentId?: string | null) => {
      setTreeState((prev) => {
        if (prev.messages[id]) {
          return prev;
        }

        const effectiveParentId = parentId !== undefined ? parentId : prev.headId;

        const newNode: MessageNode = {
          id,
          role,
          content,
          parentId: effectiveParentId,
          childrenIds: [],
          createdAt: new Date(),
        };

        const nextMessages = { ...prev.messages, [id]: newNode };
        let nextRootIds = prev.rootIds || [];

        if (effectiveParentId && nextMessages[effectiveParentId]) {
          nextMessages[effectiveParentId] = {
            ...nextMessages[effectiveParentId],
            childrenIds: [...nextMessages[effectiveParentId].childrenIds, id],
          };
        } else if (!effectiveParentId) {
          nextRootIds = [...nextRootIds, id];
        }

        return {
          messages: nextMessages,
          headId: id,
          rootIds: nextRootIds,
        };
      });
    },
    []
  );

  const updateNodeContent = useCallback((id: string, content: string) => {
    setTreeState((prev) => {
      const node = prev.messages[id];
      if (!node) {
        return prev;
      }
      return {
        ...prev,
        messages: {
          ...prev.messages,
          [id]: { ...node, content },
        },
      };
    });
  }, []);

  const setFeedback = useCallback((id: string, feedback: MessageFeedback) => {
    setTreeState((prev) => {
      const node = prev.messages[id];
      if (!node) {
        return prev;
      }

      const newFeedback = node.feedback === feedback ? undefined : feedback;

      return {
        ...prev,
        messages: {
          ...prev.messages,
          [id]: { ...node, feedback: newFeedback },
        },
      };
    });

    setMessages((prev) =>
      prev.map((message) =>
        message.id === id
          ? {
              ...message,
              feedback: message.feedback === feedback ? undefined : feedback,
            }
          : message
      )
    );
  }, []);

  const storageKey = `guideChat:${repo_full_name}:${stage_id || "__all"}`;

  const persistMessages = useCallback(
    (savedMessages: ChatMessage[]) => {
      if (persistEnabled === false) {
        return;
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(savedMessages));
      } catch (error) {
        console.warn("[useChatTree] persist failed", error);
      }
    },
    [persistEnabled, storageKey]
  );

  const restoreMessages = useCallback((saved: unknown[]) => {
    const normalized = saved
      .map(normalizeMessage)
      .filter(
        (message: ChatMessage | null): message is ChatMessage =>
          message !== null
      );

    setTreeState(buildTreeFromMessages(normalized));
    setMessages(normalized);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (persistEnabled !== false) {
        try {
          const headers = authHeaders ? await authHeaders() : {};
          const res = await fetch(
            `${historyApi}?repo_full_name=${encodeURIComponent(repo_full_name)}${stage_id ? `&stage_id=${encodeURIComponent(stage_id)}` : ""}`,
            { headers, cache: "no-store" }
          );

          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.messages)) {
              restoreMessages(data.messages);
              const normalized = data.messages
                .map(normalizeMessage)
                .filter(
                  (message: ChatMessage | null): message is ChatMessage =>
                    message !== null
                );
              persistMessages(normalized);
              return;
            }
          }
        } catch (error) {
          console.warn("[useChatTree] server history fetch failed", error);
        }
      }

      if (persistEnabled !== false) {
        try {
          const raw =
            typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              restoreMessages(parsed);
              return;
            }
          }
        } catch (error) {
          console.warn("[useChatTree] restore failed", error);
        }
      }

      setMessages([]);
      setTreeState({ messages: {}, headId: null, rootIds: [] });
    };

    load();
  }, [
    authHeaders,
    historyApi,
    persistEnabled,
    persistMessages,
    repo_full_name,
    restoreMessages,
    stage_id,
    storageKey,
  ]);

  const stop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStatus("idle");
    }
  };

  const isLoading = status === "loading";

  const streamResponse = async (
    userContent: string,
    userMessageId: string,
    currentMessages: ChatMessage[],
    requestOptions?: ChatRequestOptions
  ) => {
    setStatus("loading");

    const assistantId = uuidv4();
    addNode("", "assistant", assistantId, userMessageId);

    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
    };

    let finalMessages: ChatMessage[] = [...currentMessages, assistantMsg];

    setMessages(finalMessages);
    persistMessages(finalMessages);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(api, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(requestOptions?.headers || {}),
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: userContent }],
          ...(requestOptions?.body || {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!response.body) {
        const raw = await response.text();
        updateNodeContent(assistantId, raw);
        setMessages((prev) => {
          const next = prev.map((message) =>
            message.id === assistantId ? { ...message, content: raw } : message
          );
          finalMessages = next;
          persistMessages(next);
          return next;
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          const chunk = parseDataStreamLine(line);
          if (!chunk) {
            continue;
          }

          fullText += chunk;
          updateNodeContent(assistantId, fullText);
          setMessages((prev) => {
            const next = prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: fullText }
                : message
            );
            finalMessages = next;
            persistMessages(next);
            return next;
          });
        }
      }
    } catch (error) {
      console.error("[useChatTree] streaming error", error);
    } finally {
      setStatus("idle");
      if (abortRef.current === controller) {
        abortRef.current = null;
      }

      try {
        if (persistEnabled !== false) {
          const headers = authHeaders ? await authHeaders() : {};
          if (headers.Authorization) {
            await fetch(historyApi, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...headers,
              },
              body: JSON.stringify({
                repo_full_name,
                stage_id: stage_id ?? null,
                messages: finalMessages,
              }),
            });
          }
        }
      } catch (error) {
        console.warn("[useChatTree] persist remote failed", error);
      }
    }
  };

  const sendMessage = async (content: string, requestOptions?: ChatRequestOptions) => {
    const userMsgId = uuidv4();
    addNode(content, "user", userMsgId);
    setInput("");

    const nextUser: ChatMessage = {
      id: userMsgId,
      role: "user",
      content,
      createdAt: new Date(),
    };

    const nextMessages = [...messages, nextUser];

    setMessages(nextMessages);
    persistMessages(nextMessages);

    await streamResponse(content, userMsgId, nextMessages, requestOptions);
  };

  const editMessage = async (
    nodeId: string,
    newContent: string,
    requestOptions?: ChatRequestOptions
  ) => {
    const node = treeState.messages[nodeId];
    if (!node) {
      return;
    }

    const parentId = node.parentId;

    const newMessageId = uuidv4();
    addNode(newContent, "user", newMessageId, parentId);

    const history = getThread(parentId, treeState.messages);

    const newMessage: ChatMessage = {
      id: newMessageId,
      role: "user",
      content: newContent,
      createdAt: new Date(),
    };

    const nextMessages = [...history, newMessage];
    setMessages(nextMessages);
    persistMessages(nextMessages);

    await streamResponse(newContent, newMessageId, nextMessages, requestOptions);
  };

  const navigateBranch = (nodeId: string, direction: "prev" | "next") => {
    const node = treeState.messages[nodeId];
    if (!node) {
      return;
    }

    let siblings: string[] = [];
    if (node.parentId) {
      const parent = treeState.messages[node.parentId];
      if (parent) {
        siblings = parent.childrenIds;
      }
    } else {
      siblings = treeState.rootIds || [];
    }

    const currentIndex = siblings.indexOf(nodeId);
    if (currentIndex === -1) {
      return;
    }

    let targetId: string | undefined;
    if (direction === "prev" && currentIndex > 0) {
      targetId = siblings[currentIndex - 1];
    } else if (direction === "next" && currentIndex < siblings.length - 1) {
      targetId = siblings[currentIndex + 1];
    }

    if (targetId) {
      const leafId = findLatestLeaf(targetId, treeState.messages);
      setTreeState((prev) => ({ ...prev, headId: leafId }));
      setMessages(getThread(leafId, treeState.messages));
    }
  };

  return {
    messages,
    treeState,
    sendMessage,
    editMessage,
    navigateBranch,
    isLoading,
    stop,
    input,
    setInput,
    setFeedback,
  };
}

function findLatestLeaf(
  startNodeId: string,
  nodes: Record<string, MessageNode>
): string {
  let currentId = startNodeId;
  while (true) {
    const node = nodes[currentId];
    if (!node || node.childrenIds.length === 0) {
      return currentId;
    }
    currentId = node.childrenIds[node.childrenIds.length - 1];
  }
}
