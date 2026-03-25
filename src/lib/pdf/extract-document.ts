import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type { AppDocument, DocumentChunk } from '../../../shared/contracts'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim()

const createChunks = (pages: AppDocument['pages']): DocumentChunk[] => {
  const chunks: DocumentChunk[] = []

  for (const page of pages) {
    const text = normalizeWhitespace(page.text)

    if (!text) {
      continue
    }

    let offset = 0
    let chunkIndex = 0

    while (offset < text.length) {
      const slice = text.slice(offset, offset + 900)

      chunks.push({
        id: `${page.pageNumber}-${chunkIndex}`,
        pageNumber: page.pageNumber,
        text: slice,
      })

      chunkIndex += 1
      offset += 700
    }
  }

  return chunks
}

export const extractDocumentFromFile = async (file: File): Promise<AppDocument> => {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const pages: AppDocument['pages'] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const text = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')

    pages.push({
      pageNumber,
      text: normalizeWhitespace(text),
    })
  }

  const document: AppDocument = {
    id: crypto.randomUUID(),
    name: file.name,
    blob: file,
    pageCount: pdf.numPages,
    uploadedAt: new Date().toISOString(),
    pages,
    chunks: createChunks(pages),
  }

  await pdf.destroy()

  return document
}
