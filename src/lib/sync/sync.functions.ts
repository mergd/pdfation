import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  setCookie,
  setResponseStatus,
} from '@tanstack/react-start/server'
import { z } from 'zod'

import type {
  SyncAccount,
  SyncBundleV1,
  SyncMagicLink,
  SyncSession,
  SyncStatusView,
} from '../../../shared/sync'
import {
  MAX_SYNC_BUNDLE_BYTES,
  SYNC_COOKIE_NAME,
  SYNC_MAGIC_LINK_TTL_SECONDS,
  SYNC_SESSION_MAX_AGE_SECONDS,
} from '../../../shared/sync'

const ACCOUNT_PREFIX = 'sync-account:'
const SESSION_PREFIX = 'sync-session:'
const ACCOUNT_SESSIONS_PREFIX = 'sync-account-sessions:'
const MAGIC_PREFIX = 'sync-magic:'
const BUNDLE_KEY = (accountId: string) => `sync/${accountId}.json`

const encoder = new TextEncoder()

const ensureBindings = () => {
  if (!env.SHARES || !env.SHARE_BUNDLES) {
    throw new Error('Sync storage is not configured on the server.')
  }
}

const accountKey = (id: string) => `${ACCOUNT_PREFIX}${id}`
const sessionKey = (id: string) => `${SESSION_PREFIX}${id}`
const accountSessionsKey = (id: string) => `${ACCOUNT_SESSIONS_PREFIX}${id}`
const magicKey = (token: string) => `${MAGIC_PREFIX}${token}`

const newId = (prefix = '') => `${prefix}${crypto.randomUUID().replace(/-/g, '')}`

const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: true,
  path: '/',
  maxAge: maxAgeSeconds,
})

const setSessionCookie = (sessionId: string) => {
  setCookie(SYNC_COOKIE_NAME, sessionId, cookieOptions(SYNC_SESSION_MAX_AGE_SECONDS))
}

const clearSessionCookie = () => {
  deleteCookie(SYNC_COOKIE_NAME, { path: '/' })
}

const loadSession = async (sessionId: string): Promise<SyncSession | null> => {
  const session = await env.SHARES.get<SyncSession>(sessionKey(sessionId), 'json')
  if (!session) return null
  if (session.revokedAt) return null
  return session
}

const loadAccount = async (accountId: string): Promise<SyncAccount | null> =>
  env.SHARES.get<SyncAccount>(accountKey(accountId), 'json')

const persistSession = async (session: SyncSession) => {
  await env.SHARES.put(sessionKey(session.id), JSON.stringify(session))
}

const persistAccount = async (account: SyncAccount) => {
  await env.SHARES.put(accountKey(account.id), JSON.stringify(account))
}

const readSessionList = async (accountId: string): Promise<string[]> => {
  const list = await env.SHARES.get<string[]>(accountSessionsKey(accountId), 'json')
  return list ?? []
}

const writeSessionList = async (accountId: string, ids: string[]) => {
  await env.SHARES.put(accountSessionsKey(accountId), JSON.stringify(ids))
}

const addSessionToAccount = async (accountId: string, sessionId: string) => {
  const ids = await readSessionList(accountId)
  if (ids.includes(sessionId)) return
  await writeSessionList(accountId, [...ids, sessionId])
}

const stripAccountId = (session: SyncSession): Omit<SyncSession, 'accountId'> => {
  const { accountId, ...rest } = session
  void accountId
  return rest
}

const listSessionsForAccount = async (
  accountId: string,
): Promise<SyncSession[]> => {
  const ids = await readSessionList(accountId)
  const records = await Promise.all(ids.map((id) => env.SHARES.get<SyncSession>(sessionKey(id), 'json')))
  return records.filter((r): r is SyncSession => !!r)
}

const touchSession = async (session: SyncSession): Promise<SyncSession> => {
  const updated: SyncSession = { ...session, lastSeenAt: new Date().toISOString() }
  await persistSession(updated)
  return updated
}

const loadBundle = async (accountId: string): Promise<SyncBundleV1 | null> => {
  const object = await env.SHARE_BUNDLES.get(BUNDLE_KEY(accountId))
  if (!object) return null
  return (await object.json()) as SyncBundleV1
}

const requireCurrentSession = async (): Promise<{
  account: SyncAccount
  session: SyncSession
}> => {
  ensureBindings()
  const sessionId = getCookie(SYNC_COOKIE_NAME)
  if (!sessionId) {
    setResponseStatus(401)
    throw new Error('Not signed in to sync.')
  }

  const session = await loadSession(sessionId)
  if (!session) {
    setResponseStatus(401)
    throw new Error('Sync session is no longer active.')
  }

  const account = await loadAccount(session.accountId)
  if (!account) {
    setResponseStatus(401)
    throw new Error('Sync account was not found.')
  }

  return { account, session }
}

