import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";

import type {
  AppMessage,
  AppSettings,
  AppThread,
} from "../../../shared/contracts";
import { PdfViewer } from "../pdf-viewer/PdfViewer";
import { CommentPopover } from "../pdf-viewer/CommentPopover";
import { Sidebar } from "../sidebar/Sidebar";
import { SettingsDialog } from "../settings/SettingsPanel";
import { buildDocumentContext } from "../../lib/ai/context";
import { sendChatRequest } from "../../lib/ai/chat-client";
import {
  type DocumentWorkspace,
  createChatThread,
  deleteThread,
  getDocumentWorkspace,
  saveThread,
  updateSettings,
} from "../../lib/storage/db";

import "./workspace.css";

type SidebarTab = "chat" | "comments";
const EMPTY_THREADS: AppThread[] = [];

const replaceThread = (threads: AppThread[], next: AppThread) =>
  [...threads.filter((t) => t.id !== next.id), next].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

const createMessage = (
  role: AppMessage["role"],
  content: string,
  sourcePages: number[] = [],
): AppMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt: new Date().toISOString(),
  sourcePages,
});

export const WorkspacePage = () => {
  const { id: documentId } = useParams({ from: "/doc/$id" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: ["document-workspace", documentId],
    queryFn: () => getDocumentWorkspace(documentId),
  });

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeChatThreadId, setActiveChatThreadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chat");
  const [quotes, setQuotes] = useState<string[]>([]);
  const [popoverThreadId, setPopoverThreadId] = useState<string | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<Element | null>(null);

  const updateWorkspace = (
    updater: (c: DocumentWorkspace | null | undefined) => DocumentWorkspace | null | undefined,
  ) => {
    queryClient.setQueryData<DocumentWorkspace | null | undefined>(
      ["document-workspace", documentId],
      updater,
    );
  };

  const workspace = workspaceQuery.data;
  const activeDocument = workspace?.document ?? null;
  const settings: AppSettings | null = workspace?.settings ?? null;
  const threads: AppThread[] = workspace?.threads ?? EMPTY_THREADS;

  const chatThreads = useMemo(
    () => threads.filter((t) => t.kind === "global"),
    [threads],
  );
  const resolvedChatThreadId =
    activeChatThreadId && chatThreads.some((t) => t.id === activeChatThreadId)
      ? activeChatThreadId
      : chatThreads[0]?.id ?? null;
  const activeChatThread = useMemo(
    () => chatThreads.find((t) => t.id === resolvedChatThreadId) ?? null,
    [chatThreads, resolvedChatThreadId],
  );
  const anchorThreads = useMemo(
    () => threads.filter((t) => t.kind === "anchor"),
    [threads],
  );
  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );
  const popoverThread = useMemo(
    () => threads.find((t) => t.id === popoverThreadId) ?? null,
    [popoverThreadId, threads],
  );

  const sendMessageMutation = useMutation({ mutationFn: sendChatRequest });

  const persistSettings = async (partial: Partial<AppSettings>) => {
    const next = await updateSettings(partial);
    updateWorkspace((current) =>
      current ? { ...current, settings: next } : current,
    );
  };

  const sendToThread = async (thread: AppThread, value: string) => {
    if (!activeDocument || !settings) return;

    if (settings.providerMode === "byo" && !settings.byoOpenRouterKey.trim())
      return;

    const userMessage = createMessage("user", value);
    const optimistic: AppThread = {
      ...thread,
      messages: [...thread.messages, userMessage],
      updatedAt: new Date().toISOString(),
    };

    await saveThread(optimistic);
    updateWorkspace((c) =>
      c ? { ...c, threads: replaceThread(c.threads, optimistic) } : c,
    );
    setSelectedThreadId(optimistic.id);

    try {
      const response = await sendMessageMutation.mutateAsync({
        providerMode: settings.providerMode,
        byoOpenRouterKey:
          settings.providerMode === "byo"
            ? settings.byoOpenRouterKey.trim()
            : undefined,
        sessionId: settings.sessionId,
        document: {
          id: activeDocument.id,
          name: activeDocument.name,
          pageCount: activeDocument.pageCount,
        },
        thread: {
          id: optimistic.id,
          kind: optimistic.kind,
          title: optimistic.title,
          anchor: optimistic.anchor,
          history: optimistic.messages,
        },
        prompt: value,
        context: buildDocumentContext(activeDocument, optimistic, value),
      });

      const completed: AppThread = {
        ...optimistic,
        messages: [...optimistic.messages, response.reply],
        updatedAt: new Date().toISOString(),
      };
      await saveThread(completed);
      updateWorkspace((c) =>
        c ? { ...c, threads: replaceThread(c.threads, completed) } : c,
      );
    } catch (error) {
      const failed: AppThread = {
        ...optimistic,
        messages: [
          ...optimistic.messages,
          createMessage(
            "assistant",
            error instanceof Error ? error.message : "Request failed.",
          ),
        ],
        updatedAt: new Date().toISOString(),
      };
      await saveThread(failed);
      updateWorkspace((c) =>
        c ? { ...c, threads: replaceThread(c.threads, failed) } : c,
      );
    }
  };

  const handleSendChatMessage = async (value: string) => {
    if (!activeChatThread) return;
    await sendToThread(activeChatThread, value);
  };

  const handleCreateChatThread = async () => {
    if (!activeDocument) return;
    const thread = await createChatThread(activeDocument.id);
    updateWorkspace((c) =>
      c ? { ...c, threads: replaceThread(c.threads, thread) } : c,
    );
    setActiveChatThreadId(thread.id);
  };

  const handleDeleteChatThread = async (threadId: string) => {
    await deleteThread(threadId);
    updateWorkspace((c) =>
      c ? { ...c, threads: c.threads.filter((t) => t.id !== threadId) } : c,
    );
    if (activeChatThreadId === threadId) {
      setActiveChatThreadId(null);
    }
  };

  const handleSendCommentMessage = async (threadId: string, value: string) => {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;
    await sendToThread(thread, value);
  };

  const handleCreateComment = async (payload: {
    pageNumber: number;
    selectedText: string;
    textPrefix: string;
    textSuffix: string;
  }) => {
    if (!activeDocument) return;

    const newThread: AppThread = {
      id: crypto.randomUUID(),
      documentId: activeDocument.id,
      kind: "anchor",
      title: `Comment on page ${payload.pageNumber}`,
      anchor: {
        pageNumber: payload.pageNumber,
        selectedText: payload.selectedText,
        textPrefix: payload.textPrefix,
        textSuffix: payload.textSuffix,
      },
      messages: [],
      updatedAt: new Date().toISOString(),
    };

    await saveThread(newThread);
    updateWorkspace((c) =>
      c ? { ...c, threads: replaceThread(c.threads, newThread) } : c,
    );
    setSelectedThreadId(newThread.id);
    setPopoverThreadId(newThread.id);
  };

  useEffect(() => {
    if (!popoverThreadId) {
      setPopoverAnchor(null);
      return;
    }

    const findAnchor = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-thread-id="${popoverThreadId}"]`,
      );
      if (el) {
        setPopoverAnchor(el);
      } else {
        requestAnimationFrame(findAnchor);
      }
    };

    requestAnimationFrame(findAnchor);
  }, [popoverThreadId]);

  const handleQuoteInChat = (text: string) => {
    setQuotes((prev) => [...prev, text]);
    setSidebarOpen(true);
    setSidebarTab("chat");
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    const thread = threads.find((t) => t.id === threadId);

    if (thread?.kind === "anchor") {
      setPopoverThreadId(threadId);
    }
  };

  const handleExpandToSidebar = () => {
    setPopoverThreadId(null);
    setSidebarOpen(true);
    setSidebarTab("comments");
  };

  if (workspaceQuery.isLoading) {
    return (
      <main className="workspace">
        <header className="workspace__toolbar">
          <div className="workspace__brand">
            <Link to="/" className="workspace__brand-link">
              <h1>pdfation</h1>
            </Link>
            <div className="workspace__doc-name-skeleton" aria-hidden="true" />
          </div>

          <div className="workspace__actions">
            <div className="workspace__action-skeleton" aria-hidden="true" />
          </div>
        </header>

        <PdfViewer
          document={null}
          loading
          selectedThreadId={null}
          threads={EMPTY_THREADS}
          onCreateComment={() => undefined}
          onQuoteInChat={() => undefined}
          onSelectThread={() => undefined}
        />
      </main>
    );
  }

  if (!workspace) {
    navigate({ to: "/" });
    return null;
  }

  return (
    <main
      className={`workspace ${sidebarOpen ? "workspace--sidebar-open" : ""}`}
    >
      <header className="workspace__toolbar">
        <div className="workspace__brand">
          <Link to="/" className="workspace__brand-link">
            <h1>pdfation</h1>
          </Link>
          {activeDocument && (
            <span className="workspace__doc-name">{activeDocument.name}</span>
          )}
        </div>

        <div className="workspace__actions">
          {settings && (
            <SettingsDialog
              settings={settings}
              onChangeProviderMode={(mode) => {
                updateWorkspace((c) =>
                  c ? { ...c, settings: { ...c.settings, providerMode: mode } } : c,
                );
                void persistSettings({ providerMode: mode });
              }}
              onChangeKey={(value) => {
                updateWorkspace((c) =>
                  c
                    ? { ...c, settings: { ...c.settings, byoOpenRouterKey: value } }
                    : c,
                );
                void persistSettings({ byoOpenRouterKey: value });
              }}
            />
          )}

          <button
            className="btn btn-ghost"
            onClick={() => {
              setSidebarOpen((v) => !v);
            }}
            type="button"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <SidebarIcon />
          </button>
        </div>
      </header>

      <PdfViewer
        document={activeDocument}
        selectedThreadId={selectedThreadId}
        threads={threads}
        onCreateComment={handleCreateComment}
        onQuoteInChat={handleQuoteInChat}
        onSelectThread={handleSelectThread}
      />

      {popoverThread && popoverThread.kind === "anchor" && (
        <CommentPopover
          thread={popoverThread}
          anchor={popoverAnchor}
          open={!!popoverThreadId && !!popoverAnchor}
          onClose={() => setPopoverThreadId(null)}
          onExpand={handleExpandToSidebar}
          onSend={handleSendCommentMessage}
          isSending={sendMessageMutation.isPending}
        />
      )}

      <Sidebar
        open={sidebarOpen}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        onClose={() => setSidebarOpen(false)}
        chatThreads={chatThreads}
        activeChatThreadId={resolvedChatThreadId}
        activeChatThread={activeChatThread}
        anchorThreads={anchorThreads}
        selectedThreadId={selectedThreadId}
        focusedThread={
          selectedThread?.kind === "anchor" ? selectedThread : null
        }
        isSending={sendMessageMutation.isPending}
        quotes={quotes}
        onSendMessage={handleSendChatMessage}
        onSendCommentMessage={handleSendCommentMessage}
        onSelectThread={handleSelectThread}
        onSelectChatThread={setActiveChatThreadId}
        onCreateChatThread={handleCreateChatThread}
        onDeleteChatThread={handleDeleteChatThread}
        onRemoveQuote={(index) => setQuotes((prev) => prev.filter((_, i) => i !== index))}
        onClearQuotes={() => setQuotes([])}
      />
    </main>
  );
};

const SidebarIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);
