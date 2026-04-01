import { extractDocumentFromFile } from './extract-document'
import { createDemoThreads } from './demo-seed'
import { getOrCreateGlobalThread, listAllDocuments, saveDocument, saveThread, updateSettings } from '../storage/db'

const DEMO_URL = '/demo.pdf'
const DEMO_NAME = 'PDFation Demo Document.pdf'

export const loadDemoPdfIfNeeded = async () => {
  const all = await listAllDocuments()
  if (all.length > 0) return null

  const response = await fetch(DEMO_URL)
  if (!response.ok) return null

  const blob = await response.blob()
  const file = new File([blob], DEMO_NAME, { type: 'application/pdf' })

  const document = await extractDocumentFromFile(file)
  document.isDemo = true
  await saveDocument(document)
  const settings = await updateSettings({ activeDocumentId: document.id })
  const globalThread = await getOrCreateGlobalThread(document.id)
  const seededThreads = createDemoThreads(document, settings, globalThread)

  for (const thread of seededThreads) {
    await saveThread(thread)
  }

  const seededGlobalThread = seededThreads.find((thread) => thread.id === globalThread.id) ?? globalThread

  return { document, settings, globalThread: seededGlobalThread }
}
