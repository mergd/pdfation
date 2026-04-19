import type { AppThread, ProviderMode } from './contracts'
import type { SharedDocumentFile } from './share'

export const SYNC_COOKIE_NAME = 'pdfation_sync'
export const SYNC_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
export const SYNC_MAGIC_LINK_TTL_SECONDS = 60 * 30
export const MAX_SYNC_BUNDLE_BYTES = 10 * 1024 * 1024

export interface SyncAccount {
  id: string
  createdAt: string
  masterSessionId: string
}

export interface SyncSession {
  id: string
  accountId: string
  deviceName: string
  createdAt: string
  lastSeenAt: string
  isMaster: boolean
  revokedAt: string | null
}

export interface SyncMagicLink {
  token: string
  accountId: string
  createdBySessionId: string
  expiresAt: string
  consumed: boolean
}

export interface SyncedSettings {
  byoOpenRouterKey: string
  byoOpenAiKey: string
  model: string
  providerMode: ProviderMode
  username: string
}

export interface SyncedDocument {
  originalDocumentId: string
  name: string
  pageCount: number
  uploadedAt: string
  pages: { pageNumber: number; text: string }[]
  chunks: { id: string; pageNumber: number; text: string }[]
  isDemo?: boolean
  file: SharedDocumentFile
}

export interface SyncBundleV1 {
  version: 1
  updatedAt: string
  updatedBySessionId: string
  updatedByDeviceName: string
  settings: SyncedSettings
  documents: SyncedDocument[]
  threads: AppThread[]
}

export interface SyncStatusView {
  enabled: boolean
  account: { id: string; createdAt: string } | null
  currentSession: Omit<SyncSession, 'accountId'> | null
  sessions: Omit<SyncSession, 'accountId'>[]
  bundle: {
    updatedAt: string
    updatedByDeviceName: string
    byteSize: number
    documentCount: number
    threadCount: number
  } | null
}
