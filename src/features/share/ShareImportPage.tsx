import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'

import type { AppBootstrap } from '../../lib/storage/db'
import { getSettings, updateSettings } from '../../lib/storage/db'
import { fetchShareBundle } from '../../lib/share/share-client'
import { importShareBundle } from '../../lib/share/local-share'

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

  return (
    <main className="share-page">
      <div className="share-page__card">
        <div className="share-page__eyebrow">Shared snapshot</div>
        <h1 className="share-page__title">
          {shareQuery.data?.document.name ?? 'Open shared PDF'}
        </h1>
        <p className="share-page__subtitle">
          {shareQuery.data
            ? `${shareQuery.data.sharedByName ?? 'Someone'} shared this PDF, comments, and chats. Importing creates an editable local copy in your browser.`
            : 'Loading the shared snapshot…'}
        </p>

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
                Expires {new Date(shareQuery.data.expiresAt).toLocaleString()}
              </span>
            </div>

            <label className="share-page__field">
              <span className="share-page__label">Your username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Optional display name"
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
