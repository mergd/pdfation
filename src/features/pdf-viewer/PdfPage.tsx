import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TextLayer, type PDFDocumentProxy } from 'pdfjs-dist'

import type { AppThread } from '../../../shared/contracts'

const DEFAULT_RENDER_SCALE = 1.25

interface PdfPageProps {
  pageNumber: number
  pdf: PDFDocumentProxy
  selectedThreadId: string | null
  threads: AppThread[]
  onTextSelect: (payload: {
    pageNumber: number
    selectedText: string
    textPrefix: string
    textSuffix: string
    rect: DOMRect
  }) => void
  onSelectThread: (threadId: string) => void
}

function findHighlightSpans(
  container: HTMLDivElement,
  selectedText: string,
  textPrefix: string,
): Range | null {
  const fullText = container.textContent ?? ''
  const searchTarget = textPrefix + selectedText

  let matchIndex = fullText.indexOf(searchTarget)
  if (matchIndex !== -1) {
    matchIndex += textPrefix.length
  } else {
    matchIndex = fullText.indexOf(selectedText)
  }

  if (matchIndex === -1) return null

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let charCount = 0
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const len = node.length

    if (!startNode && charCount + len > matchIndex) {
      startNode = node
      startOffset = matchIndex - charCount
    }

    if (startNode && charCount + len >= matchIndex + selectedText.length) {
      endNode = node
      endOffset = matchIndex + selectedText.length - charCount
      break
    }

    charCount += len
  }

  if (!startNode || !endNode) return null

  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range
}

export const PdfPage = ({
  pageNumber,
  pdf,
  selectedThreadId,
  threads,
  onTextSelect,
  onSelectThread,
}: PdfPageProps) => {
  const cardRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const highlightLayerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [availableWidth, setAvailableWidth] = useState(0)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const updateWidth = () => {
      setAvailableWidth(card.clientWidth)
    }

    updateWidth()

    const resizeObserver = new ResizeObserver(() => {
      updateWidth()
    })

    resizeObserver.observe(card)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    let ignore = false
    let textLayerInstance: TextLayer | null = null

    const renderPage = async () => {
      const page = await pdf.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const targetWidth = availableWidth > 0
        ? availableWidth
        : baseViewport.width * DEFAULT_RENDER_SCALE
      const renderScale = targetWidth / baseViewport.width
      const viewport = page.getViewport({ scale: renderScale })
      const outputScale = window.devicePixelRatio || 1
      const canvas = canvasRef.current
      const textContainer = textLayerRef.current

      if (!canvas || !textContainer || ignore) return

      const context = canvas.getContext('2d')
      if (!context) return

      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      setSize({ width: viewport.width, height: viewport.height })

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(outputScale, 0, 0, outputScale, 0, 0)

      await page.render({ canvas, canvasContext: context, viewport }).promise
      if (ignore) return

      const textContent = await page.getTextContent()
      if (ignore) return

      textContainer.innerHTML = ''
      textContainer.style.width = `${viewport.width}px`
      textContainer.style.height = `${viewport.height}px`

      textLayerInstance = new TextLayer({
        textContentSource: textContent,
        container: textContainer,
        viewport,
      })

      await textLayerInstance.render()
    }

    void renderPage()

    return () => {
      ignore = true
      textLayerInstance?.cancel()
    }
  }, [availableWidth, pageNumber, pdf])

  const pageThreads = useMemo(
    () => threads.filter((t) => t.kind === 'anchor' && t.anchor?.pageNumber === pageNumber),
    [pageNumber, threads],
  )

  useEffect(() => {
    const container = highlightLayerRef.current
    const textContainer = textLayerRef.current
    if (!container || !textContainer) return

    container.innerHTML = ''

    for (const thread of pageThreads) {
      if (!thread.anchor) continue

      const range = findHighlightSpans(
        textContainer,
        thread.anchor.selectedText,
        thread.anchor.textPrefix,
      )
      if (!range) continue

      const rects = range.getClientRects()
      const containerRect = textContainer.getBoundingClientRect()

      for (const rect of rects) {
        const mark = document.createElement('div')
        mark.className =
          thread.id === selectedThreadId
            ? 'pdf-highlight pdf-highlight--active'
            : 'pdf-highlight'
        mark.dataset.threadId = thread.id
        mark.style.left = `${rect.left - containerRect.left}px`
        mark.style.top = `${rect.top - containerRect.top}px`
        mark.style.width = `${rect.width}px`
        mark.style.height = `${rect.height}px`
        container.appendChild(mark)
      }
    }
  }, [pageThreads, selectedThreadId, size])

  const handleHighlightClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      const threadId = target.dataset?.threadId
      if (threadId) {
        onSelectThread(threadId)
      }
    },
    [onSelectThread],
  )

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const selectedText = selection.toString().trim()
    if (!selectedText || selectedText.length < 3) return

    const textContainer = textLayerRef.current
    if (!textContainer) return

    if (!textContainer.contains(selection.anchorNode)) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    const fullText = textContainer.textContent ?? ''
    const selStart = fullText.indexOf(selectedText)
    const textPrefix = selStart > 0 ? fullText.slice(Math.max(0, selStart - 20), selStart) : ''
    const textSuffix =
      selStart >= 0
        ? fullText.slice(selStart + selectedText.length, selStart + selectedText.length + 20)
        : ''

    onTextSelect({
      pageNumber,
      selectedText,
      textPrefix,
      textSuffix,
      rect,
    })
  }, [pageNumber, onTextSelect])

  return (
    <article ref={cardRef} className="pdf-page-card">
      <div className="pdf-page-card__label">
        <span>{pageNumber}</span>
      </div>

      <div
        className="pdf-page-card__surface"
        style={{ width: size.width || undefined }}
        onMouseUp={handleMouseUp}
      >
        <canvas ref={canvasRef} className="pdf-page-card__canvas" />
        <div ref={textLayerRef} className="textLayer" />
        <div
          ref={highlightLayerRef}
          className="pdf-page-card__highlights"
          onClick={handleHighlightClick}
        />
      </div>
    </article>
  )
}
