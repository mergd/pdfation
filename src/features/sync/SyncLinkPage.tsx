import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'

import { getSettings } from '../../lib/storage/db'
import { pullBundle, redeemMagicLink } from '../../lib/sync/sync-client'
import { applySyncBundle } from '../../lib/sync/bundle'

import './sync.css'

export const SyncLinkPage = () => {
  const { token } = useParams({ from: '/sync/$token' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deviceName, setDeviceName] = useState('')

  useEffect(() => {
    void getSettings().then((settings) => {
      if (!deviceName) setDeviceName(settings.username || 'This device')
    })
  }, [deviceName])

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
  })

  return (
    <main className="sync-link">
      <div className="sync-link__card">
        <div className="sync-link__eyebrow">Sync</div>
        <h1 className="sync-link__title">Link this device</h1>
        <p className="sync-link__subtitle">
          Connecting this browser will pull your PDFs, annotations, chats and settings
          from your sync account. The master device can revoke this link any time.
        </p>

        <label className="sync-link__field">
          <span className="sync-link__label">Name this device</span>
          <input
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            placeholder="e.g. MacBook, Home Chrome…"
          />
        </label>

        {redeemMutation.error ? (
          <div className="sync-link__notice sync-link__notice--error">
            {redeemMutation.error.message}
          </div>
        ) : null}

        <div className="sync-link__actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => redeemMutation.mutate(deviceName.trim() || 'Linked device')}
            disabled={redeemMutation.isPending}
          >
            {redeemMutation.isPending ? 'Linking…' : 'Link this device'}
          </button>
          <Link to="/" className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </div>
    </main>
  )
}
