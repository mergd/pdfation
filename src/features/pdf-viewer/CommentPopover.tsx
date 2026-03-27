import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { AppThread } from "../../../shared/contracts";

interface CommentPopoverProps {
  thread: AppThread;
  anchorElement: Element | null;
  open: boolean;
  onClose: () => void;
  onExpand: () => void;
  onSend: (threadId: string, value: string) => void;
  isSending: boolean;
}

interface Position {
  top: number;
  left: number;
}

export const CommentPopover = ({
  thread,
  anchorElement,
  open,
  onClose,
  onExpand,
  onSend,
  isSending,
}: CommentPopoverProps) => {
  const [draft, setDraft] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessages = thread.messages.slice(-6);

  const recalculate = useCallback(() => {
    if (!anchorElement) return;

    const anchorRect = anchorElement.getBoundingClientRect();
    const popoverWidth = 340;
    const popoverHeight = 280;
    const gap = 8;

    let top = anchorRect.bottom + gap;
    let left = anchorRect.left;

    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    left = Math.max(12, left);

    if (top + popoverHeight > window.innerHeight - 12) {
      top = anchorRect.top - popoverHeight - gap;
    }

    setPosition({ top, left });
  }, [anchorElement]);

  useEffect(() => {
    if (!open || !anchorElement) {
      setPosition(null);
      return;
    }

    recalculate();
    inputRef.current?.focus();

    const scrollContainer = document.querySelector(".pdf-viewer__scroll");
    scrollContainer?.addEventListener("scroll", recalculate, { passive: true });
    window.addEventListener("resize", recalculate);

    return () => {
      scrollContainer?.removeEventListener("scroll", recalculate);
      window.removeEventListener("resize", recalculate);
    };
  }, [open, anchorElement, recalculate]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || isSending) return;
    onSend(thread.id, value);
    setDraft("");
  };

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={cardRef}
      className="comment-popover"
      style={{ top: position.top, left: position.left }}
    >
      <div className="comment-popover__header">
        <div className="comment-popover__actions">
          <button
            className="comment-popover__btn"
            onClick={onExpand}
            type="button"
            title="Expand in sidebar"
          >
            <ExpandIcon />
          </button>
          <button
            className="comment-popover__btn"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="comment-popover__messages">
        {lastMessages.length === 0 && (
          <p className="comment-popover__empty">Ask about this passage…</p>
        )}
        {lastMessages.map((msg) => (
          <div
            key={msg.id}
            className={`comment-popover__msg comment-popover__msg--${msg.role}`}
          >
            <span className="comment-popover__msg-role">
              {msg.role === "assistant" ? "AI" : msg.authorName?.trim() || "You"}
            </span>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>

      <form className="comment-popover__composer" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
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
          {isSending ? "…" : "Send"}
        </button>
      </form>
    </div>,
    document.body,
  );
};

const ExpandIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="14"
    height="14"
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
