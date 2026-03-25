import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { AppDocument, AppSettings, AppThread } from '../../../shared/contracts'

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
  providerMode: 'shared',
  sessionId: crypto.randomUUID(),
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
    return record.value
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
    title: 'Document chat',
    anchor: null,
    messages: [],
    updatedAt: new Date().toISOString(),
  }

  await database.put('threads', globalThread)

  return globalThread
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

  await getOrCreateGlobalThread(activeDocument.id)
  const threads = await getThreadsByDocumentId(activeDocument.id)

  return {
    activeDocument,
    documents,
    settings,
    threads,
  }
}
