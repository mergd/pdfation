import type { AppThread } from '../../../shared/contracts'
import type { Quote } from '../workspace/WorkspacePage'
import { ChatPanel } from './ChatPanel'
import { ChatThreadList } from './ChatThreadList'

import './sidebar.css'

interface SidebarProps {
  open: boolean
  onClose: () => void
  threads: AppThread[]
  activeThreadId: string | null
  activeThread: AppThread | null
  isSending: boolean
  quotes: Quote[]
  onSendMessage: (value: string) => void
  onSelectThread: (threadId: string) => void
  onCreateThread: () => void
  onDeleteThread: (threadId: string) => void
  onRenameThread: (threadId: string, title: string) => void
  onClearAllComments: () => void
  onRemoveQuote: (index: number) => void
  onClearQuotes: () => void
  onQuoteClick: (pageNumber: number) => void
  onPageClick: (pageNumber: number) => void
  onAnchorClick: (threadId: string, pageNumber: number) => void
}

export const Sidebar = ({
  open,
  onClose,
  threads,
  activeThreadId,
  activeThread,
  isSending,
  quotes,
  onSendMessage,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  onClearAllComments,
  onRemoveQuote,
  onClearQuotes,
  onQuoteClick,
  onPageClick,
  onAnchorClick,
}: SidebarProps) => {
  return (
    <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
      <div className="sidebar__inner">
        <ChatThreadList
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={onSelectThread}
          onCreateThread={onCreateThread}
          onDeleteThread={onDeleteThread}
          onRenameThread={onRenameThread}
          onClearAllComments={onClearAllComments}
          onClose={onClose}
        />
        <ChatPanel
          thread={activeThread}
          isSending={isSending}
          quotes={quotes}
          onSendMessage={onSendMessage}
          onRemoveQuote={onRemoveQuote}
          onClearQuotes={onClearQuotes}
          onQuoteClick={onQuoteClick}
          onPageClick={onPageClick}
          onAnchorClick={onAnchorClick}
        />
      </div>
    </aside>
  )
}