export const createSyncAccount = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ deviceName: z.string().min(1).max(64) }))
  .handler(async ({ data }) => {
    ensureBindings()

    const existingCookie = getCookie(SYNC_COOKIE_NAME)
    if (existingCookie) {
      const existing = await loadSession(existingCookie)
      if (existing) {
        setResponseStatus(409)
        throw new Error('This device is already linked to a sync account.')
      }
    }

    const now = new Date().toISOString()
    const accountId = newId('a_')
    const sessionId = newId('s_')

    const account: SyncAccount = {
      id: accountId,
      createdAt: now,
      masterSessionId: sessionId,
    }
    const session: SyncSession = {
      id: sessionId,
      accountId,
      deviceName: data.deviceName.trim() || 'This device',
      createdAt: now,
      lastSeenAt: now,
      isMaster: true,
      revokedAt: null,
    }

    await persistAccount(account)
    await persistSession(session)
    await addSessionToAccount(accountId, sessionId)

    setSessionCookie(sessionId)

    return { account, session: stripAccountId(session) }
  })

export const getSyncStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SyncStatusView> => {
    ensureBindings()
    const sessionId = getCookie(SYNC_COOKIE_NAME)
    if (!sessionId) {
      return { enabled: false, account: null, currentSession: null, sessions: [], bundle: null }
    }

    const session = await loadSession(sessionId)
    if (!session) {
      clearSessionCookie()
      return { enabled: false, account: null, currentSession: null, sessions: [], bundle: null }
    }

    const account = await loadAccount(session.accountId)
    if (!account) {
      clearSessionCookie()
      return { enabled: false, account: null, currentSession: null, sessions: [], bundle: null }
    }

    const [sessions, bundle] = await Promise.all([
      listSessionsForAccount(account.id),
      loadBundle(account.id),
    ])
    const touched = await touchSession(session)

    return {
      enabled: true,
      account: { id: account.id, createdAt: account.createdAt },
      currentSession: stripAccountId(touched),
      sessions: sessions
        .filter((s) => !s.revokedAt)
        .map((s) => stripAccountId(s))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      bundle: bundle
        ? {
            updatedAt: bundle.updatedAt,
            updatedByDeviceName: bundle.updatedByDeviceName,
            byteSize: encoder.encode(JSON.stringify(bundle)).byteLength,
            documentCount: bundle.documents.length,
            threadCount: bundle.threads.length,
          }
        : null,
    }
  },
)

export const createSyncMagicLink = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ origin: z.string().url() }))
  .handler(async ({ data }) => {
    const { account, session } = await requireCurrentSession()
    if (!session.isMaster) {
      setResponseStatus(403)
      throw new Error('Only the master device can issue sync links.')
    }

    const token = newId()
    const expiresAt = new Date(Date.now() + SYNC_MAGIC_LINK_TTL_SECONDS * 1000).toISOString()
    const magic: SyncMagicLink = {
      token,
      accountId: account.id,
      createdBySessionId: session.id,
      expiresAt,
      consumed: false,
    }

    await env.SHARES.put(magicKey(token), JSON.stringify(magic), {
      expirationTtl: SYNC_MAGIC_LINK_TTL_SECONDS,
    })

    const url = `${data.origin.replace(/\/$/, '')}/sync/${token}`
    return { token, url, expiresAt }
  })

export const previewSyncMagicLink = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ token: z.string().min(1).max(128) }))
  .handler(async ({ data }) => {
    ensureBindings()

    const magic = await env.SHARES.get<SyncMagicLink>(magicKey(data.token), 'json')
    if (!magic) {
      setResponseStatus(404)
      throw new Error('This sync link is not valid or has expired.')
    }
    if (magic.consumed) {
      setResponseStatus(410)
      throw new Error('This sync link has already been used.')
    }
    if (new Date(magic.expiresAt).getTime() <= Date.now()) {
      setResponseStatus(410)
      throw new Error('This sync link has expired.')
    }

    const account = await loadAccount(magic.accountId)
    if (!account) {
      setResponseStatus(404)
      throw new Error('This sync account no longer exists.')
    }

    const bundle = await loadBundle(account.id)
    const preview = bundle
      ? {
          byteSize: encoder.encode(JSON.stringify(bundle)).byteLength,
          documentCount: bundle.documents.length,
          threadCount: bundle.threads.length,
          updatedAt: bundle.updatedAt,
          updatedByDeviceName: bundle.updatedByDeviceName,
        }
      : null

    const rawCity = getRequestHeader('cf-ipcity')
    const city = rawCity ? decodeURIComponent(rawCity) : null
    const country = getRequestHeader('cf-ipcountry') ?? null

    return {
      expiresAt: magic.expiresAt,
      bundle: preview,
      location: { city, country },
    }
  })

