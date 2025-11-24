import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export interface MessageNode {
  id: string;
  role: string;
  content: string;
  parentId: string | null;
  childrenIds: string[];
  createdAt: Date;
}

export interface ChatTreeState {
  messages: Record<string, MessageNode>;
  headId: string | null;
}

function parseDataStreamLine(line: string): string {
  // Vercel AI data stream v1: lines like `0:"text"`
  if (!line.startsWith("0:")) return "";
  try {
    return JSON.parse(line.slice(2));
  } catch {
    return "";
  }
}

export function useChatTree(options: {
  api?: string;
  repo_full_name: string;
  stage_id?: string | null;
  historyApi?: string;
  authHeaders?: () => Promise<Record<string, string>>;
}) {
  const [treeState, setTreeState] = useState<ChatTreeState>({
    messages: {},
    headId: null,
  });
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const abortRef = useRef<AbortController | null>(null);

  // Helper to reconstruct the linear thread from the current head
  const getThread = useCallback(
    (headId: string | null, nodes: Record<string, MessageNode>): any[] => {
      const thread: any[] = [];
      let currentId = headId;
      while (currentId) {
        const node = nodes[currentId];
        if (!node) break;
        thread.unshift({
          id: node.id,
          role: node.role,
          content: node.content,
          createdAt: node.createdAt,
        });
        currentId = node.parentId;
      }
      return thread;
    },
    []
  );

  // Add a node to the tree
  const addNode = useCallback(
    (content: string, role: string, id: string, parentId?: string | null) => {
      setTreeState((prev) => {
        if (prev.messages[id]) {
          return prev;
        }

        const effectiveParentId =
          parentId !== undefined ? parentId : prev.headId;

        const newNode: MessageNode = {
          id,
          role,
          content,
          parentId: effectiveParentId,
          childrenIds: [],
          createdAt: new Date(),
        };

        const nextMessages = { ...prev.messages, [id]: newNode };

        if (effectiveParentId && nextMessages[effectiveParentId]) {
          nextMessages[effectiveParentId] = {
            ...nextMessages[effectiveParentId],
            childrenIds: [...nextMessages[effectiveParentId].childrenIds, id],
          };
        }

        return {
          messages: nextMessages,
          headId: id,
        };
      });
    },
    []
  );

  const updateNodeContent = useCallback((id: string, content: string) => {
    setTreeState((prev) => {
      const node = prev.messages[id];
      if (!node) return prev;
      return {
        ...prev,
        messages: {
          ...prev.messages,
          [id]: { ...node, content },
        },
      };
    });
  }, []);

  const storageKey = `guideChat:${options.repo_full_name}:${options.stage_id || "__all"}`;

  const persistMessages = useCallback(
    (msgs: any[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(msgs));
      } catch (err) {
        console.warn("[useChatTree] persist failed", err);
      }
    },
    [storageKey]
  );

  const restoreMessages = useCallback(
    (saved: any[]) => {
      // rebuild tree from linear history
      let parentId: string | null = null;
      saved.forEach((m) => {
        const id = m.id || uuidv4();
        addNode(m.content, m.role, id, parentId);
        parentId = id;
      });
      setMessages(saved);
    },
    [addNode]
  );

  useEffect(() => {
    const load = async () => {
      try {
        // 1) try server history if available
        const historyEndpoint = options.historyApi || "/api/chat/history";
        const headers = options.authHeaders ? await options.authHeaders() : {};
        const res = await fetch(
          `${historyEndpoint}?repo_full_name=${encodeURIComponent(options.repo_full_name)}${options.stage_id ? `&stage_id=${encodeURIComponent(options.stage_id)}` : ""}`,
          { headers, cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.messages)) {
            restoreMessages(data.messages);
            persistMessages(data.messages);
            return;
          }
        }
      } catch (err) {
        console.warn("[useChatTree] server history fetch failed", err);
      }

      // 2) fall back to localStorage
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            restoreMessages(parsed);
            return;
          }
        }
      } catch (err) {
        console.warn("[useChatTree] restore failed", err);
      }

      // reset state when switching repo/stage
      setMessages([]);
      setTreeState({ messages: {}, headId: null });
    };

    load();
  }, [storageKey, restoreMessages, options.historyApi, options.authHeaders, options.repo_full_name, options.stage_id]);

  const reload = () => {};
  const stop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStatus("idle");
    }
  };
  const isLoading = status === "loading";

  // Send message (User)
  const sendMessage = async (content: string, requestOptions?: any) => {
    const userMsgId = uuidv4();
    addNode(content, "user", userMsgId);
    setInput("");
    const nextUser = { id: userMsgId, role: "user", content };
    let finalMessages: any[] | null = null;

    setMessages((prev) => {
      const next = [...prev, nextUser];
      finalMessages = next;
      persistMessages(next);
      return next;
    });
    setStatus("loading");

    // Prepare an empty assistant message to stream into
    const assistantId = uuidv4();
    addNode("", "assistant", assistantId);
    const assistantMsg = { id: assistantId, role: "assistant", content: "" };
    setMessages((prev) => {
      const next = [...prev, assistantMsg];
      finalMessages = next;
      persistMessages(next);
      return next;
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiUrl = options?.api ?? "/api/chat";
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(requestOptions?.headers || {}),
        },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          ...(requestOptions?.body || {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (!res.body) {
        const raw = await res.text();
        updateNodeContent(assistantId, raw);
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === assistantId ? { ...m, content: raw } : m
          );
          finalMessages = next;
          persistMessages(next);
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          const chunk = parseDataStreamLine(line);
          if (!chunk) continue;
          fullText += chunk;
          updateNodeContent(assistantId, fullText);
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === assistantId ? { ...m, content: fullText } : m
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
      // Persist remotely (best-effort)
      try {
        const historyEndpoint = options.historyApi || "/api/chat/history";
        const headers = options.authHeaders ? await options.authHeaders() : {};
        if (headers.Authorization) {
          await fetch(historyEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify({
              repo_full_name: options.repo_full_name,
              stage_id: options.stage_id ?? null,
              messages: finalMessages ?? messages,
            }),
          });
        }
      } catch (err) {
        console.warn("[useChatTree] persist remote failed", err);
      }
    }
  };

  // Edit message (Branching)
  const editMessage = async (
    nodeId: string,
    newContent: string,
    requestOptions?: any
  ) => {
    // Simplified: treat edit as new branch starting from parent, then stream response
    const node = treeState.messages[nodeId];
    const parentId = node?.parentId ?? null;
    const newMessageId = uuidv4();
    addNode(newContent, "user", newMessageId, parentId);
    setMessages((prev) => [
      ...prev,
      { id: newMessageId, role: "user", content: newContent },
    ]);
    await sendMessage(newContent, requestOptions);
  };

  // Navigate branches
  const navigateBranch = (nodeId: string, direction: "prev" | "next") => {
    const node = treeState.messages[nodeId];
    if (!(node && node.parentId)) return;

    const parent = treeState.messages[node.parentId];
    if (!parent) return;

    const currentIndex = parent.childrenIds.indexOf(nodeId);
    if (currentIndex === -1) return;

    let targetId: string | undefined;
    if (direction === "prev" && currentIndex > 0) {
      targetId = parent.childrenIds[currentIndex - 1];
    } else if (
      direction === "next" &&
      currentIndex < parent.childrenIds.length - 1
    ) {
      targetId = parent.childrenIds[currentIndex + 1];
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
  };
}

function findLatestLeaf(
  startNodeId: string,
  nodes: Record<string, MessageNode>
): string {
  let currentId = startNodeId;
  while (true) {
    const node = nodes[currentId];
    if (!node || node.childrenIds.length === 0) return currentId;
    currentId = node.childrenIds[node.childrenIds.length - 1];
  }
}
