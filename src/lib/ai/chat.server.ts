import OpenAI from 'openai'

import type { ChatRequestPayload, ChatResponsePayload } from '../../../shared/contracts'
import { DEFAULT_OPENROUTER_MODEL, DEFAULT_OPENAI_MODEL } from '../../../shared/models'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

const SYSTEM_PROMPT =
  'You are an AI coworker reviewing a PDF with the user. Be concise, grounded, and honest about uncertainty. When the thread is anchored to a highlighted passage, respond specifically about that text. Use page references like [p. 3] whenever the provided context supports them.'

const toSourcePages = (payload: ChatRequestPayload) =>
  Array.from(new Set(payload.context.snippets.map((snippet) => snippet.pageNumber))).sort(
    (left, right) => left - right,
  )

const buildUserContent = (payload: ChatRequestPayload) =>
  JSON.stringify(
    {
      document: payload.document,
      thread: payload.thread,
      prompt: payload.prompt,
      context: payload.context,
    },
    null,
    2,
  )

const toReply = (content: string, payload: ChatRequestPayload): ChatResponsePayload => ({
  reply: {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    createdAt: new Date().toISOString(),
    sourcePages: toSourcePages(payload),
  },
})

export const createOpenRouterReply = async (
  payload: ChatRequestPayload,
): Promise<ChatResponsePayload> => {
  const key =
    payload.providerMode === 'byo'
      ? payload.byoOpenRouterKey?.trim()
      : process.env.OPENROUTER_API_KEY?.trim()

  if (!key) {
    throw new Error(
      payload.providerMode === 'byo'
        ? 'No BYO OpenRouter key was provided.'
        : 'The shared OpenRouter key is not configured on the server.',
    )
  }

  const client = new OpenAI({
    apiKey: key,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'http://localhost:5173',
      'X-Title': 'PDF Coworker',
    },
  })

  const model = payload.model || DEFAULT_OPENROUTER_MODEL

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserContent(payload) },
    ],
  })

  const content = response.choices[0]?.message.content?.trim()
  if (!content) throw new Error('OpenRouter returned an empty response.')

  return toReply(content, payload)
}

export const createOpenAiReply = async (
  payload: ChatRequestPayload,
): Promise<ChatResponsePayload> => {
  const key = payload.byoOpenAiKey?.trim()

  if (!key) {
    throw new Error('No OpenAI API key was provided.')
  }

  const client = new OpenAI({ apiKey: key })
  const model = payload.model || DEFAULT_OPENAI_MODEL

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserContent(payload) },
    ],
  })

  const content = response.choices[0]?.message.content?.trim()
  if (!content) throw new Error('OpenAI returned an empty response.')

  return toReply(content, payload)
}
