import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import type { AppDocument, AppSettings } from '../../../shared/contracts'
import {
  type AppBootstrap,
  deleteDocument,
  getAppBootstrap,
  saveDocument,
  setDocumentSyncEnabled,
  updateSettings,
} from '../../lib/storage/db'
import { ChatCircleDots, CloudCheck, CloudSlash } from '@phosphor-icons/react'
import { fetchSyncStatus } from '../../lib/sync/sync-client'
import { defaultModelForProvider } from '../../../shared/models'
import { hasSeenOnboardingCookie, markOnboardingSeenCookie } from '../../lib/browser/onboarding-cookie'
import { extractDocumentFromFile } from '../../lib/pdf/extract-document'
import { loadDemoPdfIfNeeded } from '../../lib/pdf/load-demo'
import { SettingsDialog } from '../settings/SettingsPanel'
import { OnboardingDialog } from './OnboardingDialog'
import { PdfThumbnail } from './PdfThumbnail'

import './library.css'

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const LibraryPage = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => hasSeenOnboardingCookie())
  const [dragging, setDragging] = useState(false)
  const [newDocId, setNewDocId] = useState<string | null>(null)
  const [transitioningId, setTransitioningId] = useState<string | null>(null)
  const dragCounter = useRef(0)

  const { data: bootstrap } = useQuery({
    queryKey: ['app-bootstrap'],
    queryFn: getAppBootstrap,
  })

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: fetchSyncStatus,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!bootstrap || bootstrap.documents.length > 0) return

    loadDemoPdfIfNeeded().then((result) => {
      if (!result) return
      queryClient.setQueryData<AppBootstrap | undefined>(['app-bootstrap'], () => ({
        activeDocument: result.document,
        documents: [result.document],
        settings: result.settings,
        threads: [result.globalThread],
      }))
    })
  }, [bootstrap, queryClient])

  const documents = bootstrap?.documents ?? []
  const totalSize = documents.reduce((sum, d) => sum + d.blob.size, 0)
  const onboardingOpen = !!bootstrap && !hasSeenOnboarding
  const syncEnabled = !!syncStatus?.enabled

  const chatCountByDoc = new Map<string, number>()
  for (const thread of bootstrap?.threads ?? []) {
    if (thread.messages.length === 0) continue
    chatCountByDoc.set(thread.documentId, (chatCountByDoc.get(thread.documentId) ?? 0) + 1)
  }

  const handleDismissOnboarding = useCallback(() => {
    markOnboardingSeenCookie()
    setHasSeenOnboarding(true)
  }, [])

  const navigateToDoc = useCallback(
    (docId: string) => {
      const go = () => navigate({ to: '/doc/$id', params: { id: docId } })

      if (!('startViewTransition' in document)) {
        go()
        return
      }

      ;(document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(
        () => flushSync(go),
      )
    },
    [navigate],
  )

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const doc = await extractDocumentFromFile(file)
      await saveDocument(doc)
      await updateSettings({ activeDocumentId: doc.id })
      return doc
    },
    onSuccess: (doc) => {
      queryClient.setQueryData<AppBootstrap | undefined>(['app-bootstrap'], (c) => {
        if (!c) return c
        return {
          ...c,
          documents: [doc, ...c.documents],
          activeDocument: doc,
          settings: { ...c.settings, activeDocumentId: doc.id },
        }
      })
      setNewDocId(doc.id)

      requestAnimationFrame(() => {
        document.querySelector('.library__grid')?.scrollTo({ top: 0, behavior: 'smooth' })
      })

      setTimeout(() => {
        flushSync(() => setTransitioningId(doc.id))
        navigateToDoc(doc.id)
      }, 600)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] })
      setConfirmingId(null)
    },
  })

  const persistSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const next = await updateSettings(partial)
      queryClient.setQueryData<AppBootstrap | undefined>(['app-bootstrap'], (c) =>
        c ? { ...c, settings: next } : c,
      )
    },
    [queryClient],
  )

  const toggleSyncMutation = useMutation({
    mutationFn: ({ id, syncEnabled }: { id: string; syncEnabled: boolean }) =>
      setDocumentSyncEnabled(id, syncEnabled),
    onSuccess: (updated) => {
      if (!updated) return
      queryClient.setQueryData<AppBootstrap | undefined>(['app-bootstrap'], (c) =>
        c
          ? {
              ...c,
              documents: c.documents.map((d) => (d.id === updated.id ? updated : d)),
              activeDocument:
                c.activeDocument?.id === updated.id ? updated : c.activeDocument,
            }
          : c,
      )
    },
  })

  const handleOpen = async (doc: AppDocument) => {
    await updateSettings({ activeDocumentId: doc.id })
    queryClient.setQueryData<AppBootstrap | undefined>(['app-bootstrap'], (c) =>
      c ? { ...c, activeDocument: doc, settings: { ...c.settings, activeDocumentId: doc.id } } : c,
    )
    flushSync(() => setTransitioningId(doc.id))
    navigateToDoc(doc.id)
  }

  const handleDelete = (docId: string) => {
    if (confirmingId === docId) {
      deleteMutation.mutate(docId)
    } else {
      setConfirmingId(docId)
    }
  }

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
    event.target.value = ''
  }

  const handleFileDrop = useCallback(
    (file: File) => {
      if (file.type !== 'application/pdf') return
      uploadMutation.mutate(file)
    },
    [uploadMutation],
  )

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current += 1
    if (dragCounter.current === 1) setDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current === 0) setDragging(false)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileDrop(file)
    },
    [handleFileDrop],
  )

  return (
    <main
      className={`library ${dragging ? 'library--dragging' : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <OnboardingDialog open={onboardingOpen} onDismiss={handleDismissOnboarding} />

      <header className="library__header">
        <div>
          <h1 className="library__title">pdfation</h1>
          <p className="library__subtitle">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            {documents.length > 0 && <> &middot; {formatBytes(totalSize)} stored</>}
          </p>
        </div>
        <div className="library__header-actions">
          {bootstrap?.settings ? (
            <SettingsDialog
              settings={bootstrap.settings}
              onChangeUsername={(value) => persistSettings({ username: value })}
              onChangeProviderMode={(mode) => {
                const model = defaultModelForProvider(mode)
                persistSettings({ providerMode: mode, model })
              }}
              onChangeModel={(model) => persistSettings({ model })}
              onChangeOpenRouterKey={(value) =>
                persistSettings({ byoOpenRouterKey: value })
              }
              onChangeOpenAiKey={(value) => persistSettings({ byoOpenAiKey: value })}
            />
          ) : null}
          <label className="btn btn-primary library__upload">
            <input accept="application/pdf" onChange={handleUpload} type="file" />
            {uploadMutation.isPending ? 'Importing…' : 'Upload PDF'}
          </label>
        </div>
      </header>

      {documents.length === 0 ? (
        <div className="library__empty">
          <div className="library__empty-icon">
            <EmptyIcon />
          </div>
          <h2>No documents yet</h2>
          <p>Upload a PDF to get started with highlighting, commenting, and AI chat.</p>
          <label className="btn btn-primary">
            <input accept="application/pdf" onChange={handleUpload} type="file" />
            Upload your first PDF
          </label>
        </div>
      ) : (
        <div className="library__grid">
          {documents
            .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
            .map((doc) => {
              const isConfirming = confirmingId === doc.id
              const isNew = newDocId === doc.id
              const isTransitioning = transitioningId === doc.id
              const chatCount = chatCountByDoc.get(doc.id) ?? 0
              const isBackedUp = doc.syncEnabled !== false

              return (
                <div
                  key={doc.id}
                  className={`library__card${isNew ? ' library__card--new' : ''}${isTransitioning ? ' library__card--transitioning' : ''}`}
                >
                  <button
                    className="library__card-link"
                    onClick={() => handleOpen(doc)}
                    type="button"
                  >
                    <div className="library__card-thumb">
                      <PdfThumbnail blob={doc.blob} />
                    </div>
                    <div className="library__card-overlay">
                      <span className="library__card-name">{doc.name}</span>
                      <span className="library__card-meta">
                        <span>
                          {doc.pageCount} pg &middot; {formatBytes(doc.blob.size)}
                        </span>
                        {chatCount > 0 ? (
                          <span className="library__card-meta-item">
                            <ChatCircleDots size={12} weight="fill" />
                            {chatCount} {chatCount === 1 ? 'chat' : 'chats'}
                          </span>
                        ) : null}
                        {syncEnabled ? (
                          <span
                            className={`library__card-meta-item ${isBackedUp ? 'library__card-meta-item--on' : 'library__card-meta-item--off'}`}
                          >
                            {isBackedUp ? (
                              <CloudCheck size={12} weight="fill" />
                            ) : (
                              <CloudSlash size={12} />
                            )}
                            {isBackedUp ? 'Backed up' : 'Not synced'}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </button>

                  {syncEnabled ? (
                    <button
                      className="library__card-sync-toggle"
                      onClick={() =>
                        toggleSyncMutation.mutate({
                          id: doc.id,
                          syncEnabled: !isBackedUp,
                        })
                      }
                      type="button"
                      aria-label={isBackedUp ? 'Exclude from sync' : 'Include in sync'}
                      title={isBackedUp ? 'Exclude from sync' : 'Include in sync'}
                    />
                  ) : null}

                  <button
                    className={`library__card-delete ${isConfirming ? 'library__card-delete--confirm' : ''}`}
                    onClick={() => handleDelete(doc.id)}
                    onBlur={() => setConfirmingId(null)}
                    type="button"
                    title={isConfirming ? 'Click again to confirm' : 'Delete document'}
                  >
                    {isConfirming ? 'Delete?' : <TrashIcon />}
                  </button>
                </div>
              )
            })}
        </div>
      )}
    </main>
  )
}

const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)
