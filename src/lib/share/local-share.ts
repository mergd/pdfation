import type { AppDocument, AppThread } from '../../../shared/contracts'
import type { DocumentShareBundleV1 } from '../../../shared/share'
import { base64ToBlob, blobToBase64 } from './blob'
import { saveDocument, saveThread, updateSettings } from '../storage/db'

const normalizeSharedByName = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeThreadsForShare = (
  threads: AppThread[],
  sharedByName: string | null,
): AppThread[] =>
  threads.map((thread) => ({
    ...thread,
    messages: thread.messages.map((message) =>
      message.role === 'user'
        ? {
            ...message,
            authorName: message.authorName ?? sharedByName,
          }
        : message,
    ),
  }))

export const createShareBundle = async (
  document: AppDocument,
  threads: AppThread[],
  deviceId: string,
  username: string,
): Promise<DocumentShareBundleV1> => {
  const sharedAt = new Date().toISOString()
  const sharedByName = normalizeSharedByName(username)

  return {
    version: 1,
    sharedAt,
    expiresAt: sharedAt,
    sharedByDeviceId: deviceId,
    sharedByName,
    document: {
      originalDocumentId: document.id,
      name: document.name,
      pageCount: document.pageCount,
      uploadedAt: document.uploadedAt,
      pages: document.pages,
      chunks: document.chunks,
      isDemo: document.isDemo,
      hidden: false,
      file: {
        base64: await blobToBase64(document.blob),
        mimeType: document.blob.type || 'application/pdf',
      },
    },
    threads: normalizeThreadsForShare(threads, sharedByName),
  }
}

export const importShareBundle = async (bundle: DocumentShareBundleV1) => {
  const documentId = crypto.randomUUID()
  const importedAt = new Date().toISOString()
  const document: AppDocument = {
    id: documentId,
    name: bundle.document.name,
    blob: base64ToBlob(bundle.document.file.base64, bundle.document.file.mimeType),
    pageCount: bundle.document.pageCount,
    uploadedAt: importedAt,
    pages: bundle.document.pages,
    chunks: bundle.document.chunks,
    isDemo: false,
    hidden: false,
  }

  let assignedPrimaryGlobalThread = false
  const threads = bundle.threads.map((thread) => {
    const isPrimaryGlobalThread = thread.kind === 'global' && !assignedPrimaryGlobalThread

    if (isPrimaryGlobalThread) {
      assignedPrimaryGlobalThread = true
    }

    return {
      ...thread,
      id: isPrimaryGlobalThread ? `global:${documentId}` : crypto.randomUUID(),
      documentId,
    }
  })

  await saveDocument(document)
  await Promise.all(threads.map((thread) => saveThread(thread)))
  await updateSettings({ activeDocumentId: documentId })

  return document
}
