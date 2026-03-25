import { extractDocumentFromFile } from './extract-document'
import { saveDocument, getOrCreateGlobalThread, updateSettings, listDocuments } from '../storage/db'

const DEMO_URL = '/demo.pdf'
const DEMO_NAME = 'PDFation Demo Document.pdf'

export const loadDemoPdfIfNeeded = async () => {
  const existing = await listDocuments()
  if (existing.length > 0) return null

  const response = await fetch(DEMO_URL)
  if (!response.ok) return null

  const blob = await response.blob()
  const file = new File([blob], DEMO_NAME, { type: 'application/pdf' })

  const document = await extractDocumentFromFile(file)
  await saveDocument(document)
  const settings = await updateSettings({ activeDocumentId: document.id })
  const globalThread = await getOrCreateGlobalThread(document.id)

  return { document, settings, globalThread }
}
