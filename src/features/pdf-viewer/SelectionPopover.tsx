import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface SelectionPopoverProps {
  selection: {
    selectedText: string
    rect: DOMRect
  } | null
  onComment: () => void
  onQuote: () => void
  onDismiss: () => void
}

export const SelectionPopover = ({
  selection,
  onComment,
  onQuote,
  onDismiss,
}: SelectionPopoverProps) => {
  const popoverRef = useRef<HTMLDivElement>(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!selection) return

    const dismiss = () => onDismissRef.current()

    const handlePointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        dismiss()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }

    const scrollContainer = document.querySelector('.pdf-viewer__scroll')

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    scrollContainer?.addEventListener('scroll', dismiss, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      scrollContainer?.removeEventListener('scroll', dismiss)
    }
  }, [selection])

  const handleComment = useCallback(() => {
    onComment()
  }, [onComment])

  const handleQuote = useCallback(() => {
    onQuote()
  }, [onQuote])

  if (!selection) return null

  const x = selection.rect.left + selection.rect.width / 2
  const y = selection.rect.top

  return createPortal(
    <div
      ref={popoverRef}
      className="selection-popover"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, calc(-100% - 8px))',
      }}
    >
      <button
        className="selection-popover__action"
        onClick={handleComment}
        type="button"
      >
        <CommentIcon />
        Comment
      </button>
      <div className="selection-popover__divider" />
      <button
        className="selection-popover__action"
        onClick={handleQuote}
        type="button"
      >
        <QuoteIcon />
        Quote in chat
      </button>
    </div>,
    document.body,
  )
}

const CommentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const QuoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" />
  </svg>
)
