import {
  consumeSyncMagicLink,
  createSyncAccount,
  createSyncMagicLink,
  deleteSyncAccount,
  getSyncStatus,
  pullSyncBundle,
  pushSyncBundle,
  revokeSyncSession,
  signOutSyncSession,
} from './sync.functions'
import type { SyncBundleV1 } from '../../../shared/sync'

export const fetchSyncStatus = () => getSyncStatus()

export const enableSync = (deviceName: string) =>
  createSyncAccount({ data: { deviceName } })

export const requestMagicLink = (origin: string) =>
  createSyncMagicLink({ data: { origin } })

export const redeemMagicLink = (token: string, deviceName: string) =>
  consumeSyncMagicLink({ data: { token, deviceName } })

export const revokeSession = (sessionId: string) =>
  revokeSyncSession({ data: { sessionId } })

export const signOutSync = () => signOutSyncSession()

export const deleteSync = () => deleteSyncAccount()

export const pushBundle = (bundle: SyncBundleV1) =>
  pushSyncBundle({ data: { bundle } })

export const pullBundle = () => pullSyncBundle()
