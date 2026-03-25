import OpenAI from 'openai'

import type { ChatRequestPayload, ChatResponsePayload } from '../../../shared/contracts'

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4.1-mini'
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

const toSourcePages = (payload: ChatRequestPayload) =>
  Array.from(new Set(payload.context.snippets.map((snippet) => snippet.pageNumber))).sort(
    (left, right) => left - right,
  )

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

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an AI coworker reviewing a PDF with the user. Be concise, grounded, and honest about uncertainty. When the thread is anchored to a highlighted passage, respond specifically about that text. Use page references like [p. 3] whenever the provided context supports them.',
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            document: payload.document,
            thread: payload.thread,
            prompt: payload.prompt,
            context: payload.context,
          },
          null,
          2,
        ),
      },
    ],
  })
  const content = response.choices[0]?.message.content?.trim()

  if (!content) {
    throw new Error('OpenRouter returned an empty response.')
  }

  return {
    reply: {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
      sourcePages: toSourcePages(payload),
    },
  }
}
