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
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessages = thread.messages.slice(-6);

  const recalculate = useCallback(() => {
    if (!anchorElement) return;

    const scrollContainer = document.querySelector(".pdf-viewer__scroll");
    if (!scrollContainer) return;

    setPortalTarget(scrollContainer);

    const scrollRect = scrollContainer.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    const top = anchorRect.top - scrollRect.top + scrollContainer.scrollTop;

    const pageCard = anchorElement.closest(".pdf-page-card");
    let left: number;
    if (pageCard) {
      const cardRect = pageCard.getBoundingClientRect();
      left = cardRect.right - scrollRect.left + 20;
    } else {
      left = scrollRect.width * 0.5 + 420;
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

    const ro = new ResizeObserver(recalculate);
    const scrollContainer = document.querySelector(".pdf-viewer__scroll");
    if (scrollContainer) ro.observe(scrollContainer);

    return () => ro.disconnect();
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

  if (!open || !position || !portalTarget) return null;

  return createPortal(
    <div
      ref={cardRef}
      className="comment-popover"
      style={{ top: position.top, left: position.left }}
    >
      <div className="comment-popover__header">
        <span className="comment-popover__title">
          {thread.anchor?.selectedText
            ? `"${thread.anchor.selectedText.slice(0, 60)}${thread.anchor.selectedText.length > 60 ? "…" : ""}"`
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
              {msg.role === "assistant" ? "AI" : "You"}
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
    portalTarget,
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
