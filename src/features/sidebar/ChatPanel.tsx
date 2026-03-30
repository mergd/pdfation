import { useEffect, useMemo, useRef, useState } from "react";

import type { AppThread } from "../../../shared/contracts";
import type { Quote } from "../workspace/WorkspacePage";
import { MessageBody } from "./MessageBody";
import { formatRelativeDate } from "../../lib/format-date";

const QUOTE_COLORS = [
  { bg: "rgba(138, 180, 248, 0.14)", border: "#8ab4f8", text: "#aecbfa" },
  { bg: "rgba(129, 201, 149, 0.14)", border: "#81c995", text: "#a8dab5" },
  { bg: "rgba(252, 173, 112, 0.14)", border: "#fcad70", text: "#fcc89b" },
  { bg: "rgba(201, 143, 255, 0.14)", border: "#c98fff", text: "#d8b4fe" },
  { bg: "rgba(255, 138, 128, 0.14)", border: "#ff8a80", text: "#ffab91" },
];

interface ChatPanelProps {
  thread: AppThread | null;
  isSending: boolean;
  quotes: Quote[];
  onSendMessage: (value: string) => void;
  onRemoveQuote: (index: number) => void;
  onClearQuotes: () => void;
  onQuoteClick: (pageNumber: number) => void;
  onPageClick: (pageNumber: number) => void;
  onAnchorClick: (threadId: string, pageNumber: number) => void;
}

export const ChatPanel = ({
  thread,
  isSending,
  quotes,
  onSendMessage,
  onRemoveQuote,
  onClearQuotes,
  onQuoteClick,
  onPageClick,
  onAnchorClick,
}: ChatPanelProps) => {
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messages = useMemo(() => thread?.messages ?? [], [thread]);
  const isAnchorThread = thread?.kind === "anchor";

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

    const quoteParts = quotes
      .map((q) => `> [p.${q.pageNumber}] ${q.text}`)
      .join("\n\n");
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
        {isAnchorThread && thread?.anchor && (
          <button
            type="button"
            className="chat-panel__context"
            onClick={() => onAnchorClick(thread.id, thread.anchor!.pageNumber)}
          >
            <span className="page-ref">p.{thread.anchor.pageNumber}</span>
            {" "}&ldquo;{thread.anchor.selectedText}&rdquo;
          </button>
        )}

        {messages.length === 0 && (
          <p className="chat-panel__empty">
            {isAnchorThread
              ? "Ask a question about this passage."
              : "Ask about the whole document, or highlight text and quote it here."}
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg chat-msg--${msg.role}`}>
            <div className="chat-msg__header">
              <span className="chat-msg__role">
                {msg.role === "assistant" ? "AI" : msg.authorName?.trim() || "You"}
              </span>
              <time className="chat-msg__time" title={new Date(msg.createdAt).toLocaleString()}>
                {formatRelativeDate(msg.createdAt)}
              </time>
            </div>
            <div className="chat-msg__body">
              <MessageBody content={msg.content} onPageClick={onPageClick} />
            </div>
            {msg.sourcePages.length > 0 && (
              <div className="chat-msg__pages">
                {msg.sourcePages.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="page-ref page-ref--muted"
                    onClick={() => onPageClick(p)}
                    title={`Go to page ${p}`}
                  >
                    p.{p}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isSending && (
          <div className="chat-msg chat-msg--assistant">
            <div className="chat-msg__header">
              <span className="chat-msg__role">AI</span>
            </div>
            <div className="chat-msg__body">
              <div className="typing-indicator">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-panel__composer" onSubmit={handleSubmit}>
        <div className="chat-panel__input-box">
          {quotes.length > 0 && (
            <div className="chat-panel__quotes">
              {quotes.length > 1 && (
                <div className="chat-panel__quotes-header">
                  <span className="chat-panel__quotes-count">{quotes.length} quotes</span>
                  <button
                    type="button"
                    className="chat-panel__quotes-clear"
                    onClick={onClearQuotes}
                  >
                    Clear all
                  </button>
                </div>
              )}
              {quotes.map((q, i) => {
                const color = QUOTE_COLORS[i % QUOTE_COLORS.length];
                return (
                  <button
                    key={i}
                    type="button"
                    className="chat-panel__quote"
                    style={{
                      background: color.bg,
                      borderLeftColor: color.border,
                      color: color.text,
                    }}
                    onClick={() => onQuoteClick(q.pageNumber)}
                    title={`Go to page ${q.pageNumber}`}
                  >
                    <span className="chat-panel__quote-page">p.{q.pageNumber}</span>
                    <span className="chat-panel__quote-text">"{q.text}"</span>
                    <span
                      className="chat-panel__quote-dismiss"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveQuote(i);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          onRemoveQuote(i);
                        }
                      }}
                    >
                      <CloseIcon />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="chat-panel__textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              isAnchorThread ? "Add a comment on this passage…" : "Ask about this document…"
            }
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
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
