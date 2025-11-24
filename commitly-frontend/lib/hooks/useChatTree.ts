import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export interface MessageNode {
  id: string;
  role: string;
  content: string;
  parentId: string | null;
  childrenIds: string[];
  createdAt: Date;
  feedback?: "up" | "down";
}

export interface ChatTreeState {
  messages: Record<string, MessageNode>;
  headId: string | null;
  rootIds: string[];
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
  persistEnabled?: boolean;
}) {
  const [treeState, setTreeState] = useState<ChatTreeState>({
    messages: {},
    headId: null,
    rootIds: [],
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
          feedback: node.feedback,
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

  const setFeedback = useCallback((id: string, feedback: "up" | "down") => {
    setTreeState((prev) => {
      const node = prev.messages[id];
      if (!node) return prev;

      const newFeedback = node.feedback === feedback ? undefined : feedback;

      return {
        ...prev,
        messages: {
          ...prev.messages,
          [id]: { ...node, feedback: newFeedback },
        },
      };
    });
    // Also update linear messages if visible
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, feedback: m.feedback === feedback ? undefined : feedback }
          : m
      )
    );
  }, []);

  const storageKey = `guideChat:${options.repo_full_name}:${options.stage_id || "__all"}`;

  const persistMessages = useCallback(
    (msgs: any[]) => {
      if (options.persistEnabled === false) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(msgs));
      } catch (err) {
        console.warn("[useChatTree] persist failed", err);
      }
    },
    [storageKey, options.persistEnabled]
  );

  const restoreMessages = useCallback(
    (saved: any[]) => {
      // rebuild tree from linear history
      let parentId: string | null = null;
      saved.forEach((m) => {
        const id = m.id || uuidv4();
        addNode(m.content, m.role, id, parentId);
        // Restore feedback if present
        if (m.feedback) {
            // We need to set feedback after adding node, but addNode is async-ish in state updates.
            // However, since we are rebuilding, we can just assume addNode will handle it if we passed it.
            // But addNode doesn't take feedback.
            // Let's just update the state directly in a separate effect or modify addNode?
            // For now, let's just rely on setMessages having it.
            // But if we navigate away and back, we lose feedback if not in tree.
            // We should update the tree node with feedback.
            // Since we can't easily modify addNode signature right now without breaking things,
            // we will do a second pass or just accept it might be lost on full reload if not persisted in tree.
            // Actually, let's just use setFeedback logic but we can't call it here easily.
            // Let's modify addNode to accept optional props? No.
        }
        parentId = id;
      });

      // Fix: Update tree nodes with feedback after adding them
      setTreeState(prev => {
          const newMessages = { ...prev.messages };
          saved.forEach(m => {
              if (m.feedback && newMessages[m.id]) {
                  newMessages[m.id] = { ...newMessages[m.id], feedback: m.feedback };
              }
          });
          return { ...prev, messages: newMessages };
      });

      setMessages(saved);
    },
    [addNode]
  );

  useEffect(() => {
    const load = async () => {


      if (options.persistEnabled !== false) {
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
      }

      // 2) fall back to localStorage
      if (options.persistEnabled !== false) {
        try {
          const raw =
            typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
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
      }

      // reset state when switching repo/stage
      setMessages([]);
      setTreeState({ messages: {}, headId: null, rootIds: [] });
    };

    load();
  }, [
    storageKey,
    restoreMessages,
    options.historyApi,
    options.authHeaders,
    options.repo_full_name,
    options.stage_id,
    options.persistEnabled,
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
    currentMessages: any[],
    requestOptions?: any
  ) => {
    setStatus("loading");

    // Prepare an empty assistant message to stream into
    const assistantId = uuidv4();
    // Attach assistant node to the user message
    addNode("", "assistant", assistantId, userMessageId);

    const assistantMsg = { id: assistantId, role: "assistant", content: "" };

    let finalMessages = [...currentMessages, assistantMsg];

    setMessages(finalMessages);
    persistMessages(finalMessages);

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
          messages: [{ role: "user", content: userContent }],
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
        if (options.persistEnabled !== false) {
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
        }
      } catch (err) {
        console.warn("[useChatTree] persist remote failed", err);
      }
    }
  };

  // Send message (User)
  const sendMessage = async (content: string, requestOptions?: any) => {
    const userMsgId = uuidv4();
    addNode(content, "user", userMsgId);
    setInput("");

    const nextUser = { id: userMsgId, role: "user", content, createdAt: new Date() };
    const nextMessages = [...messages, nextUser];

    setMessages(nextMessages);
    persistMessages(nextMessages);



    await streamResponse(content, userMsgId, nextMessages, requestOptions);
  };

  // Edit message (Branching)
  const editMessage = async (
    nodeId: string,
    newContent: string,
    requestOptions?: any
  ) => {
    const node = treeState.messages[nodeId];
    if (!node) return;

    const parentId = node.parentId;

    // 1. Create new user node attached to parent
    const newMessageId = uuidv4();
    addNode(newContent, "user", newMessageId, parentId);

    // 2. Get history up to parent (this excludes the node being edited and its siblings)
    const history = getThread(parentId, treeState.messages);

    // 3. Construct the new message object
    const newMessage = {
      id: newMessageId,
      role: "user",
      content: newContent,
      createdAt: new Date(),
    };

    // 4. Update linear view to history + new message
    const nextMessages = [...history, newMessage];
    setMessages(nextMessages);
    persistMessages(nextMessages);



    // 5. Trigger streaming response
    await streamResponse(newContent, newMessageId, nextMessages, requestOptions);
  };

  // Navigate branches
  const navigateBranch = (nodeId: string, direction: "prev" | "next") => {
    const node = treeState.messages[nodeId];
    if (!node) return;

    let siblings: string[] = [];
    if (node.parentId) {
      const parent = treeState.messages[node.parentId];
      if (parent) siblings = parent.childrenIds;
    } else {
      siblings = treeState.rootIds || [];
    }

    const currentIndex = siblings.indexOf(nodeId);
    if (currentIndex === -1) return;

    let targetId: string | undefined;
    if (direction === "prev" && currentIndex > 0) {
      targetId = siblings[currentIndex - 1];
    } else if (
      direction === "next" &&
      currentIndex < siblings.length - 1
    ) {
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
    if (!node || node.childrenIds.length === 0) return currentId;
    currentId = node.childrenIds[node.childrenIds.length - 1];
  }
}
