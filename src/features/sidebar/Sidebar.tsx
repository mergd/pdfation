import { Tabs } from '@base-ui-components/react/tabs'

import type { AppSettings, AppThread, ProviderMode } from '../../../shared/contracts'
import { ChatPanel } from './ChatPanel'
import { CommentList } from './CommentList'
import { SettingsPanel } from '../settings/SettingsPanel'

import './sidebar.css'

type SidebarTab = 'chat' | 'comments'

interface SidebarProps {
  open: boolean
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  onClose: () => void
  globalThread: AppThread | null
  anchorThreads: AppThread[]
  selectedThreadId: string | null
  focusedThread: AppThread | null
  isSending: boolean
  quotedText: string | null
  settings: AppSettings | null
  onSendMessage: (value: string) => void
  onSendCommentMessage: (threadId: string, value: string) => void
  onSelectThread: (threadId: string) => void
  onChangeProviderMode: (mode: ProviderMode) => void
  onChangeKey: (value: string) => void
  onClearQuote: () => void
}

export const Sidebar = ({
  open,
  activeTab,
  onTabChange,
  onClose,
  globalThread,
  anchorThreads,
  selectedThreadId,
  focusedThread,
  isSending,
  quotedText,
  settings,
  onSendMessage,
  onSendCommentMessage,
  onSelectThread,
  onChangeProviderMode,
  onChangeKey,
  onClearQuote,
}: SidebarProps) => {
  return (
    <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
      <div className="sidebar__inner">
        <div className="sidebar__top">
          <Tabs.Root
            value={activeTab}
            onValueChange={(value) => onTabChange(value as SidebarTab)}
          >
            <Tabs.List className="sidebar__tabs">
              <Tabs.Tab value="chat" className="sidebar__tab">Chat</Tabs.Tab>
              <Tabs.Tab value="comments" className="sidebar__tab">
                Comments
                {anchorThreads.length > 0 && (
                  <span className="sidebar__tab-count">{anchorThreads.length}</span>
                )}
              </Tabs.Tab>
              <Tabs.Indicator className="sidebar__tab-indicator" />
            </Tabs.List>
          </Tabs.Root>

          <button className="sidebar__close" onClick={onClose} type="button" title="Close sidebar">
            <PanelCloseIcon />
          </button>
        </div>

        {activeTab === 'chat' ? (
          <ChatPanel
            thread={globalThread}
            isSending={isSending}
            quotedText={quotedText}
            onSendMessage={onSendMessage}
            onClearQuote={onClearQuote}
          />
        ) : (
          <CommentList
            threads={anchorThreads}
            selectedThreadId={selectedThreadId}
            focusedThread={focusedThread}
            isSending={isSending}
            onSelectThread={onSelectThread}
            onSendMessage={onSendCommentMessage}
          />
        )}

        {settings && (
          <SettingsPanel
            settings={settings}
            onChangeProviderMode={onChangeProviderMode}
            onChangeKey={onChangeKey}
          />
        )}
      </div>
    </aside>
  )
}

const PanelCloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <polyline points="10 8 6 12 10 16" />
  </svg>
)
