import { useEffect, useMemo, useState } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import { Select } from '@base-ui-components/react/select'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CaretDown, ShareNetwork, X } from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'

import type { AppDocument, AppThread } from '../../../shared/contracts'
import { MAX_SHARE_DURATION_SECONDS } from '../../../shared/share'
import { createShareLink, lookupExistingShare } from '../../lib/share/share-client'
import { createShareBundle } from '../../lib/share/local-share'

import './share.css'

const SHARE_DURATION_OPTIONS = [
  { value: 60 * 60, label: '1 hour' },
  { value: 24 * 60 * 60, label: '1 day' },
  { value: MAX_SHARE_DURATION_SECONDS, label: '3 days' },
]

interface ShareDialogProps {
  document: AppDocument
  threads: AppThread[]
  deviceId: string
  username: string
}

export const ShareDialog = ({
  document,
  threads,
  deviceId,
  username,
}: ShareDialogProps) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [durationSeconds, setDurationSeconds] = useState(MAX_SHARE_DURATION_SECONDS)
  const [copied, setCopied] = useState(false)

  const existingQuery = useQuery({
    queryKey: ['existing-share', document.id, deviceId],
    queryFn: () =>
      lookupExistingShare({
        deviceId,
        originalDocumentId: document.id,
        origin: window.location.origin,
      }),
    enabled: dialogOpen,
    staleTime: 0,
  })

  const shareMutation = useMutation({
    mutationFn: async () => {
      const bundle = await createShareBundle(document, threads, deviceId, username)
      return createShareLink({
        bundle,
        expiresInSeconds: durationSeconds,
        origin: window.location.origin,
      })
    },
  })

  useEffect(() => {
    if (!existingQuery.data || shareMutation.data || shareMutation.isPending) return

    shareMutation.mutate()
  }, [existingQuery.data, shareMutation.data, shareMutation.isPending])

  const shareResult = shareMutation.data ?? existingQuery.data
  const hasExistingShare = !!existingQuery.data
  const isLoading = existingQuery.isLoading

  const durationLabel = useMemo(
    () =>
      SHARE_DURATION_OPTIONS.find((option) => option.value === durationSeconds)?.label ??
      'Custom',
    [durationSeconds],
  )

  const handleCopy = async () => {
    if (!shareResult?.shareUrl) return
    await navigator.clipboard.writeText(shareResult.shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Dialog.Root
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) {
          shareMutation.reset()
          setCopied(false)
        }
      }}
    >
      <Dialog.Trigger className="btn btn-ghost share-trigger" title="Share document">
        <ShareNetwork size={15} weight="bold" />
        <span>Share</span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="share-backdrop" />
        <Dialog.Popup className="share-dialog">
          <header className="share-dialog__header">
            <div>
              <Dialog.Title className="share-dialog__title">Share snapshot</Dialog.Title>
              <p className="share-dialog__subtitle">
                Anyone with the link can import this PDF, comments, and chats to their own
                browser.
              </p>
            </div>
            <Dialog.Close className="share-dialog__close" aria-label="Close">
              <X size={14} weight="bold" />
            </Dialog.Close>
          </header>

          <div className="share-dialog__body">
            {isLoading ? (
              <div className="share-dialog__field">
                <span className="share-dialog__hint">Checking for existing share…</span>
              </div>
            ) : null}

            {shareResult ? (
              <div className="share-dialog__result">
                <label className="share-dialog__label" htmlFor="share-link">
                  Share link
                </label>
                <div className="share-dialog__result-row">
                  <input
                    id="share-link"
                    className="share-dialog__input"
                    readOnly
                    value={shareResult.shareUrl}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost share-dialog__copy"
                    onClick={handleCopy}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="share-dialog__hint">
                  {shareMutation.isPending && hasExistingShare
                    ? 'Updating shared content…'
                    : `Expires in ${formatDistanceToNow(new Date(shareResult.expiresAt))}.`}
                </p>
              </div>
            ) : null}

            {!isLoading && !hasExistingShare && !shareMutation.data ? (
              <>
                <div className="share-dialog__field">
                  <span className="share-dialog__label">What gets shared</span>
                  <div className="share-dialog__summary">
                    <span className="badge badge-accent">{document.pageCount} pages</span>
                    <span className="badge badge-muted">{threads.length} threads</span>
                    <span className="badge badge-muted">
                      {username.trim() ? `Shared as ${username.trim()}` : 'Shared anonymously'}
                    </span>
                  </div>
                </div>

                <div className="share-dialog__field">
                  <label className="share-dialog__label" htmlFor="share-duration">
                    Link lifetime
                  </label>
                  <div className="share-dialog__select-wrap">
                    <Select.Root
                      value={durationSeconds}
                      items={SHARE_DURATION_OPTIONS}
                      onValueChange={(value) => {
                        if (value !== null) {
                          setDurationSeconds(value)
                        }
                      }}
                    >
                      <Select.Trigger id="share-duration" className="share-dialog__select">
                        <Select.Value />
                        <Select.Icon className="share-dialog__select-chevron">
                          <CaretDown size={12} weight="bold" />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Positioner className="share-dialog__select-positioner" sideOffset={6}>
                          <Select.Popup className="share-dialog__select-popup">
                            <Select.List className="share-dialog__select-list">
                              {SHARE_DURATION_OPTIONS.map((option) => (
                                <Select.Item
                                  key={option.value}
                                  value={option.value}
                                  className="share-dialog__select-item"
                                >
                                  <Select.ItemText>{option.label}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.List>
                          </Select.Popup>
                        </Select.Positioner>
                      </Select.Portal>
                    </Select.Root>
                  </div>
                  <p className="share-dialog__hint">
                    Links expire automatically after {durationLabel.toLowerCase()}.
                  </p>
                </div>

                <div className="share-dialog__field">
                  <button
                    type="button"
                    className="btn btn-primary share-dialog__create"
                    onClick={() => shareMutation.mutate()}
                    disabled={shareMutation.isPending}
                  >
                    {shareMutation.isPending ? 'Creating link…' : 'Create share link'}
                  </button>
                </div>
              </>
            ) : null}

            {shareMutation.error ? (
              <p className="share-dialog__error">{shareMutation.error.message}</p>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
