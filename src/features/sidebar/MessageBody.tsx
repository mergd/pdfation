import { Children, cloneElement, isValidElement, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const PAGE_REF_PATTERN = /\[p\.\s*(\d+)\]/g

function splitPageRefs(
  text: string,
  onPageClick: (page: number) => void,
): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  const regex = new RegExp(PAGE_REF_PATTERN.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const page = Number(match[1])
    parts.push(
      <button
        key={`pr-${match.index}`}
        type="button"
        className="page-ref"
        onClick={(e) => {
          e.stopPropagation()
          onPageClick(page)
        }}
        title={`Go to page ${page}`}
      >
        p.{page}
      </button>,
    )
    lastIndex = match.index + match[0].length
  }

  if (parts.length === 0) return [text]
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function walkChildren(
  children: ReactNode,
  onPageClick: (page: number) => void,
): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      const parts = splitPageRefs(child, onPageClick)
      return parts.length === 1 && typeof parts[0] === 'string' ? (
        child
      ) : (
        <>{parts}</>
      )
    }
    if (
      isValidElement<{ children?: ReactNode }>(child) &&
      child.props.children != null
    ) {
      return cloneElement(
        child,
        {},
        walkChildren(child.props.children, onPageClick),
      )
    }
    return child
  })
}

interface MessageBodyProps {
  content: string
  onPageClick: (pageNumber: number) => void
}

export const MessageBody = ({ content, onPageClick }: MessageBodyProps) => {
  const walk = (children: ReactNode) => walkChildren(children, onPageClick)

  return (
    <div className="message-body">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{walk(children)}</p>,
          li: ({ children }) => <li>{walk(children)}</li>,
          td: ({ children }) => <td>{walk(children)}</td>,
          th: ({ children }) => <th>{walk(children)}</th>,
          h1: ({ children }) => <h1>{walk(children)}</h1>,
          h2: ({ children }) => <h2>{walk(children)}</h2>,
          h3: ({ children }) => <h3>{walk(children)}</h3>,
          h4: ({ children }) => <h4>{walk(children)}</h4>,
          blockquote: ({ children }) => (
            <blockquote>{walk(children)}</blockquote>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
