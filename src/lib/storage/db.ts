import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { AppDocument, AppSettings, AppThread } from '../../../shared/contracts'
import { DEFAULT_OPENROUTER_MODEL } from '../../../shared/models'
import { generateDisplayName } from '../name-generator'
import { createDemoThreads, shouldSeedDemoThreads } from '../pdf/demo-seed'

interface SettingsRecord {
  key: 'app'
  value: AppSettings
}

interface PdfCoworkerDB extends DBSchema {
  documents: {
    key: string
    value: AppDocument
  }
  threads: {
    key: string
    value: AppThread
    indexes: {
      'by-document': string
      'by-updated-at': string
    }
  }
  settings: {
    key: 'app'
    value: SettingsRecord
  }
}

const DATABASE_NAME = 'pdf-coworker-db'
const DATABASE_VERSION = 2

const defaultSettings = (): AppSettings => ({
  activeDocumentId: null,
  byoOpenRouterKey: '',
  byoOpenAiKey: '',
  model: DEFAULT_OPENROUTER_MODEL,
  providerMode: 'shared',
  sessionId: crypto.randomUUID(),
  deviceId: crypto.randomUUID(),
  username: generateDisplayName(),
})

let dbPromise: Promise<IDBPDatabase<PdfCoworkerDB>> | null = null

const getDatabase = () => {
  if (!dbPromise) {
    dbPromise = openDB<PdfCoworkerDB>(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 2 && database.objectStoreNames.contains('threads')) {
          database.deleteObjectStore('threads')
        }

        if (!database.objectStoreNames.contains('documents')) {
          database.createObjectStore('documents', { keyPath: 'id' })
        }

        if (!database.objectStoreNames.contains('threads')) {
          const threadStore = database.createObjectStore('threads', { keyPath: 'id' })
          threadStore.createIndex('by-document', 'documentId')
          threadStore.createIndex('by-updated-at', 'updatedAt')
        }

        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' })
        }
      },
    })
  }

  return dbPromise
}

export const getSettings = async (): Promise<AppSettings> => {
  const database = await getDatabase()
  const record = await database.get('settings', 'app')

  if (record) {
    const merged = { ...defaultSettings(), ...record.value }
    return merged
  }

  const settings = defaultSettings()
  await database.put('settings', { key: 'app', value: settings })

  return settings
}

export const updateSettings = async (partial: Partial<AppSettings>): Promise<AppSettings> => {
  const database = await getDatabase()
  const current = await getSettings()
  const next = { ...current, ...partial }

  await database.put('settings', { key: 'app', value: next })

  return next
}

export const saveDocument = async (document: AppDocument) => {
  const database = await getDatabase()

  await database.put('documents', document)
}

export const getDocument = async (documentId: string) => {
  const database = await getDatabase()

  return database.get('documents', documentId)
}

export const listDocuments = async () => {
  const database = await getDatabase()
  const all = await database.getAll('documents')

  return all.filter((doc) => !doc.hidden)
}

export const listAllDocuments = async () => {
  const database = await getDatabase()

  return database.getAll('documents')
}

export const saveThread = async (thread: AppThread) => {
  const database = await getDatabase()

  await database.put('threads', thread)
}

