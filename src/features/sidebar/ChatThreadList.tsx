import { useState } from "react";

import type { AppThread } from "../../../shared/contracts";

interface ChatThreadListProps {
  threads: AppThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string) => void;
}

export const ChatThreadList = ({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
}: ChatThreadListProps) => {
  const [open, setOpen] = useState(false);
  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="thread-picker">
      <button
        type="button"
        className="thread-picker__toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="thread-picker__title">
          {activeThread?.title ?? "Chat"}
        </span>
        <ChevronIcon open={open} />
      </button>

      <button
        type="button"
        className="thread-picker__new"
        onClick={() => {
          onCreateThread();
          setOpen(false);
        }}
        title="New chat"
      >
        <PlusIcon />
      </button>

      {open && (
        <div className="thread-picker__list">
          {threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            const msgCount = thread.messages.length;
            const lastMsg = thread.messages[thread.messages.length - 1];

            return (
              <button
                key={thread.id}
                type="button"
                className={`thread-picker__item ${isActive ? "thread-picker__item--active" : ""}`}
                onClick={() => {
                  onSelectThread(thread.id);
                  setOpen(false);
                }}
              >
                <div className="thread-picker__item-main">
                  <span className="thread-picker__item-title">
                    {thread.title}
                  </span>
                  <span className="thread-picker__item-meta">
                    {msgCount === 0
                      ? "Empty"
                      : `${msgCount} msg${msgCount === 1 ? "" : "s"}`}
                    {lastMsg && (
                      <>
                        {" · "}
                        {formatRelativeTime(lastMsg.createdAt)}
                      </>
                    )}
                  </span>
                </div>

                {threads.length > 1 && (
                  <button
                    type="button"
                    className="thread-picker__item-delete"
                    title="Delete thread"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.id);
                    }}
                  >
                    <TrashIcon />
                  </button>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const formatRelativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transition: "transform 150ms ease",
      transform: open ? "rotate(180deg)" : "rotate(0)",
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

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

const TrashIcon = () => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
