import type { ChatRequestPayload, ChatResponsePayload, ProviderMode } from '../../../shared/contracts'
import { sendChatRequest as sendChatRequestServerFn, generateTitle as generateTitleServerFn } from './chat.functions'

export const sendChatRequest = async (payload: ChatRequestPayload): Promise<ChatResponsePayload> =>
  sendChatRequestServerFn({ data: payload })

export interface GenerateTitlePayload {
  providerMode: ProviderMode
  byoOpenRouterKey?: string
  byoOpenAiKey?: string
  model?: string
  userMessage: string
  assistantMessage: string
  documentName: string
}

export const generateChatTitle = async (payload: GenerateTitlePayload): Promise<string | null> => {
  const result = await generateTitleServerFn({ data: payload })
  return result.title ?? null
}
