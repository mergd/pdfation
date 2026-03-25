import { useState } from 'react'
import { Popover } from '@base-ui-components/react/popover'

import type { AppThread } from '../../../shared/contracts'

interface CommentPopoverProps {
  thread: AppThread
  anchor: Element | null
  open: boolean
  onClose: () => void
  onExpand: () => void
  onSend: (threadId: string, value: string) => void
  isSending: boolean
}

export const CommentPopover = ({
  thread,
  anchor: anchorElement,
  open,
  onClose,
  onExpand,
  onSend,
  isSending,
}: CommentPopoverProps) => {
  const [draft, setDraft] = useState('')
  const lastMessages = thread.messages.slice(-4)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value || isSending) return
    onSend(thread.id, value)
    setDraft('')
  }

  const virtualAnchor = anchorElement
    ? anchorElement
    : undefined

  return (
    <Popover.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <Popover.Portal>
        <Popover.Positioner
          side="right"
          align="start"
          sideOffset={12}
          anchor={virtualAnchor}
          className="comment-popover__positioner"
        >
          <Popover.Popup className="comment-popover">
            <div className="comment-popover__header">
              <span className="comment-popover__title">
                {thread.anchor?.selectedText
                  ? `"${thread.anchor.selectedText.slice(0, 50)}${thread.anchor.selectedText.length > 50 ? '…' : ''}"`
                  : thread.title}
              </span>
              <div className="comment-popover__actions">
                <button
                  className="comment-popover__btn"
                  onClick={onExpand}
                  type="button"
                  title="Expand in sidebar"
                >
                  <ExpandIcon />
                </button>
                <Popover.Close className="comment-popover__btn" title="Close">
                  <CloseIcon />
                </Popover.Close>
              </div>
            </div>

            <div className="comment-popover__messages">
              {lastMessages.length === 0 && (
                <p className="comment-popover__empty">Ask about this passage…</p>
              )}
              {lastMessages.map((msg) => (
                <div key={msg.id} className={`comment-popover__msg comment-popover__msg--${msg.role}`}>
                  <span className="comment-popover__msg-role">
                    {msg.role === 'assistant' ? 'AI' : 'You'}
                  </span>
                  <p>{msg.content}</p>
                </div>
              ))}
            </div>

            <form className="comment-popover__composer" onSubmit={handleSubmit}>
              <input
                type="text"
                className="comment-popover__input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about this…"
              />
              <button
                type="submit"
                className="btn btn-primary comment-popover__send"
                disabled={isSending || !draft.trim()}
              >
                {isSending ? '…' : 'Send'}
              </button>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

const ExpandIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
)

const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
