import { createFileRoute } from '@tanstack/react-router'

import { SyncLinkPage } from '../features/sync/SyncLinkPage'

export const Route = createFileRoute('/sync/$token')({
  ssr: false,
  component: SyncLinkPage,
})