export const getThreadsByDocumentId = async (documentId: string) => {
  const database = await getDatabase()
  const threads = await database.getAllFromIndex('threads', 'by-document', documentId)

  return threads.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export const deleteDocument = async (documentId: string): Promise<void> => {
  const database = await getDatabase()
  const tx = database.transaction(['documents', 'threads', 'settings'], 'readwrite')

  const doc = await tx.objectStore('documents').get(documentId)
  if (doc?.isDemo) {
    await tx.objectStore('documents').put({ ...doc, hidden: true })
  } else {
    await tx.objectStore('documents').delete(documentId)
  }

  const threads = await tx.objectStore('threads').index('by-document').getAllKeys(documentId)
  for (const key of threads) {
    await tx.objectStore('threads').delete(key)
  }

  const settingsRecord = await tx.objectStore('settings').get('app')
  if (settingsRecord?.value.activeDocumentId === documentId) {
    await tx.objectStore('settings').put({
      key: 'app',
      value: { ...settingsRecord.value, activeDocumentId: null },
    })
  }

  await tx.done
}

export const getOrCreateGlobalThread = async (documentId: string): Promise<AppThread> => {
  const database = await getDatabase()
  const existing = await database.get('threads', `global:${documentId}`)

  if (existing) {
    return existing
  }

  const globalThread: AppThread = {
    id: `global:${documentId}`,
    documentId,
    kind: 'global',
    title: 'Chat',
    anchor: null,
    messages: [],
    updatedAt: new Date().toISOString(),
  }

  await database.put('threads', globalThread)

  return globalThread
}

export const createChatThread = async (documentId: string): Promise<AppThread> => {
  const database = await getDatabase()
  const allThreads = await database.getAllFromIndex('threads', 'by-document', documentId)
  const chatCount = allThreads.filter((t) => t.kind === 'global').length

  const thread: AppThread = {
    id: crypto.randomUUID(),
    documentId,
    kind: 'global',
    title: `Chat ${chatCount + 1}`,
    anchor: null,
    messages: [],
    updatedAt: new Date().toISOString(),
  }

  await database.put('threads', thread)

  return thread
}

export const deleteThread = async (threadId: string): Promise<void> => {
  const database = await getDatabase()
  await database.delete('threads', threadId)
}

export const deleteAllAnchorThreads = async (documentId: string): Promise<void> => {
  const database = await getDatabase()
  const threads = await database.getAllFromIndex('threads', 'by-document', documentId)
  const tx = database.transaction('threads', 'readwrite')

  for (const thread of threads) {
    if (thread.kind === 'anchor') {
      await tx.store.delete(thread.id)
    }
  }

  await tx.done
}

export const renameThread = async (threadId: string, title: string): Promise<AppThread | null> => {
  const database = await getDatabase()
  const thread = await database.get('threads', threadId)
  if (!thread) return null

  const updated = { ...thread, title }
  await database.put('threads', updated)
  return updated
}

export interface DocumentWorkspace {
  document: AppDocument
  settings: AppSettings
  threads: AppThread[]
}

export const getDocumentWorkspace = async (documentId: string): Promise<DocumentWorkspace | null> => {
  const settings = await getSettings()
  const document = await getDocument(documentId)

  if (!document) return null

  const globalThread = await getOrCreateGlobalThread(documentId)
  let threads = await getThreadsByDocumentId(documentId)

  if (document.isDemo && shouldSeedDemoThreads(threads)) {
    const seededThreads = createDemoThreads(document, settings, globalThread)
    for (const thread of seededThreads) {
      await saveThread(thread)
    }
    threads = await getThreadsByDocumentId(documentId)
  }

  return { document, settings, threads }
}

export interface AppBootstrap {
  activeDocument: AppDocument | null
  documents: AppDocument[]
  settings: AppSettings
  threads: AppThread[]
}

export const getAppBootstrap = async (): Promise<AppBootstrap> => {
  const settings = await getSettings()
  const documents = await listDocuments()

  if (!settings.activeDocumentId) {
    return {
      activeDocument: null,
      documents,
      settings,
      threads: [],
    }
  }

  const activeDocument = await getDocument(settings.activeDocumentId)

  if (!activeDocument) {
    const nextSettings = await updateSettings({ activeDocumentId: null })

    return {
      activeDocument: null,
      documents,
      settings: nextSettings,
      threads: [],
    }
  }

  const globalThread = await getOrCreateGlobalThread(activeDocument.id)
  let threads = await getThreadsByDocumentId(activeDocument.id)

  if (activeDocument.isDemo && shouldSeedDemoThreads(threads)) {
    const seededThreads = createDemoThreads(activeDocument, settings, globalThread)
    for (const thread of seededThreads) {
      await saveThread(thread)
    }
    threads = await getThreadsByDocumentId(activeDocument.id)
  }

  return {
    activeDocument,
    documents,
    settings,
    threads,
  }
}
