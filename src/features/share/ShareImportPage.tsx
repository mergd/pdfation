import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'

import type { AppBootstrap } from '../../lib/storage/db'
import { getSettings, updateSettings } from '../../lib/storage/db'
import { fetchShareBundle } from '../../lib/share/share-client'
import { importShareBundle } from '../../lib/share/local-share'
import { base64ToBlob } from '../../lib/share/blob'
import { PdfThumbnail } from '../library/PdfThumbnail'

import './share.css'

export const ShareImportPage = () => {
  const { token } = useParams({ from: '/share/$token' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')

  const settingsQuery = useQuery({
    queryKey: ['app-settings'],
    queryFn: getSettings,
  })

  const shareQuery = useQuery({
    queryKey: ['document-share', token],
    queryFn: () => fetchShareBundle(token),
  })

  useEffect(() => {
    if (settingsQuery.data && !username) {
      setUsername(settingsQuery.data.username)
    }
  }, [settingsQuery.data, username])

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!shareQuery.data) {
        throw new Error('Share data is still loading.')
      }

      const trimmed = username.trim()
      if (settingsQuery.data && trimmed !== settingsQuery.data.username) {
        await updateSettings({ username: trimmed })
      }

      return importShareBundle(shareQuery.data)
    },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] })
      queryClient.setQueryData<AppBootstrap | undefined>(['app-bootstrap'], undefined)
      navigate({ to: '/doc/$id', params: { id: document.id } })
    },
  })

  const previewBlob = useMemo(() => {
    if (!shareQuery.data) return null
    const { base64, mimeType } = shareQuery.data.document.file
    return base64ToBlob(base64, mimeType)
  }, [shareQuery.data])

  return (
    <main className="share-page">
      <div className="share-page__card">
        <div className="share-page__eyebrow">Shared snapshot</div>

        <div className="share-page__hero">
          {previewBlob ? (
            <div className="share-page__thumbnail">
              <PdfThumbnail blob={previewBlob} width={120} />
            </div>
          ) : null}
          <div className="share-page__hero-text">
            <h1 className="share-page__title">
              {shareQuery.data?.document.name ?? 'Open shared PDF'}
            </h1>
            <p className="share-page__subtitle">
              {shareQuery.data
                ? `${shareQuery.data.sharedByName ?? 'Someone'} shared this PDF, comments, and chats. Importing creates an editable local copy in your browser.`
                : 'Loading the shared snapshot…'}
            </p>
          </div>
        </div>

        {shareQuery.isLoading ? (
          <div className="share-page__loading">Loading share…</div>
        ) : null}

        {shareQuery.error ? (
          <div className="share-page__notice share-page__notice--error">
            {shareQuery.error.message}
          </div>
        ) : null}

        {shareQuery.data ? (
          <>
            <div className="share-page__meta">
              <span className="badge badge-accent">
                {shareQuery.data.document.pageCount} pages
              </span>
              <span className="badge badge-muted">
                {shareQuery.data.threads.length} threads
              </span>
              <span className="badge badge-muted">
                Expires in {formatDistanceToNow(new Date(shareQuery.data.expiresAt))}
              </span>
            </div>

            <label className="share-page__field">
              <span className="share-page__label">Your display name</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. cosmic-falcon"
              />
              <span className="share-page__hint">
                New comments and chats on your imported copy will use this name.
              </span>
            </label>

            {importMutation.error ? (
              <div className="share-page__notice share-page__notice--error">
                {importMutation.error.message}
              </div>
            ) : null}

            <div className="share-page__actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? 'Importing…' : 'Import to my library'}
              </button>
              <Link to="/" className="btn btn-ghost">
                Back to library
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}
