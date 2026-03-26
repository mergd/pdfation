import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'

import type { DocumentShareBundleV1, ShareRecord } from '../../../shared/share'
import { MAX_SHARE_DURATION_SECONDS, MAX_TOTAL_SHARED_BYTES } from '../../../shared/share'

const SHARE_TOKEN_LENGTH = 18
const SHARE_OBJECT_PREFIX = 'shares/'
const SHARE_RECORD_PREFIX = 'share-record:'
const SHARE_DOCUMENT_PREFIX = 'share-document:'
const encoder = new TextEncoder()

const shareBundleSchema = z.custom<DocumentShareBundleV1>()

const createShareInputSchema = z.object({
  bundle: shareBundleSchema,
  expiresInSeconds: z.number().int().positive().max(MAX_SHARE_DURATION_SECONDS),
  origin: z.string().url(),
})

const shareLookupInputSchema = z.object({
  token: z.string().min(1).max(64),
})

const createShareToken = () => {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(SHARE_TOKEN_LENGTH)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('')
}

const ensureShareBindings = () => {
  if (!env.SHARE_BUNDLES || !env.SHARES) {
    throw new Error('Share storage is not configured on the server.')
  }
}

const shareRecordKey = (token: string) => `${SHARE_RECORD_PREFIX}${token}`

const shareDocumentKey = (deviceId: string, originalDocumentId: string) =>
  `${SHARE_DOCUMENT_PREFIX}${deviceId}:${originalDocumentId}`

const shareBundleKey = (token: string) => `${SHARE_OBJECT_PREFIX}${token}.json`

const isExpired = (expiresAt: string) => new Date(expiresAt).getTime() <= Date.now()

const listActiveShareRecords = async (): Promise<ShareRecord[]> => {
  ensureShareBindings()

  const records: ShareRecord[] = []
  let cursor: string | undefined

  do {
    const page = await env.SHARES.list({ prefix: SHARE_RECORD_PREFIX, cursor })
    const pageRecords = await Promise.all(
      page.keys.map(async ({ name }: { name: string }) => env.SHARES.get<ShareRecord>(name, 'json')),
    )

    records.push(
      ...pageRecords.filter(
        (record: ShareRecord | null): record is ShareRecord =>
          !!record && !isExpired(record.expiresAt),
      ),
    )
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)

  return records
}

const deleteShareRecord = async (record: ShareRecord | null) => {
  if (!record) return

  await Promise.all([
    env.SHARE_BUNDLES.delete(record.bundleKey),
    env.SHARES.delete(shareRecordKey(record.token)),
    env.SHARES.delete(shareDocumentKey(record.sharedByDeviceId, record.originalDocumentId)),
  ])
}

const readBundle = async (token: string): Promise<DocumentShareBundleV1 | null> => {
  ensureShareBindings()
  const record = await env.SHARES.get<ShareRecord>(shareRecordKey(token), 'json')

  if (!record) {
    setResponseStatus(404)
    throw new Error('This share link could not be found.')
  }

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    setResponseStatus(410)
    throw new Error('This share link has expired.')
  }

  const object = await env.SHARE_BUNDLES.get(record.bundleKey)
  if (!object) {
    setResponseStatus(404)
    throw new Error('This share payload is no longer available.')
  }

  const bundle = (await object.json()) as DocumentShareBundleV1
  if (new Date(bundle.expiresAt).getTime() <= Date.now()) {
    setResponseStatus(410)
    throw new Error('This share link has expired.')
  }

  return bundle
}

export const createDocumentShare = createServerFn({ method: 'POST' })
  .inputValidator(createShareInputSchema)
  .handler(async ({ data }) => {
    ensureShareBindings()

    const createdAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + data.expiresInSeconds * 1000).toISOString()
    const existingShareToken = await env.SHARES.get(
      shareDocumentKey(data.bundle.sharedByDeviceId, data.bundle.document.originalDocumentId),
    )
    const existingRecord = existingShareToken
      ? await env.SHARES.get<ShareRecord>(shareRecordKey(existingShareToken), 'json')
      : null
    const activeRecords = await listActiveShareRecords()
    const bytesInUse = activeRecords.reduce(
      (sum, record) => (record.token === existingRecord?.token ? sum : sum + record.byteSize),
      0,
    )
    const token = createShareToken()
    const bundleKey = shareBundleKey(token)
    const bundle: DocumentShareBundleV1 = {
      ...data.bundle,
      sharedAt: createdAt,
      expiresAt,
    }
    const bundleJson = JSON.stringify(bundle)
    const byteSize = encoder.encode(bundleJson).byteLength

    if (byteSize > MAX_TOTAL_SHARED_BYTES) {
      setResponseStatus(413)
      throw new Error('This file is too large to share within the 1 GB global storage cap.')
    }

    if (bytesInUse + byteSize > MAX_TOTAL_SHARED_BYTES) {
      setResponseStatus(507)
      throw new Error('Share storage is full right now. Re-share an existing file or wait for older links to expire.')
    }

    const record: ShareRecord = {
      token,
      bundleKey,
      createdAt,
      documentName: bundle.document.name,
      expiresAt,
      pageCount: bundle.document.pageCount,
      byteSize,
      sharedByDeviceId: bundle.sharedByDeviceId,
      sharedByName: bundle.sharedByName,
      originalDocumentId: bundle.document.originalDocumentId,
    }

    if (existingRecord) {
      await deleteShareRecord(existingRecord)
    }

    await Promise.all([
      env.SHARE_BUNDLES.put(bundleKey, bundleJson, {
        httpMetadata: { contentType: 'application/json' },
      }),
      env.SHARES.put(shareRecordKey(token), JSON.stringify(record), {
        expirationTtl: data.expiresInSeconds,
      }),
      env.SHARES.put(
        shareDocumentKey(bundle.sharedByDeviceId, bundle.document.originalDocumentId),
        token,
        { expirationTtl: data.expiresInSeconds },
      ),
    ])

    return {
      token,
      expiresAt,
      shareUrl: `${data.origin.replace(/\/$/, '')}/share/${token}`,
    }
  })

export const getDocumentShare = createServerFn({ method: 'POST' })
  .inputValidator(shareLookupInputSchema)
  .handler(async ({ data }) => readBundle(data.token))
