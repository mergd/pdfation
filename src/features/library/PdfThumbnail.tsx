import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

interface PdfThumbnailProps {
  blob: Blob
  width?: number
}

export const PdfThumbnail = ({ blob, width = 200 }: PdfThumbnailProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    let pdfDoc: PDFDocumentProxy | null = null
    let renderTask: RenderTask | null = null

    const render = async () => {
      const arrayBuffer = await blob.arrayBuffer()
      const pdf = await getDocument({ data: arrayBuffer }).promise

      if (cancelled) {
        await pdf.destroy()
        return
      }

      pdfDoc = pdf
      const page = await pdf.getPage(1)
      if (cancelled) return

      const viewport = page.getViewport({ scale: 1 })
      const scale = (width * window.devicePixelRatio) / viewport.width
      const scaled = page.getViewport({ scale })

      const canvas = canvasRef.current
      if (!canvas || cancelled) return

      canvas.width = scaled.width
      canvas.height = scaled.height
      canvas.style.width = `${scaled.width / window.devicePixelRatio}px`
      canvas.style.height = `${scaled.height / window.devicePixelRatio}px`

      renderTask = page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: scaled })
      await renderTask.promise
      renderTask = null
      if (!cancelled) setLoaded(true)
    }

    void render()

    return () => {
      cancelled = true
      renderTask?.cancel()
      if (pdfDoc) void pdfDoc.destroy()
    }
  }, [blob, width])

  return (
    <canvas
      ref={canvasRef}
      className={`pdf-thumbnail ${loaded ? 'pdf-thumbnail--loaded' : ''}`}
    />
  )
}
