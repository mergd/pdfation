import { useEffect, useMemo, useRef } from 'react'
import { Popover } from '@base-ui-components/react/popover'

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
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!selection) return

    const scrollContainer = document.querySelector('.pdf-viewer__scroll')
    if (!scrollContainer) return

    const handleScroll = () => onDismissRef.current()
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [selection])

  const virtualAnchor = useMemo(() => {
    if (!selection) return undefined

    const x = selection.rect.left + selection.rect.width / 2
    const y = selection.rect.top

    return {
      getBoundingClientRect: () => ({
        x,
        y,
        width: 0,
        height: 0,
        top: y,
        right: x,
        bottom: y,
        left: x,
        toJSON: () => {},
      }),
    }
  }, [selection])

  return (
    <Popover.Root open={!!selection} onOpenChange={(open) => { if (!open) onDismiss() }}>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="center"
          sideOffset={8}
          anchor={virtualAnchor}
        >
          <Popover.Popup className="selection-popover" onMouseDown={(e) => e.stopPropagation()}>
            <button
              className="selection-popover__action"
              onClick={onComment}
              type="button"
            >
              <CommentIcon />
              Comment
            </button>
            <div className="selection-popover__divider" />
            <button
              className="selection-popover__action"
              onClick={onQuote}
              type="button"
            >
              <QuoteIcon />
              Quote in chat
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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
