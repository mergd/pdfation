import { useState } from 'react'

import type { AppThread } from '../../../shared/contracts'

interface CommentListProps {
  threads: AppThread[]
  selectedThreadId: string | null
  focusedThread: AppThread | null
  isSending: boolean
  onSelectThread: (threadId: string) => void
  onSendMessage: (threadId: string, value: string) => void
}

export const CommentList = ({
  threads,
  selectedThreadId,
  focusedThread,
  isSending,
  onSelectThread,
  onSendMessage,
}: CommentListProps) => {
  const [draft, setDraft] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value || !focusedThread || isSending) return
    onSendMessage(focusedThread.id, value)
    setDraft('')
  }

  if (threads.length === 0) {
    return (
      <div className="comment-list">
        <p className="comment-list__empty">
          Highlight text on the PDF and click "Comment" to start a thread.
        </p>
      </div>
    )
  }

  return (
    <div className="comment-list">
      <div className="comment-list__items">
        {threads.map((thread) => (
          <button
            key={thread.id}
            className={`comment-list__item ${
              selectedThreadId === thread.id ? 'comment-list__item--active' : ''
            }`}
            onClick={() => onSelectThread(thread.id)}
            type="button"
          >
            <span className="comment-list__item-page">p.{thread.anchor?.pageNumber}</span>
            <span className="comment-list__item-text">
              {thread.anchor?.selectedText.slice(0, 60)}
              {(thread.anchor?.selectedText.length ?? 0) > 60 ? '…' : ''}
            </span>
            <span className="comment-list__item-count">
              {thread.messages.length} msg{thread.messages.length !== 1 ? 's' : ''}
            </span>
          </button>
        ))}
      </div>

      {focusedThread && (
        <div className="comment-list__detail">
          <div className="comment-list__detail-header">
            <span className="badge badge-accent">p.{focusedThread.anchor?.pageNumber}</span>
            <p className="comment-list__detail-excerpt">
              "{focusedThread.anchor?.selectedText.slice(0, 100)}
              {(focusedThread.anchor?.selectedText.length ?? 0) > 100 ? '…' : ''}"
            </p>
          </div>

          <div className="comment-list__detail-messages">
            {focusedThread.messages.map((msg) => (
              <div key={msg.id} className={`chat-msg chat-msg--${msg.role}`}>
                <div className="chat-msg__header">
                  <span className="chat-msg__role">{msg.role === 'assistant' ? 'AI' : 'You'}</span>
                </div>
                <p className="chat-msg__body">{msg.content}</p>
              </div>
            ))}
          </div>

          <form className="comment-list__detail-composer" onSubmit={handleSubmit}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Continue this thread…"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSending || !draft.trim()}
            >
              {isSending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
