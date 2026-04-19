import type { AppDocument, AppSettings, AppThread } from '../../../shared/contracts'
import type { SyncBundleV1, SyncedDocument } from '../../../shared/sync'
import { MAX_SYNC_BUNDLE_BYTES } from '../../../shared/sync'
import { base64ToBlob, blobToBase64 } from '../share/blob'
import {
  listAllDocuments,
  listAllThreads,
  saveDocument,
  saveThread,
} from '../storage/db'

const encoder = new TextEncoder()

const isDocumentSyncEnabled = (doc: AppDocument) => doc.syncEnabled !== false

const toSyncedDocument = async (doc: AppDocument): Promise<SyncedDocument> => ({
  originalDocumentId: doc.id,
  name: doc.name,
  pageCount: doc.pageCount,
  uploadedAt: doc.uploadedAt,
  pages: doc.pages,
  chunks: doc.chunks,
  isDemo: doc.isDemo,
  file: {
    base64: await blobToBase64(doc.blob),
    mimeType: doc.blob.type || 'application/pdf',
  },
})

export interface BuildSyncBundleResult {
  bundle: SyncBundleV1
  byteSize: number
  overLimit: boolean
  excludedForLimit: AppDocument[]
}

export const buildSyncBundle = async (
  settings: AppSettings,
): Promise<BuildSyncBundleResult> => {
  const [allDocuments, allThreads] = await Promise.all([
    listAllDocuments(),
    listAllThreads(),
  ])

  const eligible = allDocuments.filter(
    (doc) => !doc.hidden && isDocumentSyncEnabled(doc),
  )

  const syncedDocs: SyncedDocument[] = []
  const excludedForLimit: AppDocument[] = []

  const baseBundle = (documents: SyncedDocument[]): SyncBundleV1 => ({
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBySessionId: '',
    updatedByDeviceName: '',
    settings: {
      byoOpenRouterKey: settings.byoOpenRouterKey,
      byoOpenAiKey: settings.byoOpenAiKey,
      model: settings.model,
      providerMode: settings.providerMode,
      username: settings.username,
    },
    documents,
    threads: allThreads,
  })

  const sortedBySize = [...eligible].sort((a, b) => a.blob.size - b.blob.size)

  for (const doc of sortedBySize) {
    const next = await toSyncedDocument(doc)
    const candidate = baseBundle([...syncedDocs, next])
    const candidateBytes = encoder.encode(JSON.stringify(candidate)).byteLength
    if (candidateBytes > MAX_SYNC_BUNDLE_BYTES) {
      excludedForLimit.push(doc)
      continue
    }
    syncedDocs.push(next)
  }

  const bundle = baseBundle(syncedDocs)
  const byteSize = encoder.encode(JSON.stringify(bundle)).byteLength

  return {
    bundle,
    byteSize,
    overLimit: excludedForLimit.length > 0,
    excludedForLimit,
  }
}

export interface ApplyBundleResult {
  mergedDocumentIds: string[]
  mergedThreadIds: string[]
}

export const applySyncBundle = async (
  bundle: SyncBundleV1,
): Promise<ApplyBundleResult> => {
  const existingDocs = await listAllDocuments()
  const existingById = new Map(existingDocs.map((d) => [d.id, d]))
  const mergedDocumentIds: string[] = []

  for (const remote of bundle.documents) {
    const existing = existingById.get(remote.originalDocumentId)
    const merged: AppDocument = {
      id: remote.originalDocumentId,
      name: remote.name,
      blob: base64ToBlob(remote.file.base64, remote.file.mimeType),
      pageCount: remote.pageCount,
      uploadedAt: remote.uploadedAt,
      pages: remote.pages,
      chunks: remote.chunks,
      isDemo: existing?.isDemo ?? remote.isDemo,
      hidden: existing?.hidden ?? false,
      syncEnabled: existing?.syncEnabled ?? true,
    }
    await saveDocument(merged)
    mergedDocumentIds.push(merged.id)
  }

  const mergedThreadIds: string[] = []
  const existingThreads = await listAllThreads()
  const threadById = new Map<string, AppThread>(
    existingThreads.map((t) => [t.id, t]),
  )

  for (const remote of bundle.threads) {
    const local = threadById.get(remote.id)
    if (!local || remote.updatedAt > local.updatedAt) {
      await saveThread(remote)
      mergedThreadIds.push(remote.id)
    }
  }

  return { mergedDocumentIds, mergedThreadIds }
}
