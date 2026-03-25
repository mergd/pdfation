import { useEffect, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type { AppDocument, AppThread } from '../../../shared/contracts'
import { PdfPage } from './PdfPage'
import { SelectionPopover } from './SelectionPopover'

import './pdf-viewer.css'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

interface TextSelection {
  pageNumber: number
  selectedText: string
  textPrefix: string
  textSuffix: string
  rect: DOMRect
}

interface PdfViewerProps {
  document: AppDocument | null
  selectedThreadId: string | null
  threads: AppThread[]
  onCreateComment: (payload: {
    pageNumber: number
    selectedText: string
    textPrefix: string
    textSuffix: string
  }) => void
  onQuoteInChat: (text: string) => void
  onSelectThread: (threadId: string) => void
}

export const PdfViewer = ({
  document: appDocument,
  selectedThreadId,
  threads,
  onCreateComment,
  onQuoteInChat,
  onSelectThread,
}: PdfViewerProps) => {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [selection, setSelection] = useState<TextSelection | null>(null)

  useEffect(() => {
    let cancelled = false
    let currentPdf: PDFDocumentProxy | null = null

    const loadPdf = async () => {
      if (!appDocument) {
        setPdf(null)
        return
      }

      const arrayBuffer = await appDocument.blob.arrayBuffer()
      const nextPdf = await getDocument({ data: arrayBuffer }).promise

      if (cancelled) {
        await nextPdf.destroy()
        return
      }

      currentPdf = nextPdf
      setPdf(nextPdf)
    }

    void loadPdf()

    return () => {
      cancelled = true
      if (currentPdf) void currentPdf.destroy()
    }
  }, [appDocument])

  const handleTextSelect = (payload: TextSelection) => {
    setSelection(payload)
  }

  const handleComment = () => {
    if (!selection) return
    onCreateComment({
      pageNumber: selection.pageNumber,
      selectedText: selection.selectedText,
      textPrefix: selection.textPrefix,
      textSuffix: selection.textSuffix,
    })
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleQuote = () => {
    if (!selection) return
    onQuoteInChat(selection.selectedText)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleDismiss = () => {
    setSelection(null)
  }

  if (!appDocument) {
    return (
      <section className="pdf-viewer pdf-viewer--empty">
        <div className="pdf-viewer__empty-content">
          <h2>No document loaded</h2>
          <p>Upload a PDF to start highlighting and commenting.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="pdf-viewer">
      <header className="pdf-viewer__header">
        <h2>{appDocument.name}</h2>
        <span className="pdf-viewer__meta">{appDocument.pageCount} pages</span>
      </header>

      <div className="pdf-viewer__scroll">
        {pdf
          ? Array.from({ length: appDocument.pageCount }, (_, i) => (
              <PdfPage
                key={i + 1}
                pageNumber={i + 1}
                pdf={pdf}
                selectedThreadId={selectedThreadId}
                threads={threads}
                onTextSelect={handleTextSelect}
                onSelectThread={onSelectThread}
              />
            ))
          : <div className="pdf-viewer__loading">Loading…</div>
        }
      </div>

      <SelectionPopover
        selection={selection}
        onComment={handleComment}
        onQuote={handleQuote}
        onDismiss={handleDismiss}
      />
    </section>
  )
}
