import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppDocument, AppMessage, AppSettings, AppThread } from '../../../shared/contracts'
import { PdfViewer } from '../pdf-viewer/PdfViewer'
import { CommentPopover } from '../pdf-viewer/CommentPopover'
import { Sidebar } from '../sidebar/Sidebar'
import { buildDocumentContext } from '../../lib/ai/context'
import { sendChatRequest } from '../../lib/ai/chat-client'
import { extractDocumentFromFile } from '../../lib/pdf/extract-document'
import { loadDemoPdfIfNeeded } from '../../lib/pdf/load-demo'
import {
  type AppBootstrap,
  getAppBootstrap,
  getOrCreateGlobalThread,
  saveDocument,
  saveThread,
  updateSettings,
} from '../../lib/storage/db'

import './workspace.css'

type SidebarTab = 'chat' | 'comments'
const EMPTY_THREADS: AppThread[] = []

const replaceThread = (threads: AppThread[], next: AppThread) =>
  [...threads.filter((t) => t.id !== next.id), next].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )

const createMessage = (
  role: AppMessage['role'],
  content: string,
  sourcePages: number[] = [],
): AppMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt: new Date().toISOString(),
  sourcePages,
})

export const WorkspacePage = () => {
  const queryClient = useQueryClient()
  const bootstrapQuery = useQuery({ queryKey: ['app-bootstrap'], queryFn: getAppBootstrap })

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat')
  const [quotedText, setQuotedText] = useState<string | null>(null)
  const [popoverThreadId, setPopoverThreadId] = useState<string | null>(null)

  const updateBootstrap = (updater: (c: AppBootstrap | undefined) => AppBootstrap | undefined) => {
    queryClient.setQueryData<AppBootstrap | undefined>(['app-bootstrap'], updater)
  }

  useEffect(() => {
    if (!bootstrapQuery.data || bootstrapQuery.data.activeDocument) return

    loadDemoPdfIfNeeded().then((result) => {
      if (!result) return
      updateBootstrap(() => ({
        activeDocument: result.document,
        documents: [result.document],
        settings: result.settings,
        threads: [result.globalThread],
      }))
      setSelectedThreadId(result.globalThread.id)
    })
  }, [bootstrapQuery.data?.activeDocument])

  const bootstrap = bootstrapQuery.data
  const activeDocument: AppDocument | null = bootstrap?.activeDocument ?? null
  const settings: AppSettings | null = bootstrap?.settings ?? null
  const threads: AppThread[] = bootstrap?.threads ?? EMPTY_THREADS

  const globalThread = useMemo(() => threads.find((t) => t.kind === 'global') ?? null, [threads])
  const anchorThreads = useMemo(() => threads.filter((t) => t.kind === 'anchor'), [threads])
  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  )
  const popoverThread = useMemo(
    () => threads.find((t) => t.id === popoverThreadId) ?? null,
    [popoverThreadId, threads],
  )

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const document = await extractDocumentFromFile(file)
      await saveDocument(document)
      const nextSettings = await updateSettings({ activeDocumentId: document.id })
      const global = await getOrCreateGlobalThread(document.id)
      return { document, nextSettings, global }
    },
    onSuccess: ({ document, nextSettings, global }) => {
      updateBootstrap((current) => ({
        activeDocument: document,
        documents: [document, ...(current?.documents ?? []).filter((e) => e.id !== document.id)],
        settings: nextSettings,
        threads: [global],
      }))
      setSelectedThreadId(global.id)
    },
  })

  const sendMessageMutation = useMutation({ mutationFn: sendChatRequest })

  const persistSettings = async (partial: Partial<AppSettings>) => {
    const next = await updateSettings(partial)
    updateBootstrap((current) => (current ? { ...current, settings: next } : current))
  }

  const handleUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
    event.target.value = ''
  }

  const sendToThread = async (thread: AppThread, value: string) => {
    if (!activeDocument || !settings) return

    if (settings.providerMode === 'byo' && !settings.byoOpenRouterKey.trim()) return

    const userMessage = createMessage('user', value)
    const optimistic: AppThread = {
      ...thread,
      messages: [...thread.messages, userMessage],
      updatedAt: new Date().toISOString(),
    }

    await saveThread(optimistic)
    updateBootstrap((c) => (c ? { ...c, threads: replaceThread(c.threads, optimistic) } : c))
    setSelectedThreadId(optimistic.id)

    try {
      const response = await sendMessageMutation.mutateAsync({
        providerMode: settings.providerMode,
        byoOpenRouterKey: settings.providerMode === 'byo' ? settings.byoOpenRouterKey.trim() : undefined,
        sessionId: settings.sessionId,
        document: { id: activeDocument.id, name: activeDocument.name, pageCount: activeDocument.pageCount },
        thread: {
          id: optimistic.id,
          kind: optimistic.kind,
          title: optimistic.title,
          anchor: optimistic.anchor,
          history: optimistic.messages,
        },
        prompt: value,
        context: buildDocumentContext(activeDocument, optimistic, value),
      })

      const completed: AppThread = {
        ...optimistic,
        messages: [...optimistic.messages, response.reply],
        updatedAt: new Date().toISOString(),
      }
      await saveThread(completed)
      updateBootstrap((c) => (c ? { ...c, threads: replaceThread(c.threads, completed) } : c))
    } catch (error) {
      const failed: AppThread = {
        ...optimistic,
        messages: [
          ...optimistic.messages,
          createMessage('assistant', error instanceof Error ? error.message : 'Request failed.'),
        ],
        updatedAt: new Date().toISOString(),
      }
      await saveThread(failed)
      updateBootstrap((c) => (c ? { ...c, threads: replaceThread(c.threads, failed) } : c))
    }
  }

  const handleSendGlobalMessage = async (value: string) => {
    if (!globalThread) return
    await sendToThread(globalThread, value)
  }

  const handleSendCommentMessage = async (threadId: string, value: string) => {
    const thread = threads.find((t) => t.id === threadId)
    if (!thread) return
    await sendToThread(thread, value)
  }

  const handleCreateComment = async (payload: {
    pageNumber: number
    selectedText: string
    textPrefix: string
    textSuffix: string
  }) => {
    if (!activeDocument) return

    const newThread: AppThread = {
      id: crypto.randomUUID(),
      documentId: activeDocument.id,
      kind: 'anchor',
      title: `Comment on page ${payload.pageNumber}`,
      anchor: {
        pageNumber: payload.pageNumber,
        selectedText: payload.selectedText,
        textPrefix: payload.textPrefix,
        textSuffix: payload.textSuffix,
      },
      messages: [],
      updatedAt: new Date().toISOString(),
    }

    await saveThread(newThread)
    updateBootstrap((c) => (c ? { ...c, threads: replaceThread(c.threads, newThread) } : c))
    setSelectedThreadId(newThread.id)
    setPopoverThreadId(newThread.id)
  }

  const handleQuoteInChat = (text: string) => {
    setQuotedText(text)
    setSidebarOpen(true)
    setSidebarTab('chat')
  }

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId)
    const thread = threads.find((t) => t.id === threadId)

    if (thread?.kind === 'anchor') {
      setPopoverThreadId(threadId)
    }
  }

  const handleExpandToSidebar = () => {
    setPopoverThreadId(null)
    setSidebarOpen(true)
    setSidebarTab('comments')
  }

  return (
    <main className={`workspace ${sidebarOpen ? 'workspace--sidebar-open' : ''}`}>
      <header className="workspace__toolbar">
        <div className="workspace__brand">
          <h1>pdfation</h1>
          {activeDocument && (
            <span className="workspace__doc-name">{activeDocument.name}</span>
          )}
        </div>

        <div className="workspace__actions">
          <label className="btn btn-primary">
            <input accept="application/pdf" onChange={handleUploadChange} type="file" />
            {uploadMutation.isPending ? 'Importing…' : 'Upload'}
          </label>
          <button
            className="btn btn-ghost"
            onClick={() => { setSidebarOpen((v) => !v) }}
            type="button"
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
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

      {popoverThread && popoverThread.kind === 'anchor' && (
        <CommentPopover
          thread={popoverThread}
          anchor={null}
          open={!!popoverThreadId}
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
        globalThread={globalThread}
        anchorThreads={anchorThreads}
        selectedThreadId={selectedThreadId}
        focusedThread={selectedThread?.kind === 'anchor' ? selectedThread : null}
        isSending={sendMessageMutation.isPending}
        quotedText={quotedText}
        settings={settings}
        onSendMessage={handleSendGlobalMessage}
        onSendCommentMessage={handleSendCommentMessage}
        onSelectThread={handleSelectThread}
        onChangeProviderMode={(mode) => {
          updateBootstrap((c) => (c ? { ...c, settings: { ...c.settings, providerMode: mode } } : c))
          void persistSettings({ providerMode: mode })
        }}
        onChangeKey={(value) => {
          updateBootstrap((c) => (c ? { ...c, settings: { ...c.settings, byoOpenRouterKey: value } } : c))
          void persistSettings({ byoOpenRouterKey: value })
        }}
        onClearQuote={() => setQuotedText(null)}
      />
    </main>
  )
}

const SidebarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
)
