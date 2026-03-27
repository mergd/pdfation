import type { DocumentShareBundleV1 } from '../../../shared/share'
import { createDocumentShare, getDocumentShare, lookupDocumentShare } from './share.functions'

export const createShareLink = async (input: {
  bundle: DocumentShareBundleV1
  expiresInSeconds: number
  origin: string
}) => createDocumentShare({ data: input })

export const lookupExistingShare = async (input: {
  deviceId: string
  originalDocumentId: string
  origin: string
}) => lookupDocumentShare({ data: input })

export const fetchShareBundle = async (token: string) =>
  getDocumentShare({ data: { token } })
