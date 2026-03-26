import { createFileRoute } from '@tanstack/react-router'

import { ShareImportPage } from '../features/share/ShareImportPage'

export const Route = createFileRoute('/share/$token')({
  ssr: false,
  component: ShareImportPage,
})
