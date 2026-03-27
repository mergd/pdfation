import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'

import { createOpenRouterReply, createOpenAiReply } from './chat.server'
import { beginRateLimitedRequest } from '../server/rate-limit.server'

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
  sourcePages: z.array(z.number().int().positive()),
})

const anchorSchema = z.object({
  pageNumber: z.number().int().positive(),
  selectedText: z.string().min(1),
  textPrefix: z.string(),
  textSuffix: z.string(),
})

const chatPayloadSchema = z.object({
  providerMode: z.enum(['shared', 'byo', 'openai']),
  byoOpenRouterKey: z.string().optional(),
  byoOpenAiKey: z.string().optional(),
  model: z.string().optional(),
  sessionId: z.string().min(1),
  document: z.object({
    id: z.string(),
    name: z.string(),
    pageCount: z.number().int().positive(),
  }),
  thread: z.object({
    id: z.string(),
    kind: z.enum(['global', 'anchor']),
    title: z.string(),
    anchor: anchorSchema.nullable(),
    history: z.array(messageSchema),
  }),
  prompt: z.string().min(1),
  context: z.object({
    summary: z.string(),
    snippets: z.array(
      z.object({
        pageNumber: z.number().int().positive(),
        snippet: z.string(),
      }),
    ),
  }),
  pages: z.array(
    z.object({
      pageNumber: z.number().int().positive(),
      text: z.string(),
    }),
  ),
})

export const sendChatRequest = createServerFn({ method: 'POST' })
  .inputValidator(chatPayloadSchema)
  .handler(async ({ data }) => {
    const shouldThrottle = data.providerMode === 'shared'

    try {
      if (shouldThrottle) {
        await beginRateLimitedRequest(data.sessionId)
      }

      switch (data.providerMode) {
        case 'shared':
        case 'byo':
          return await createOpenRouterReply(data)
        case 'openai':
          return await createOpenAiReply(data)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chat request failed.'
      const isRateLimited = message.startsWith('429:')

      setResponseStatus(isRateLimited ? 429 : 500)
      throw new Error(isRateLimited ? message.slice(4).trim() : message)
    }
  })
