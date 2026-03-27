import type { AppDocument, AppThread, SourceReference } from '../../../shared/contracts'

const cleanText = (value: string) => value.replace(/\s+/g, ' ').trim()

const scoreChunk = (chunkText: string, query: string) => {
  const normalizedChunk = cleanText(chunkText).toLowerCase()
  const terms = cleanText(query)
    .toLowerCase()
    .split(' ')
    .filter((term) => term.length > 3)

  if (terms.length === 0) return 0

  return terms.reduce((score, term) => (normalizedChunk.includes(term) ? score + 1 : score), 0)
}

const buildPageOutline = (document: AppDocument) =>
  document.pages
    .map((p) => {
      const preview = cleanText(p.text).slice(0, 150)
      return `  Page ${p.pageNumber}: ${preview}${p.text.length > 150 ? '…' : ''}`
    })
    .join('\n')

export const buildDocumentContext = (
  document: AppDocument,
  thread: AppThread,
  prompt: string,
): { summary: string; snippets: SourceReference[] } => {
  if (thread.kind === 'anchor' && thread.anchor) {
    const page = document.pages.find((p) => p.pageNumber === thread.anchor!.pageNumber)
    const pageContext = page ? cleanText(page.text).slice(0, 4000) : ''

    return {
      summary: `Inline comment on page ${thread.anchor.pageNumber}. The user highlighted: "${thread.anchor.selectedText}"`,
      snippets: [
        {
          pageNumber: thread.anchor.pageNumber,
          snippet: thread.anchor.selectedText,
        },
        ...(pageContext
          ? [{ pageNumber: thread.anchor.pageNumber, snippet: pageContext }]
          : []),
      ],
    }
  }

  const rankedChunks = [...document.chunks]
    .map((chunk) => ({ ...chunk, score: scoreChunk(chunk.text, prompt) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  const outline = buildPageOutline(document)

  return {
    summary: `"${document.name}" — ${document.pageCount} pages.\n\nPage outline:\n${outline}`,
    snippets: rankedChunks.map((c) => ({ pageNumber: c.pageNumber, snippet: c.text })),
  }
}