export const consumeSyncMagicLink = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      token: z.string().min(1).max(128),
      deviceName: z.string().min(1).max(64),
    }),
  )
  .handler(async ({ data }) => {
    ensureBindings()

    const magic = await env.SHARES.get<SyncMagicLink>(magicKey(data.token), 'json')
    if (!magic) {
      setResponseStatus(404)
      throw new Error('This sync link is not valid or has expired.')
    }

    if (magic.consumed) {
      setResponseStatus(410)
      throw new Error('This sync link has already been used.')
    }

    if (new Date(magic.expiresAt).getTime() <= Date.now()) {
      setResponseStatus(410)
      throw new Error('This sync link has expired.')
    }

    const account = await loadAccount(magic.accountId)
    if (!account) {
      setResponseStatus(404)
      throw new Error('This sync account no longer exists.')
    }

    const now = new Date().toISOString()
    const sessionId = newId('s_')
    const session: SyncSession = {
      id: sessionId,
      accountId: account.id,
      deviceName: data.deviceName.trim() || 'Linked device',
      createdAt: now,
      lastSeenAt: now,
      isMaster: false,
      revokedAt: null,
    }

    await persistSession(session)
    await addSessionToAccount(account.id, sessionId)
    await env.SHARES.put(
      magicKey(data.token),
      JSON.stringify({ ...magic, consumed: true } satisfies SyncMagicLink),
      { expirationTtl: 60 },
    )

    setSessionCookie(sessionId)

    return { account: { id: account.id, createdAt: account.createdAt }, session: stripAccountId(session) }
  })

export const revokeSyncSession = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ sessionId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { account, session: caller } = await requireCurrentSession()
    if (!caller.isMaster) {
      setResponseStatus(403)
      throw new Error('Only the master device can revoke sessions.')
    }

    const target = await env.SHARES.get<SyncSession>(sessionKey(data.sessionId), 'json')
    if (!target || target.accountId !== account.id) {
      setResponseStatus(404)
      throw new Error('Session not found.')
    }

    if (target.isMaster) {
      setResponseStatus(400)
      throw new Error('Use "sign out everywhere" to revoke the master device.')
    }

    const updated: SyncSession = { ...target, revokedAt: new Date().toISOString() }
    await persistSession(updated)
    const ids = await readSessionList(account.id)
    await writeSessionList(
      account.id,
      ids.filter((id) => id !== target.id),
    )

    return { revoked: true as const }
  })

export const signOutSyncSession = createServerFn({ method: 'POST' }).handler(async () => {
  ensureBindings()
  const sessionId = getCookie(SYNC_COOKIE_NAME)
  if (sessionId) {
    const session = await env.SHARES.get<SyncSession>(sessionKey(sessionId), 'json')
    if (session) {
      await persistSession({ ...session, revokedAt: new Date().toISOString() })
      const ids = await readSessionList(session.accountId)
      await writeSessionList(
        session.accountId,
        ids.filter((id) => id !== session.id),
      )
    }
  }

  clearSessionCookie()
  return { signedOut: true as const }
})

export const deleteSyncAccount = createServerFn({ method: 'POST' }).handler(async () => {
  const { account, session } = await requireCurrentSession()
  if (!session.isMaster) {
    setResponseStatus(403)
    throw new Error('Only the master device can delete the sync account.')
  }

  const ids = await readSessionList(account.id)
  await Promise.all([
    ...ids.map((id) => env.SHARES.delete(sessionKey(id))),
    env.SHARES.delete(accountSessionsKey(account.id)),
    env.SHARES.delete(accountKey(account.id)),
    env.SHARE_BUNDLES.delete(BUNDLE_KEY(account.id)),
  ])

  clearSessionCookie()
  return { deleted: true as const }
})

const bundleSchema = z.custom<SyncBundleV1>()

export const pushSyncBundle = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ bundle: bundleSchema }))
  .handler(async ({ data }) => {
    const { account, session } = await requireCurrentSession()

    const bundle: SyncBundleV1 = {
      ...data.bundle,
      updatedAt: new Date().toISOString(),
      updatedBySessionId: session.id,
      updatedByDeviceName: session.deviceName,
    }
    const json = JSON.stringify(bundle)
    const byteSize = encoder.encode(json).byteLength

    if (byteSize > MAX_SYNC_BUNDLE_BYTES) {
      setResponseStatus(413)
      throw new Error('Sync bundle exceeds the 10 MB cap. Exclude some files from sync to continue.')
    }

    await env.SHARE_BUNDLES.put(BUNDLE_KEY(account.id), json, {
      httpMetadata: { contentType: 'application/json' },
    })
    await touchSession(session)

    return {
      updatedAt: bundle.updatedAt,
      byteSize,
    }
  })

export const pullSyncBundle = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SyncBundleV1 | null> => {
    const { account, session } = await requireCurrentSession()
    await touchSession(session)
    return loadBundle(account.id)
  },
)
