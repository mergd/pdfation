import { useEffect, useMemo, useRef, useState } from "react";

import type { AppThread } from "../../../shared/contracts";

interface ChatPanelProps {
  thread: AppThread | null;
  isSending: boolean;
  quotes: string[];
  onSendMessage: (value: string) => void;
  onRemoveQuote: (index: number) => void;
  onClearQuotes: () => void;
}

export const ChatPanel = ({
  thread,
  isSending,
  quotes,
  onSendMessage,
  onRemoveQuote,
  onClearQuotes,
}: ChatPanelProps) => {
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messages = useMemo(() => thread?.messages ?? [], [thread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (quotes.length > 0) {
      textareaRef.current?.focus();
    }
  }, [quotes.length]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if ((!value && quotes.length === 0) || isSending) return;

    const quoteParts = quotes.map((q) => `> ${q}`).join("\n\n");
    const fullMessage = quoteParts
      ? value
        ? `${quoteParts}\n\n${value}`
        : quoteParts
      : value;

    onSendMessage(fullMessage);
    setDraft("");
    onClearQuotes();
  };

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
              <span className="chat-msg__role">
                {msg.role === "assistant" ? "AI" : "You"}
              </span>
              <time className="chat-msg__time">
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p className="chat-msg__body">{msg.content}</p>
            {msg.sourcePages.length > 0 && (
              <div className="chat-msg__pages">
                {msg.sourcePages.map((p) => (
                  <span key={p} className="badge badge-muted">
                    p.{p}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-panel__composer" onSubmit={handleSubmit}>
        <div className="chat-panel__input-box">
          {quotes.length > 0 && (
            <div className="chat-panel__quotes">
              {quotes.map((q, i) => (
                <div key={i} className="chat-panel__quote">
                  <span className="chat-panel__quote-text">"{q}"</span>
                  <button
                    type="button"
                    onClick={() => onRemoveQuote(i)}
                    className="chat-panel__quote-dismiss"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="chat-panel__textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about this document…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            className="chat-panel__send"
            disabled={isSending || (!draft.trim() && quotes.length === 0)}
            aria-label="Send"
          >
            {isSending ? <SpinnerIcon /> : <SendIcon />}
          </button>
        </div>
      </form>
    </div>
  );
};

const SendIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const SpinnerIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className="chat-panel__spinner"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
