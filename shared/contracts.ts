export type ProviderMode = 'shared' | 'byo' | 'openai'

export type ThreadKind = 'global' | 'anchor'

export type ChatRole = 'user' | 'assistant'

export interface DocumentPage {
  pageNumber: number
  text: string
}

export interface DocumentChunk {
  id: string
  pageNumber: number
  text: string
}

export interface AppDocument {
  id: string
  name: string
  blob: Blob
  pageCount: number
  uploadedAt: string
  pages: DocumentPage[]
  chunks: DocumentChunk[]
  isDemo?: boolean
  hidden?: boolean
}

export interface ThreadAnchor {
  pageNumber: number
  selectedText: string
  textPrefix: string
  textSuffix: string
}

export interface AppMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  sourcePages: number[]
  authorDeviceId?: string | null
  authorName?: string | null
}

export interface AppThread {
  id: string
  documentId: string
  kind: ThreadKind
  title: string
  anchor: ThreadAnchor | null
  messages: AppMessage[]
  updatedAt: string
}

export interface AppSettings {
  activeDocumentId: string | null
  byoOpenRouterKey: string
  byoOpenAiKey: string
  model: string
  providerMode: ProviderMode
  sessionId: string
  deviceId: string
  username: string
}

export interface SourceReference {
  pageNumber: number
  snippet: string
}

export interface ChatRequestPayload {
  providerMode: ProviderMode
  byoOpenRouterKey?: string
  byoOpenAiKey?: string
  model?: string
  sessionId: string
  document: {
    id: string
    name: string
    pageCount: number
  }
  thread: {
    id: string
    kind: ThreadKind
    title: string
    anchor: ThreadAnchor | null
    history: AppMessage[]
  }
  prompt: string
  context: {
    summary: string
    snippets: SourceReference[]
  }
  pages: { pageNumber: number; text: string }[]
}

export interface ChatResponsePayload {
  reply: AppMessage
}
