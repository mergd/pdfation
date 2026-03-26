import type { ReactNode } from "react";

const PAGE_REF_REGEX = /\[p\.\s*(\d+)\]/g;

interface MessageBodyProps {
  content: string;
  onPageClick: (pageNumber: number) => void;
}

export const MessageBody = ({ content, onPageClick }: MessageBodyProps) => {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = PAGE_REF_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const page = Number(match[1]);
    parts.push(
      <button
        key={`${match.index}-${page}`}
        type="button"
        className="page-ref"
        onClick={(e) => {
          e.stopPropagation();
          onPageClick(page);
        }}
        title={`Go to page ${page}`}
      >
        p.{page}
      </button>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  if (parts.length === 0) return <>{content}</>;
  return <>{parts}</>;
};
