import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
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
import { ShareDialog } from "../share/ShareDialog";
import { useShareAutoSync } from "../share/useShareAutoSync";
import { defaultModelForProvider } from "../../../shared/models";
import { buildDocumentContext } from "../../lib/ai/context";
import { sendChatRequest, generateChatTitle } from "../../lib/ai/chat-client";
import {
  type DocumentWorkspace,
  createChatThread,
  deleteAllAnchorThreads,
  deleteThread,
  getDocumentWorkspace,
  renameThread,
  saveThread,
  updateSettings,
} from "../../lib/storage/db";

import "./workspace.css";

export interface Quote {
  text: string;
  pageNumber: number;
}
const EMPTY_THREADS: AppThread[] = [];

const replaceThread = (threads: AppThread[], next: AppThread) =>
  [...threads.filter((t) => t.id !== next.id), next].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

const createMessage = (
  role: AppMessage["role"],
  content: string,
  sourcePages: number[] = [],
  author?: Pick<AppMessage, "authorDeviceId" | "authorName">,
): AppMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt: new Date().toISOString(),
  sourcePages,
  ...(author ?? {}),
});

export const WorkspacePage = () => {
  const { id: documentId } = useParams({ from: "/doc/$id" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: ["document-workspace", documentId],
    queryFn: () => getDocumentWorkspace(documentId),
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1200);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [popoverThreadId, setPopoverThreadId] = useState<string | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<Element | null>(null);
  const [draftCommentThread, setDraftCommentThread] = useState<AppThread | null>(null);

  const navigateBack = () => {
    const go = () => navigate({ to: "/" });
    if (!("startViewTransition" in document)) {
      go();
      return;
    }
    (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(
      () => flushSync(go),
    );
  };

  const logScrollDebug = (
    hypothesisId: string,
    location: string,
    message: string,
    data: Record<string, unknown>,
  ) => {
    fetch("http://127.0.0.1:7846/ingest/203ce655-c596-4a08-980f-f1e7d91da1cc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "12be06",
      },
      body: JSON.stringify({
        sessionId: "12be06",
        runId: "initial",
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  };

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
  const viewerThreads = draftCommentThread
    ? replaceThread(threads, draftCommentThread)
    : threads;

  const resolvedThreadId =
    activeThreadId && draftCommentThread?.id === activeThreadId
      ? activeThreadId
      : activeThreadId && threads.some((t) => t.id === activeThreadId)
        ? activeThreadId
        : threads[0]?.id ?? null;

  const activeThread = useMemo(
    () =>
      (draftCommentThread && draftCommentThread.id === resolvedThreadId
        ? draftCommentThread
        : threads.find((t) => t.id === resolvedThreadId)) ?? null,
    [draftCommentThread, threads, resolvedThreadId],
  );

  const popoverThread = useMemo(
    () =>
      (draftCommentThread && draftCommentThread.id === popoverThreadId
        ? draftCommentThread
        : threads.find((t) => t.id === popoverThreadId)) ?? null,
    [draftCommentThread, popoverThreadId, threads],
  );

  useShareAutoSync(activeDocument, threads, settings?.deviceId ?? null, settings?.username ?? '');

  const sendMessageMutation = useMutation({ mutationFn: sendChatRequest });

  const persistSettings = async (partial: Partial<AppSettings>) => {
    const next = await updateSettings(partial);
    updateWorkspace((current) =>
      current ? { ...current, settings: next } : current,
    );
  };

  const clearDraftCommentThread = (threadIdToKeep?: string | null) => {
    setDraftCommentThread((current) => {
      if (!current) return current;
      if (threadIdToKeep && current.id === threadIdToKeep) return current;
      return null;
    });
  };

  const sendToThread = async (thread: AppThread, value: string) => {
    if (!activeDocument || !settings) return;

    if (settings.providerMode === "byo" && !settings.byoOpenRouterKey.trim())
      return;
    if (settings.providerMode === "openai" && !settings.byoOpenAiKey.trim())
      return;

    const userMessage = createMessage("user", value, [], {
      authorDeviceId: settings.deviceId,
      authorName: settings.username.trim() || null,
    });
    const optimistic: AppThread = {
      ...thread,
      messages: [...thread.messages, userMessage],
      updatedAt: new Date().toISOString(),
    };

    await saveThread(optimistic);
    updateWorkspace((c) =>
      c ? { ...c, threads: replaceThread(c.threads, optimistic) } : c,
    );
    setDraftCommentThread((d) => (d?.id === thread.id ? null : d));

    try {
      const response = await sendMessageMutation.mutateAsync({
        providerMode: settings.providerMode,
        byoOpenRouterKey:
          settings.providerMode === "byo"
            ? settings.byoOpenRouterKey.trim()
            : undefined,
        byoOpenAiKey:
          settings.providerMode === "openai"
            ? settings.byoOpenAiKey.trim()
            : undefined,
        model: settings.model || undefined,
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
        pages: activeDocument.pages.map((p) => ({
          pageNumber: p.pageNumber,
          text: p.text,
        })),
      });

      const completed: AppThread = {
        ...optimistic,
        messages: [...optimistic.messages, response.reply],
        updatedAt: new Date().toISOString(),
      };

      if (
        completed.kind === "global" &&
        completed.messages.length === 2 &&
        /^Chat \d+$/.test(completed.title) &&
        settings
      ) {
        const threadId = completed.id;
        void generateChatTitle({
          providerMode: settings.providerMode,
          byoOpenRouterKey: settings.providerMode === "byo" ? settings.byoOpenRouterKey.trim() : undefined,
          byoOpenAiKey: settings.providerMode === "openai" ? settings.byoOpenAiKey.trim() : undefined,
          model: settings.model || undefined,
          userMessage: completed.messages[0].content,
          assistantMessage: completed.messages[1].content,
          documentName: activeDocument?.name ?? "document",
        }).then((title) => {
          if (!title) return;
          void renameThread(threadId, title);
          updateWorkspace((c) => {
            if (!c) return c;
            return {
              ...c,
              threads: c.threads.map((t) =>
                t.id === threadId ? { ...t, title } : t,
              ),
            };
          });
        });
      }

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

  const handleSendMessage = async (value: string) => {
    if (!activeThread) return;
    await sendToThread(activeThread, value);
  };

  const handleSendPopoverMessage = async (threadId: string, value: string) => {
    const thread =
      (draftCommentThread?.id === threadId ? draftCommentThread : null) ??
      threads.find((t) => t.id === threadId);
    if (!thread) return;
    await sendToThread(thread, value);
  };

  const handleCreateThread = async () => {
    clearDraftCommentThread();

    if (!activeDocument) return;
    const thread = await createChatThread(activeDocument.id);
    updateWorkspace((c) =>
      c ? { ...c, threads: replaceThread(c.threads, thread) } : c,
    );
    setActiveThreadId(thread.id);
  };

  const handleDeleteThread = async (threadId: string) => {
    clearDraftCommentThread(threadId);

    await deleteThread(threadId);
    updateWorkspace((c) =>
      c ? { ...c, threads: c.threads.filter((t) => t.id !== threadId) } : c,
    );
    if (activeThreadId === threadId) setActiveThreadId(null);
    if (popoverThreadId === threadId) setPopoverThreadId(null);
  };

  const handleRenameThread = async (threadId: string, title: string) => {
    const updated = await renameThread(threadId, title);
    if (!updated) return;
    updateWorkspace((c) =>
      c ? { ...c, threads: replaceThread(c.threads, updated) } : c,
    );
  };

  const handleClearAllComments = async () => {
    if (!activeDocument) return;

    await deleteAllAnchorThreads(activeDocument.id);
    updateWorkspace((c) =>
      c ? { ...c, threads: c.threads.filter((t) => t.kind !== "anchor") } : c,
    );
    clearDraftCommentThread();
    if (activeThread?.kind === "anchor") setActiveThreadId(null);
    if (popoverThread?.kind === "anchor") setPopoverThreadId(null);
  };

  const handleCreateComment = async (payload: {
    pageNumber: number;
    selectedText: string;
    textPrefix: string;
    textSuffix: string;
  }) => {
    clearDraftCommentThread();

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

    setDraftCommentThread(newThread);
    setActiveThreadId(newThread.id);

    if (sidebarOpen) {
      setPopoverThreadId(null);
    } else {
      setPopoverThreadId(newThread.id);
    }

    await saveThread(newThread);
    updateWorkspace((c) =>
      c ? { ...c, threads: replaceThread(c.threads, newThread) } : c,
    );
    setDraftCommentThread((current) =>
      current?.id === newThread.id ? null : current,
    );
  };

  useEffect(() => {
    if (!popoverThreadId) {
      setPopoverAnchor(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    const findAnchor = () => {
      if (cancelled) return;

      const el = document.querySelector<HTMLElement>(
        `[data-thread-id="${popoverThreadId}"]`,
      );
      if (el) {
        setPopoverAnchor(el);
        return;
      }

      if (attempts >= maxAttempts) {
        setPopoverAnchor(null);
        setSidebarOpen(true);
        return;
      }

      attempts += 1;
      requestAnimationFrame(findAnchor);
    };

    requestAnimationFrame(findAnchor);

    return () => {
      cancelled = true;
    };
  }, [popoverThreadId]);

  const handleQuoteInChat = (quote: Quote) => {
    setQuotes((prev) => [...prev, quote]);
    setSidebarOpen(true);
  };

  const handleScrollToAnchor = (threadId: string, pageNumber: number) => {
    handleScrollToPage(pageNumber);

    requestAnimationFrame(() => {
      const marks = document.querySelectorAll<HTMLElement>(
        `.pdf-highlight[data-thread-id="${threadId}"]`,
      );
      for (const mark of marks) {
        mark.classList.add("pdf-highlight--flash");
      }
      setTimeout(() => {
        for (const mark of marks) mark.classList.remove("pdf-highlight--flash");
      }, 1400);
    });
  };

  const handleScrollToPage = (pageNumber: number) => {
    const container = document.querySelector<HTMLElement>(".pdf-viewer__scroll");
    const target = container?.querySelector<HTMLElement>(`[data-page="${pageNumber}"]`);
    const viewerHeader = document.querySelector<HTMLElement>(".pdf-viewer__header");
    if (!target) return;

    const getMetrics = () => {
      const containerRect = container?.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      return {
        pageNumber,
        containerScrollTop: container?.scrollTop ?? null,
        containerClientHeight: container?.clientHeight ?? null,
        containerScrollHeight: container?.scrollHeight ?? null,
        containerRectTop: containerRect?.top ?? null,
        targetOffsetTop:
          containerRect && container
            ? targetRect.top - containerRect.top + container.scrollTop
            : null,
        targetRectTop: targetRect.top,
        targetTopWithinContainer:
          containerRect ? targetRect.top - containerRect.top : null,
        viewerHeaderHeight: viewerHeader?.getBoundingClientRect().height ?? null,
        windowScrollY: window.scrollY,
        activeElementTag: activeElement?.tagName ?? null,
        activeElementClass: activeElement?.className ?? null,
      };
    };

    // #region agent log
    logScrollDebug(
      "E",
      "WorkspacePage.tsx:handleScrollToPage:before-scrollIntoView",
      "Page reference clicked before viewer scroll",
      getMetrics(),
    );
    // #endregion

    let scrollEventCount = 0;
    const handleContainerScroll = () => {
      scrollEventCount += 1;

      // #region agent log
      logScrollDebug(
        scrollEventCount === 1 ? "F" : "G",
        `WorkspacePage.tsx:handleScrollToPage:container-scroll-${scrollEventCount}`,
        "Viewer container scrolled after page reference click",
        { scrollEventCount, ...getMetrics() },
      );
      // #endregion

      if (scrollEventCount >= 2) {
        container?.removeEventListener("scroll", handleContainerScroll);
      }
    };

    container?.addEventListener("scroll", handleContainerScroll, { passive: true });

    const containerRect = container!.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scrollMargin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    container!.scrollTo({
      top: container!.scrollTop + targetRect.top - containerRect.top - scrollMargin,
      behavior: "smooth",
    });
    target.classList.add("pdf-page-card--flash");
    setTimeout(() => target.classList.remove("pdf-page-card--flash"), 1200);

    requestAnimationFrame(() => {
      // #region agent log
      logScrollDebug(
        "H",
        "WorkspacePage.tsx:handleScrollToPage:after-scrollIntoView-frame",
        "Post-scrollIntoView frame snapshot",
        getMetrics(),
      );
      // #endregion

      if (scrollEventCount === 0) {
        container?.removeEventListener("scroll", handleContainerScroll);
      }
    });
  };

  const handleHighlightClick = (threadId: string) => {
    clearDraftCommentThread(threadId);
    setActiveThreadId(threadId);

    if (sidebarOpen) {
      setPopoverThreadId(null);
    } else {
      setPopoverThreadId(threadId);
    }
  };

  const handleExpandToSidebar = () => {
    if (popoverThreadId) setActiveThreadId(popoverThreadId);
    setPopoverThreadId(null);
    setSidebarOpen(true);
  };

  const handleSelectThread = (threadId: string) => {
    clearDraftCommentThread(threadId);
    setPopoverThreadId(null);
    setActiveThreadId(threadId);
  };

  const closeSidebar = () => {
    if (activeThread?.kind === "anchor") {
      setPopoverThreadId(activeThread.id);
    } else {
      clearDraftCommentThread();
      setPopoverThreadId(null);
    }

    setSidebarOpen(false);
  };

  const openSidebar = () => {
    setPopoverThreadId(null);
    setSidebarOpen(true);
  };

  const toggleSidebar = () => {
    if (sidebarOpen) {
      closeSidebar();
      return;
    }

    openSidebar();
  };

  const closePopover = () => {
    setPopoverThreadId(null);
  };

  // Auto-hide popover when sidebar opens showing the same thread
  const showPopover =
    !!popoverThread &&
    popoverThread.kind === "anchor" &&
    !!popoverAnchor &&
    !(sidebarOpen && resolvedThreadId === popoverThreadId);

  if (workspaceQuery.isLoading) {
    return (
      <main className="workspace">
        <header className="workspace__toolbar">
          <div className="workspace__brand">
            <Link
              to="/"
              className="workspace__brand-link"
              onClick={(e) => {
                e.preventDefault();
                navigateBack();
              }}
            >
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
          onQuoteInChat={() => {}}
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
          <Link
            to="/"
            className="workspace__brand-link"
            onClick={(e) => {
              e.preventDefault();
              navigateBack();
            }}
          >
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
              onChangeUsername={(value) => {
                updateWorkspace((c) =>
                  c ? { ...c, settings: { ...c.settings, username: value } } : c,
                );
                void persistSettings({ username: value });
              }}
              onChangeProviderMode={(mode) => {
                const model = defaultModelForProvider(mode);
                updateWorkspace((c) =>
                  c ? { ...c, settings: { ...c.settings, providerMode: mode, model } } : c,
                );
                void persistSettings({ providerMode: mode, model });
              }}
              onChangeModel={(model) => {
                updateWorkspace((c) =>
                  c ? { ...c, settings: { ...c.settings, model } } : c,
                );
                void persistSettings({ model });
              }}
              onChangeOpenRouterKey={(value) => {
                updateWorkspace((c) =>
                  c
                    ? { ...c, settings: { ...c.settings, byoOpenRouterKey: value } }
                    : c,
                );
                void persistSettings({ byoOpenRouterKey: value });
              }}
              onChangeOpenAiKey={(value) => {
                updateWorkspace((c) =>
                  c
                    ? { ...c, settings: { ...c.settings, byoOpenAiKey: value } }
                    : c,
                );
                void persistSettings({ byoOpenAiKey: value });
              }}
            />
          )}

          {activeDocument && settings ? (
            <ShareDialog
              document={activeDocument}
              threads={threads}
              deviceId={settings.deviceId}
              username={settings.username}
            />
          ) : null}

          <button
            className="btn btn-ghost"
            onClick={toggleSidebar}
            type="button"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <SidebarIcon />
          </button>
        </div>
      </header>

      <PdfViewer
        document={activeDocument}
        selectedThreadId={resolvedThreadId}
        threads={viewerThreads}
        onCreateComment={handleCreateComment}
        onQuoteInChat={handleQuoteInChat}
        onSelectThread={handleHighlightClick}
      />

      {showPopover && popoverThread && (
        <CommentPopover
          thread={popoverThread}
          anchorElement={popoverAnchor}
          open={showPopover}
          onClose={closePopover}
          onExpand={handleExpandToSidebar}
          onSend={handleSendPopoverMessage}
          isSending={sendMessageMutation.isPending}
        />
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        threads={threads}
        activeThreadId={resolvedThreadId}
        activeThread={activeThread}
        isSending={sendMessageMutation.isPending}
        quotes={quotes}
        onSendMessage={handleSendMessage}
        onSelectThread={handleSelectThread}
        onCreateThread={handleCreateThread}
        onDeleteThread={handleDeleteThread}
        onRenameThread={handleRenameThread}
        onClearAllComments={handleClearAllComments}
        onRemoveQuote={(index) => setQuotes((prev) => prev.filter((_, i) => i !== index))}
        onClearQuotes={() => setQuotes([])}
        onQuoteClick={handleScrollToPage}
        onPageClick={handleScrollToPage}
        onAnchorClick={handleScrollToAnchor}
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
