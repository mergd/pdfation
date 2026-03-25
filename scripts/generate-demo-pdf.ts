import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFile } from 'node:fs/promises'

const LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida.',
  'Praesent dapibus, neque id cursus faucibus, tortor neque egestas augue, eu vulputate magna eros eu erat. Aliquam erat volutpat. Nam dui mi, tincidunt quis, accumsan porttitor, facilisis luctus, metus.',
  'Phasellus ultrices nulla quis nibh. Quisque a lectus. Donec consectetuer ligula vulputate sem tristique cursus. Nam nulla quam, gravida non, commodo a, sodales sit amet, nisi.',
  'Pellentesque fermentum dolor. Aliquam quam lectus, facilisis auctor, ultrices ut, elementum vulputate, nunc. Sed adipiscing ornare risus. Morbi est est, blandit sit amet, sagittis vel, euismod vel, velit.',
]

const HEADINGS = [
  'Introduction',
  'Background',
  'Methodology',
  'Results and Discussion',
  'Key Observations',
  'Conclusion',
]

async function main() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 612
  const pageHeight = 792
  const margin = 72
  const lineHeight = 16
  const headingSize = 18
  const bodySize = 11
  const textWidth = pageWidth - margin * 2

  doc.setTitle('PDFation Demo Document')
  doc.setAuthor('PDFation')
  doc.setSubject('A sample document for testing inline comments and AI chat.')

  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // Title page
  page.drawText('PDFation', {
    x: margin,
    y: y - 40,
    size: 36,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.15),
  })
  y -= 70

  page.drawText('Demo Document', {
    x: margin,
    y,
    size: 20,
    font,
    color: rgb(0.4, 0.4, 0.5),
  })
  y -= 40

  page.drawText('This is a sample PDF for testing text selection, inline commenting,', {
    x: margin,
    y,
    size: bodySize,
    font,
    color: rgb(0.3, 0.3, 0.35),
  })
  y -= lineHeight
  page.drawText('and AI-powered document chat. Highlight any passage to get started.', {
    x: margin,
    y,
    size: bodySize,
    font,
    color: rgb(0.3, 0.3, 0.35),
  })
  y -= 50

  function wrapText(text: string, fontSize: number, f: typeof font): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      const width = f.widthOfTextAtSize(test, fontSize)
      if (width > textWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
    return lines
  }

  for (let i = 0; i < HEADINGS.length; i++) {
    if (y < margin + 100) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }

    page.drawText(HEADINGS[i], {
      x: margin,
      y,
      size: headingSize,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.15),
    })
    y -= headingSize + 12

    const paragraphs = [LOREM[i % LOREM.length], LOREM[(i + 1) % LOREM.length]]

    for (const para of paragraphs) {
      const lines = wrapText(para, bodySize, font)
      for (const line of lines) {
        if (y < margin) {
          page = doc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        page.drawText(line, {
          x: margin,
          y,
          size: bodySize,
          font,
          color: rgb(0.15, 0.15, 0.2),
        })
        y -= lineHeight
      }
      y -= 8
    }
    y -= 16
  }

  const bytes = await doc.save()
  await writeFile('public/demo.pdf', bytes)
  console.log(`Generated demo.pdf (${bytes.length} bytes, ${doc.getPageCount()} pages)`)
}

main()
