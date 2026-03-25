import { useEffect, useMemo, useRef, useState } from 'react'

import type { AppThread } from '../../../shared/contracts'

interface ChatPanelProps {
  thread: AppThread | null
  isSending: boolean
  quotedText: string | null
  onSendMessage: (value: string) => void
  onClearQuote: () => void
}

export const ChatPanel = ({
  thread,
  isSending,
  quotedText,
  onSendMessage,
  onClearQuote,
}: ChatPanelProps) => {
  const [draft, setDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messages = useMemo(() => thread?.messages ?? [], [thread])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value || isSending) return

    const fullMessage = quotedText
      ? `> ${quotedText}\n\n${value}`
      : value

    onSendMessage(fullMessage)
    setDraft('')
    onClearQuote()
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel__messages">
        {messages.length === 0 && (
          <p className="chat-panel__empty">
            Ask about the whole document, or highlight text and quote it here.
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg chat-msg--${msg.role}`}>
            <div className="chat-msg__header">
              <span className="chat-msg__role">{msg.role === 'assistant' ? 'AI' : 'You'}</span>
              <time className="chat-msg__time">
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </time>
            </div>
            <p className="chat-msg__body">{msg.content}</p>
            {msg.sourcePages.length > 0 && (
              <div className="chat-msg__pages">
                {msg.sourcePages.map((p) => (
                  <span key={p} className="badge badge-muted">p.{p}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-panel__composer" onSubmit={handleSubmit}>
        {quotedText && (
          <div className="chat-panel__quote">
            <span>"{quotedText.slice(0, 80)}{quotedText.length > 80 ? '…' : ''}"</span>
            <button type="button" onClick={onClearQuote} className="chat-panel__quote-dismiss">
              &times;
            </button>
          </div>
        )}
        <div className="chat-panel__input-row">
          <textarea
            className="chat-panel__textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about this document…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSending || !draft.trim()}
          >
            {isSending ? '…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
