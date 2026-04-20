import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Files, HardDrives, ChatsCircle, WarningCircle } from '@phosphor-icons/react'

import { pullBundle, previewMagicLink, redeemMagicLink } from '../../lib/sync/sync-client'
import { applySyncBundle } from '../../lib/sync/bundle'
import { suggestDeviceName } from '../../lib/sync/device-label'

import './sync.css'

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const SyncLinkPage = () => {
  const { token } = useParams({ from: '/sync/$token' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deviceName, setDeviceName] = useState('')
  const [hasEdited, setHasEdited] = useState(false)

  const previewQuery = useQuery({
    queryKey: ['sync-link-preview', token],
    queryFn: () => previewMagicLink(token),
    retry: false,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (hasEdited) return
    const city = previewQuery.data?.location.city ?? null
    setDeviceName(suggestDeviceName(city))
  }, [previewQuery.data, hasEdited])

  const redeemMutation = useMutation({
    mutationFn: async (name: string) => {
      const session = await redeemMagicLink(token, name)
      const bundle = await pullBundle()
      if (bundle) await applySyncBundle(bundle)
      return session
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] })
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      navigate({ to: '/' })
    },
    onError: () => {
      void previewQuery.refetch()
    },
  })

  const preview = previewQuery.data
  const bundle = preview?.bundle
  const previewError = previewQuery.error as Error | null

  if (previewError) {
    return (
      <main className="sync-link">
        <div className="sync-link__card sync-link__card--invalid">
          <div className="sync-link__icon-badge" aria-hidden>
            <WarningCircle size={28} weight="duotone" />
          </div>
          <h1 className="sync-link__title">This link can&rsquo;t be used</h1>
          <p className="sync-link__subtitle">{previewError.message}</p>
          <p className="sync-link__hint">
            Sync links are one-time use and expire after 30 minutes. Ask the master
            device to generate a fresh one.
          </p>
          <div className="sync-link__actions">
            <Link to="/" className="btn btn-primary">
              Back to app
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="sync-link">
      <div className="sync-link__card">
        <div className="sync-link__eyebrow">Sync</div>
        <h1 className="sync-link__title">Link this device</h1>
        <p className="sync-link__subtitle">
          This browser will download your PDFs, annotations, chats and settings
          from the master device. The master can revoke access any time.
        </p>

        {previewQuery.isLoading ? (
          <div className="sync-link__preview sync-link__preview--loading">
            Checking link…
          </div>
        ) : bundle ? (
          <div className="sync-link__preview">
            <div className="sync-link__preview-head">
              <span className="sync-link__preview-label">You&rsquo;ll download</span>
              <span className="sync-link__preview-size">
                {formatBytes(bundle.byteSize)}
              </span>
            </div>
            <div className="sync-link__preview-stats">
              <span className="sync-link__stat">
                <Files size={14} weight="duotone" />
                {bundle.documentCount} {bundle.documentCount === 1 ? 'PDF' : 'PDFs'}
              </span>
              <span className="sync-link__stat">
                <ChatsCircle size={14} weight="duotone" />
                {bundle.threadCount} {bundle.threadCount === 1 ? 'chat' : 'chats'}
              </span>
              <span className="sync-link__stat">
                <HardDrives size={14} weight="duotone" />
                from {bundle.updatedByDeviceName}
              </span>
            </div>
          </div>
        ) : (
          <div className="sync-link__preview sync-link__preview--empty">
            Nothing has been pushed yet &mdash; you&rsquo;ll start with an empty library.
          </div>
        )}

        <label className="sync-link__field">
          <span className="sync-link__label">Name this device</span>
          <input
            value={deviceName}
            onChange={(event) => {
              setHasEdited(true)
              setDeviceName(event.target.value)
            }}
            placeholder="e.g. MacBook in San Carlos"
          />
        </label>

        {redeemMutation.error ? (
          <div className="sync-link__notice sync-link__notice--error">
            {redeemMutation.error.message}
          </div>
        ) : null}

        <div className="sync-link__actions">
          <Link to="/" className="btn btn-ghost">
            Cancel
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => redeemMutation.mutate(deviceName.trim() || 'Linked device')}
            disabled={redeemMutation.isPending || previewQuery.isLoading}
          >
            {redeemMutation.isPending ? 'Linking…' : 'Link this device'}
          </button>
        </div>
      </div>
    </main>
  )
}
