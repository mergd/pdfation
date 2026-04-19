import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { CopySimple, Crown, LinkBreak, ShieldCheck, SignOut } from '@phosphor-icons/react'

import type { AppSettings } from '../../../shared/contracts'
import { buildSyncBundle } from '../../lib/sync/bundle'
import {
  deleteSync,
  enableSync,
  fetchSyncStatus,
  pushBundle,
  requestMagicLink,
  revokeSession,
  signOutSync,
} from '../../lib/sync/sync-client'

import './sync.css'

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

interface SyncSectionProps {
  settings: AppSettings
}

export const SyncSection = ({ settings }: SyncSectionProps) => {
  const queryClient = useQueryClient()
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const statusQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: fetchSyncStatus,
    staleTime: 15_000,
  })

  const invalidateStatus = () =>
    queryClient.invalidateQueries({ queryKey: ['sync-status'] })

  const enableMutation = useMutation({
    mutationFn: async () => {
      const result = await enableSync(settings.username || 'Master device')
      const { bundle } = await buildSyncBundle(settings)
      await pushBundle(bundle)
      return result
    },
    onSuccess: invalidateStatus,
  })

  const linkMutation = useMutation({
    mutationFn: async () => requestMagicLink(window.location.origin),
    onSuccess: (result) => {
      setLinkUrl(result.url)
      setLinkExpiresAt(result.expiresAt)
      setCopied(false)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: invalidateStatus,
  })

  const signOutMutation = useMutation({
    mutationFn: () => signOutSync(),
    onSuccess: invalidateStatus,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSync(),
    onSuccess: invalidateStatus,
  })

  const pushNowMutation = useMutation({
    mutationFn: async () => {
      const { bundle, overLimit, excludedForLimit } = await buildSyncBundle(settings)
      const result = await pushBundle(bundle)
      return { result, overLimit, excludedForLimit }
    },
    onSuccess: invalidateStatus,
  })

  const status = statusQuery.data
  const otherSessions = useMemo(
    () => status?.sessions.filter((s) => s.id !== status.currentSession?.id) ?? [],
    [status],
  )

  if (statusQuery.isLoading) {
    return (
      <div className="sync-section sync-section--loading">Loading sync…</div>
    )
  }

  if (!status?.enabled) {
    return (
      <div className="sync-section">
        <div className="sync-section__headline">
          <span className="sync-section__title">Sync across devices</span>
          <span className="sync-section__subtitle">
            Keep PDFs, annotations, chats and API keys in sync. 10 MB cap.
          </span>
        </div>
        {enableMutation.error ? (
          <div className="sync-section__notice sync-section__notice--error">
            {enableMutation.error.message}
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-primary sync-section__cta"
          onClick={() => enableMutation.mutate()}
          disabled={enableMutation.isPending}
        >
          {enableMutation.isPending ? 'Turning on sync…' : 'Turn on sync'}
        </button>
      </div>
    )
  }

  const isMaster = status.currentSession?.isMaster ?? false

  return (
    <div className="sync-section">
      <div className="sync-section__headline">
        <span className="sync-section__title">
          <ShieldCheck weight="fill" size={14} />
          Sync is on
          {isMaster ? (
            <span className="sync-section__chip">
              <Crown weight="fill" size={10} /> Master
            </span>
          ) : null}
        </span>
        {status.bundle ? (
          <span className="sync-section__subtitle">
            {status.bundle.documentCount} files · {formatBytes(status.bundle.byteSize)} ·
            updated {formatDistanceToNow(new Date(status.bundle.updatedAt))} ago by{' '}
            {status.bundle.updatedByDeviceName}
          </span>
        ) : (
          <span className="sync-section__subtitle">No bundle pushed yet.</span>
        )}
      </div>

      {isMaster ? (
        <div className="sync-section__block">
          <div className="sync-section__row">
            <span className="sync-section__row-label">Link another device</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => linkMutation.mutate()}
              disabled={linkMutation.isPending}
            >
              {linkMutation.isPending ? 'Creating…' : linkUrl ? 'Regenerate' : 'Create link'}
            </button>
          </div>
          {linkUrl ? (
            <div className="sync-section__link">
              <code className="sync-section__link-text">{linkUrl}</code>
              <button
                type="button"
                className="btn btn-ghost sync-section__copy"
                onClick={async () => {
                  await navigator.clipboard.writeText(linkUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                <CopySimple size={12} />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : null}
          {linkExpiresAt ? (
            <p className="sync-section__hint">
              One-time use. Expires in {formatDistanceToNow(new Date(linkExpiresAt))}.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="sync-section__block">
        <div className="sync-section__row">
          <span className="sync-section__row-label">Devices</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => pushNowMutation.mutate()}
            disabled={pushNowMutation.isPending}
          >
            {pushNowMutation.isPending ? 'Pushing…' : 'Push now'}
          </button>
        </div>

        <ul className="sync-section__devices">
          {status.currentSession ? (
            <li className="sync-section__device">
              <div className="sync-section__device-meta">
                <span className="sync-section__device-name">
                  {status.currentSession.deviceName}
                  <span className="sync-section__chip sync-section__chip--muted">This device</span>
                  {status.currentSession.isMaster ? (
                    <span className="sync-section__chip">
                      <Crown weight="fill" size={10} /> Master
                    </span>
                  ) : null}
                </span>
                <span className="sync-section__device-seen">
                  Active just now
                </span>
              </div>
            </li>
          ) : null}
          {otherSessions.map((session) => (
            <li key={session.id} className="sync-section__device">
              <div className="sync-section__device-meta">
                <span className="sync-section__device-name">
                  {session.deviceName}
                  {session.isMaster ? (
                    <span className="sync-section__chip">
                      <Crown weight="fill" size={10} /> Master
                    </span>
                  ) : null}
                </span>
                <span className="sync-section__device-seen">
                  Last seen {formatDistanceToNow(new Date(session.lastSeenAt))} ago
                </span>
              </div>
              {isMaster && !session.isMaster ? (
                <button
                  type="button"
                  className="btn btn-ghost sync-section__revoke"
                  onClick={() => revokeMutation.mutate(session.id)}
                  disabled={revokeMutation.isPending}
                  title="Revoke this device"
                >
                  <LinkBreak size={12} />
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="sync-section__footer">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => signOutMutation.mutate()}
          disabled={signOutMutation.isPending}
        >
          <SignOut size={12} />
          Sign out this device
        </button>
        {isMaster ? (
          <button
            type="button"
            className="btn btn-ghost sync-section__danger"
            onClick={() => {
              if (window.confirm('Delete your sync account and all synced data on the server?')) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            Delete sync account
          </button>
        ) : null}
      </div>

      {pushNowMutation.data?.overLimit ? (
        <div className="sync-section__notice sync-section__notice--warn">
          {pushNowMutation.data.excludedForLimit.length} file(s) were skipped to stay under
          the 10 MB cap. Turn off sync for large files to keep smaller ones syncing.
        </div>
      ) : null}
    </div>
  )
}
