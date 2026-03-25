import type { ChatRequestPayload, ChatResponsePayload } from '../../../shared/contracts'
import { sendChatRequest as sendChatRequestServerFn } from './chat.functions'

export const sendChatRequest = async (payload: ChatRequestPayload): Promise<ChatResponsePayload> =>
  sendChatRequestServerFn({ data: payload })
