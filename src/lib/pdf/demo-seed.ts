import type { AppDocument, AppMessage, AppSettings, AppThread } from '../../../shared/contracts'

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim()

const buildMessage = (
  role: AppMessage['role'],
  content: string,
  createdAt: string,
  sourcePages: number[] = [],
  author?: Pick<AppMessage, 'authorDeviceId' | 'authorName'>,
): AppMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt,
  sourcePages,
  ...(author ?? {}),
})

const createTimestamp = (minutesAgo: number) =>
  new Date(Date.now() - minutesAgo * 60_000).toISOString()

const selectSnippet = (text: string, preferredSentenceIndex = 0) => {
  const normalized = normalizeWhitespace(text)
  const sentences =
    normalized
      .match(/[^.!?]+[.!?]?/g)
      ?.map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 40 && sentence.length <= 220) ?? []

  const selectedSentence =
    sentences[preferredSentenceIndex] ??
    sentences.find((sentence) => sentence.length >= 60) ??
    normalized.slice(0, 160).trim()

  const selectedText = selectedSentence.replace(/^[,.;:\s]+|[,.;:\s]+$/g, '')
  const startIndex = normalized.indexOf(selectedText)
  if (!selectedText || startIndex < 0) return null

  return {
    selectedText,
    textPrefix: normalized.slice(Math.max(0, startIndex - 20), startIndex),
    textSuffix: normalized.slice(startIndex + selectedText.length, startIndex + selectedText.length + 20),
  }
}

const createAnchorThread = (
  document: AppDocument,
  pageNumber: number,
  title: string,
  minutesAgo: number,
  messages: AppMessage[],
  preferredSentenceIndex = 0,
): AppThread | null => {
  const page = document.pages.find((entry) => entry.pageNumber === pageNumber)
  if (!page) return null

  const snippet = selectSnippet(page.text, preferredSentenceIndex)
  if (!snippet) return null

  return {
    id: crypto.randomUUID(),
    documentId: document.id,
    kind: 'anchor',
    title,
    anchor: {
      pageNumber,
      selectedText: snippet.selectedText,
      textPrefix: snippet.textPrefix,
      textSuffix: snippet.textSuffix,
    },
    messages,
    updatedAt: createTimestamp(minutesAgo),
  }
}

export const shouldSeedDemoThreads = (threads: AppThread[]) => {
  if (threads.some((thread) => thread.kind === 'anchor')) return false

  const globalThreads = threads.filter((thread) => thread.kind === 'global')
  if (globalThreads.length !== 1) return false

  const [globalThread] = globalThreads
  if (globalThread.messages.length > 0) return false

  return true
}

export const createDemoThreads = (
  document: AppDocument,
  settings: AppSettings,
  globalThread: AppThread,
): AppThread[] => {
  const candidatePages = document.pages
    .filter((page) => normalizeWhitespace(page.text).length >= 60)
    .map((page) => page.pageNumber)

  const firstPage = candidatePages[0] ?? 1
  const secondPage = candidatePages[1] ?? firstPage

  const demoAuthor = {
    authorDeviceId: settings.deviceId,
    authorName: settings.username,
  }

  const seededGlobalThread: AppThread = {
    ...globalThread,
    title: 'How pdfation works',
    messages: [
      buildMessage(
        'user',
        'Give me a quick tour of how to use this workspace.',
        createTimestamp(6),
        [],
        demoAuthor,
      ),
      buildMessage(
        'assistant',
        `Read the PDF in the center, then highlight any passage to either leave an inline annotation or quote it into chat. I seeded example highlights on pages ${firstPage} and ${secondPage} so you can click them, jump back to the source, and see how notes stay attached to the document.`,
        createTimestamp(5),
        [firstPage, secondPage],
      ),
      buildMessage(
        'user',
        'If I highlight something now, will the annotation stay around?',
        createTimestamp(4),
        [],
        demoAuthor,
      ),
      buildMessage(
        'assistant',
        'Yes. Annotations are saved as anchored threads, so the highlight persists on the PDF and can be reopened later from either the page itself or the sidebar.',
        createTimestamp(3),
        [firstPage],
      ),
    ],
    updatedAt: createTimestamp(3),
  }

  const inlineCommentThread = createAnchorThread(
    document,
    firstPage,
    'Inline question example',
    8,
    [
      buildMessage(
        'user',
        'Why is this passage worth keeping an eye on?',
        createTimestamp(8),
        [],
        demoAuthor,
      ),
      buildMessage(
        'assistant',
        'It shows the core inline workflow: the highlight marks the source passage, and the thread keeps your question next to the exact text so future follow-ups stay grounded.',
        createTimestamp(7),
        [firstPage],
      ),
    ],
  )

  const savedAnnotationThread = createAnchorThread(
    document,
    secondPage,
    'Saved annotation example',
    9,
    [],
    1,
  )

  return [seededGlobalThread, inlineCommentThread, savedAnnotationThread].filter(
    (thread): thread is AppThread => thread !== null,
  )
}
