import type { AppDocument, AppThread } from './contracts'

export const MAX_SHARE_DURATION_SECONDS = 3 * 24 * 60 * 60
export const MAX_TOTAL_SHARED_BYTES = 1024 * 1024 * 1024

export interface SharedDocumentFile {
  base64: string
  mimeType: string
}

export interface SharedDocumentData
  extends Omit<AppDocument, 'blob' | 'id' | 'uploadedAt'> {
  file: SharedDocumentFile
  originalDocumentId: string
  uploadedAt: string
}

export interface DocumentShareBundleV1 {
  version: 1
  sharedAt: string
  expiresAt: string
  sharedByDeviceId: string
  sharedByName: string | null
  document: SharedDocumentData
  threads: AppThread[]
}

export interface ShareRecord {
  token: string
  bundleKey: string
  createdAt: string
  documentName: string
  expiresAt: string
  pageCount: number
  byteSize: number
  sharedByDeviceId: string
  sharedByName: string | null
  originalDocumentId: string
}
