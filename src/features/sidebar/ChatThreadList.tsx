import { useEffect, useMemo, useRef, useState } from "react";

import type { AppThread } from "../../../shared/contracts";
import { formatRelativeDate } from "../../lib/format-date";

interface ChatThreadListProps {
  threads: AppThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => void;
  onClose: () => void;
}

export const ChatThreadList = ({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  onClose,
}: ChatThreadListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const startRename = (thread: AppThread) => {
    setEditingId(thread.id);
    setEditValue(thread.title);
  };

  const commitRename = () => {
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== threads.find((t) => t.id === editingId)?.title) {
      onRenameThread(editingId, trimmed);
    }
    setEditingId(null);
  };

  const sorted = useMemo(
    () =>
      threads
        .filter((t) => t.kind !== "anchor" || t.messages.length > 0)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [threads],
  );

  const handleNewThread = () => {
    const emptyGlobal = threads.find(
      (t) => t.kind === "global" && t.messages.length === 0,
    );
    if (emptyGlobal) {
      onSelectThread(emptyGlobal.id);
    } else {
      onCreateThread();
    }
  };

  return (
    <div className="thread-list">
      <div className="thread-list__header">
        <span className="thread-list__label">Threads</span>
        <div className="thread-list__header-actions">
          <button
            type="button"
            className="thread-list__header-btn"
            onClick={handleNewThread}
            title="New chat"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="thread-list__header-btn"
            onClick={onClose}
            title="Close sidebar"
          >
            <PanelCloseIcon />
          </button>
        </div>
      </div>

      <div className="thread-list__items">
        {sorted.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const lastMsg = thread.messages[thread.messages.length - 1];
          const msgCount = thread.messages.length;
          const isAnchor = thread.kind === "anchor";
          const isEditing = editingId === thread.id;

          return (
            <button
              key={thread.id}
              type="button"
              className={`thread-list__item ${isActive ? "thread-list__item--active" : ""}`}
              onClick={() => {
                if (isEditing) return;
                onSelectThread(thread.id);
              }}
            >
              <div className="thread-list__item-content">
                {isAnchor && (
                  <span className="thread-list__item-badge">
                    p.{thread.anchor?.pageNumber}
                  </span>
                )}
                {isEditing ? (
                  <input
                    ref={inputRef}
                    className="thread-list__item-rename"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="thread-list__item-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!isAnchor) startRename(thread);
                    }}
                  >
                    {isAnchor
                      ? `"${thread.anchor?.selectedText.slice(0, 40)}${(thread.anchor?.selectedText.length ?? 0) > 40 ? "…" : ""}"`
                      : thread.title}
                  </span>
                )}
              </div>

              <div className="thread-list__item-actions">
                {!isAnchor && !isEditing && (
                  <button
                    type="button"
                    className="thread-list__action"
                    title="Rename"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(thread);
                    }}
                  >
                    <PencilIcon />
                  </button>
                )}
                {sorted.length > 1 && (
                  <button
                    type="button"
                    className="thread-list__action thread-list__action--danger"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.id);
                    }}
                  >
                    <DismissIcon />
                  </button>
                )}
              </div>

              <span className="thread-list__item-meta">
                {msgCount > 0 && (
                  <span className="thread-list__item-count">{msgCount}</span>
                )}
                {lastMsg && (
                  <time className="thread-list__item-time">
                    {formatRelativeDate(lastMsg.createdAt)}
                  </time>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const PlusIcon = () => (
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
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const PanelCloseIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <polyline points="10 8 6 12 10 16" />
  </svg>
);

const PencilIcon = () => (
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
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

const DismissIcon = () => (
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
