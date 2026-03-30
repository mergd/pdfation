import OpenAI from 'openai'

import type { ProviderMode } from '../../../shared/contracts'
import { DEFAULT_OPENROUTER_MODEL, DEFAULT_OPENAI_MODEL } from '../../../shared/models'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

interface GenerateTitleInput {
  providerMode: ProviderMode
  byoOpenRouterKey?: string
  byoOpenAiKey?: string
  model?: string
  userMessage: string
  assistantMessage: string
  documentName: string
}

export async function generateThreadTitle(input: GenerateTitleInput): Promise<string> {
  const isOpenAi = input.providerMode === 'openai'

  const key = isOpenAi
    ? input.byoOpenAiKey?.trim()
    : input.providerMode === 'byo'
      ? input.byoOpenRouterKey?.trim()
      : process.env.OPENROUTER_API_KEY?.trim()

  if (!key) throw new Error('No API key available for title generation.')

  const client = new OpenAI({
    apiKey: key,
    ...(isOpenAi
      ? {}
      : {
          baseURL: OPENROUTER_BASE_URL,
          defaultHeaders: {
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'http://localhost:5173',
            'X-Title': 'PDF Coworker',
          },
        }),
  })

  const model = isOpenAi
    ? (input.model || DEFAULT_OPENAI_MODEL)
    : (input.model || DEFAULT_OPENROUTER_MODEL)

  const response = await client.chat.completions.create({
    model,
    max_tokens: 30,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'thread_title',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'A short, descriptive title for this conversation (3-8 words).',
            },
          },
          required: ['title'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: `Generate a short title (3-8 words) for a chat about the document "${input.documentName}". The title should capture the topic of the user's question. Return JSON with a "title" field.`,
      },
      { role: 'user', content: input.userMessage.slice(0, 500) },
      { role: 'assistant', content: input.assistantMessage.slice(0, 500) },
      { role: 'user', content: 'Generate a short title for this conversation.' },
    ],
  })

  const raw = response.choices[0]?.message.content?.trim() ?? ''
  const parsed = JSON.parse(raw) as { title: string }
  return parsed.title.slice(0, 60)
}
