import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { AppDocument, AppThread } from '../../../shared/contracts'
import { lookupExistingShare, syncShareContent } from '../../lib/share/share-client'
import { createShareBundle } from '../../lib/share/local-share'

const SYNC_INTERVAL_MS = 30_000

export const SHARE_LOOKUP_QUERY_KEY = 'active-share-lookup'

export const useShareAutoSync = (
  document: AppDocument | null,
  threads: AppThread[],
  deviceId: string | null,
  username: string,
) => {
  const latestRef = useRef({ document, threads, deviceId, username })
  latestRef.current = { document, threads, deviceId, username }

  const shareQuery = useQuery({
    queryKey: [SHARE_LOOKUP_QUERY_KEY, deviceId, document?.id],
    queryFn: () =>
      lookupExistingShare({
        deviceId: deviceId!,
        originalDocumentId: document!.id,
        origin: window.location.origin,
      }),
    enabled: !!deviceId && !!document,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  const token = shareQuery.data?.token ?? null

  useEffect(() => {
    if (!token) return

    const sync = async () => {
      const { document, threads, deviceId, username } = latestRef.current
      if (!document || !deviceId) return

      const bundle = await createShareBundle(document, threads, deviceId, username)
      await syncShareContent({ token, bundle })
    }

    const id = setInterval(sync, SYNC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [token])
}
