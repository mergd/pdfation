import OpenAI from 'openai'

import type { ChatRequestPayload, ChatResponsePayload } from '../../../shared/contracts'
import { DEFAULT_OPENROUTER_MODEL, DEFAULT_OPENAI_MODEL } from '../../../shared/models'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

const MAX_TOOL_ROUNDS = 5
const MAX_OUTPUT_TOKENS = 4096

const SYSTEM_PROMPT = `You are an AI coworker reviewing a PDF document with the user.

Guidelines:
- Be concise, grounded, and honest about uncertainty.
- When the thread is anchored to a highlighted passage, respond specifically about that text.
- Use page references like [p. 3] when citing specific content.
- Format responses using markdown for readability (bold, lists, etc.).
- You have tools to fetch specific page content from the document. Use them when you need more detail than the provided context — don't hesitate to look up pages for accurate answers.
- Avoid re-stating large blocks of document text verbatim; summarise and cite instead.`

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_page_content',
      description:
        'Retrieve the full extracted text of one or more pages from the PDF. Use this when the initial context is insufficient or you need to verify details on specific pages.',
      parameters: {
        type: 'object',
        properties: {
          pages: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Page numbers to fetch (1-indexed).',
          },
        },
        required: ['pages'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_document',
      description:
        'Search across all pages of the document for content matching a query. Returns the most relevant snippets with page numbers.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keywords or phrase to search for in the document.',
          },
        },
        required: ['query'],
      },
    },
  },
]

function resolveToolCall(
  name: string,
  rawArgs: string,
  pages: ChatRequestPayload['pages'],
): string {
  const args = JSON.parse(rawArgs) as Record<string, unknown>

  switch (name) {
    case 'get_page_content': {
      const requested = args.pages as number[]
      const results = requested.map((num) => {
        const page = pages.find((p) => p.pageNumber === num)
        return page
          ? `[Page ${num}]\n${page.text}`
          : `[Page ${num}] — page not found.`
      })
      return results.join('\n\n---\n\n')
    }

    case 'search_document': {
      const query = (args.query as string).toLowerCase()
      const terms = query.split(/\s+/).filter((t) => t.length > 2)

      const scored = pages
        .map((page) => {
          const lower = page.text.toLowerCase()
          const score = terms.reduce(
            (s, t) => s + (lower.includes(t) ? 1 : 0),
            0,
          )
          return { ...page, score }
        })
        .filter((p) => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      if (scored.length === 0) return 'No matching content found.'

      return scored
        .map((p) => `[Page ${p.pageNumber}] (relevance ${p.score}/${terms.length})\n${p.text.slice(0, 800)}`)
        .join('\n\n---\n\n')
    }

    default:
      return `Unknown tool: ${name}`
  }
}

function buildMessages(
  payload: ChatRequestPayload,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

  const history = payload.thread.history
  const priorMessages = history.slice(0, -1)

  for (const msg of priorMessages) {
    messages.push({ role: msg.role, content: msg.content })
  }

  const contextBlock = [
    payload.context.summary,
    payload.context.snippets.length > 0
      ? 'Relevant excerpts:\n' +
        payload.context.snippets
          .map((s) => `[Page ${s.pageNumber}]: ${s.snippet}`)
          .join('\n\n')
      : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  const userContent =
    priorMessages.length === 0
      ? `Document context:\n${contextBlock}\n\n---\n\n${payload.prompt}`
      : contextBlock
        ? `Updated context:\n${contextBlock}\n\n---\n\n${payload.prompt}`
        : payload.prompt

  messages.push({ role: 'user', content: userContent })

  return messages
}

async function chatWithTools(
  client: OpenAI,
  model: string,
  initialMessages: OpenAI.Chat.ChatCompletionMessageParam[],
  pages: ChatRequestPayload['pages'],
): Promise<string> {
  const messages = [...initialMessages]
  const hasPages = pages.length > 0

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: hasPages ? TOOLS : undefined,
      max_tokens: MAX_OUTPUT_TOKENS,
    })

    const choice = response.choices[0]
    if (!choice) throw new Error('Model returned no choices.')

    const assistantMsg = choice.message

    if (!assistantMsg.tool_calls?.length) {
      return assistantMsg.content?.trim() ?? ''
    }

    messages.push(assistantMsg)

    for (const call of assistantMsg.tool_calls) {
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: resolveToolCall(call.function.name, call.function.arguments, pages),
      })
    }
  }

  const final = await client.chat.completions.create({
    model,
    messages,
    max_tokens: MAX_OUTPUT_TOKENS,
  })

  return final.choices[0]?.message.content?.trim() ?? ''
}

const toSourcePages = (payload: ChatRequestPayload) =>
  Array.from(
    new Set(payload.context.snippets.map((snippet) => snippet.pageNumber)),
  ).sort((left, right) => left - right)

const toReply = (
  content: string,
  payload: ChatRequestPayload,
): ChatResponsePayload => ({
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
  const messages = buildMessages(payload)
  const content = await chatWithTools(client, model, messages, payload.pages)

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
  const messages = buildMessages(payload)
  const content = await chatWithTools(client, model, messages, payload.pages)

  if (!content) throw new Error('OpenAI returned an empty response.')
  return toReply(content, payload)
}
