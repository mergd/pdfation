import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { getSettings } from '../../lib/storage/db'
import { applySyncBundle, buildSyncBundle } from '../../lib/sync/bundle'
import { fetchSyncStatus, pullBundle, pushBundle } from '../../lib/sync/sync-client'
import { onSyncDirty } from '../../lib/sync/trigger'

const PUSH_DEBOUNCE_MS = 2500

export const SyncOrchestrator = () => {
  const queryClient = useQueryClient()
  const enabledRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pushingRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const status = await fetchSyncStatus()
        if (cancelled) return
        if (!status.enabled) return

        enabledRef.current = true
        const bundle = await pullBundle()
        if (cancelled || !bundle) return

        const result = await applySyncBundle(bundle)
        if (result.mergedDocumentIds.length || result.mergedThreadIds.length) {
          queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] })
          queryClient.invalidateQueries({ queryKey: ['document-workspace'] })
        }
      } catch {
        // silent: offline or not signed in
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [queryClient])

  useEffect(() => {
    const schedulePush = async () => {
      if (!enabledRef.current) return
      if (pushingRef.current) return

      pushingRef.current = true
      try {
        const settings = await getSettings()
        const { bundle } = await buildSyncBundle(settings)
        await pushBundle(bundle)
        queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      } catch {
        // swallow; retry on next dirty
      } finally {
        pushingRef.current = false
      }
    }

    const unsubscribe = onSyncDirty(() => {
      if (!enabledRef.current) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(schedulePush, PUSH_DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [queryClient])

  return null
}
