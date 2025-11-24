import { useChat } from "@ai-sdk/react";
import { useCallback, useState } from "react";
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

export function useChatTree(options: any) {
  // console.log("useChatTree options:", options);
  const [treeState, setTreeState] = useState<ChatTreeState>({
    messages: {},
    headId: null,
  });
  const [input, setInput] = useState("");

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

  // Initialize useChat
  // console.log("useChatTree options passed to useChat:", options);
  const chat = useChat({
    ...options,
    onFinish: (result: any) => {
      // Handle different versions of AI SDK
      const message = result.message || result;
      if (message && message.content) {
        addNode(message.content, message.role, message.id);
      }
      options.onFinish?.(result);
    },
  });

  const {
    messages,
    setMessages,
    sendMessage: append,
    reload,
    status,
    stop,
  } = chat as any;

  const isLoading = status === "streaming" || status === "submitted";

  // Send message (User)
  const sendMessage = async (content: string, requestOptions?: any) => {
    const userMsgId = uuidv4();
    addNode(content, "user", userMsgId);
    setInput("");

    await append(
      {
        id: userMsgId,
        role: "user",
        content,
      },
      requestOptions
    );
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

    const newMessageId = uuidv4();
    addNode(newContent, "user", newMessageId, parentId);

    const history = getThread(parentId, treeState.messages);

    setMessages(history);

    await append(
      {
        id: newMessageId,
        role: "user",
        content: newContent,
      },
      requestOptions
    );
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
