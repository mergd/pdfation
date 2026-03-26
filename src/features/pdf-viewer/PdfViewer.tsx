import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { AppDocument, AppThread } from "../../../shared/contracts";
import { PdfPage } from "./PdfPage";
import { SelectionPopover } from "./SelectionPopover";

import "./pdf-viewer.css";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface TextSelection {
  pageNumber: number;
  selectedText: string;
  textPrefix: string;
  textSuffix: string;
  rect: DOMRect;
}

interface PdfViewerProps {
  document: AppDocument | null;
  loading?: boolean;
  selectedThreadId: string | null;
  threads: AppThread[];
  onCreateComment: (payload: {
    pageNumber: number;
    selectedText: string;
    textPrefix: string;
    textSuffix: string;
  }) => void;
  onQuoteInChat: (quote: { text: string; pageNumber: number }) => void;
  onSelectThread: (threadId: string) => void;
}

export const PdfViewer = ({
  document: appDocument,
  loading = false,
  selectedThreadId,
  threads,
  onCreateComment,
  onQuoteInChat,
  onSelectThread,
}: PdfViewerProps) => {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const selectionRef = useRef<TextSelection | null>(null);
  const [visiblePage, setVisiblePage] = useState(1);
  const [goToInput, setGoToInput] = useState("");
  const [showGoTo, setShowGoTo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let currentPdf: PDFDocumentProxy | null = null;

    const loadPdf = async () => {
      if (!appDocument) {
        setPdf(null);
        return;
      }

      setPdf(null);
      const arrayBuffer = await appDocument.blob.arrayBuffer();
      const nextPdf = await getDocument({ data: arrayBuffer }).promise;

      if (cancelled) {
        await nextPdf.destroy();
        return;
      }

      currentPdf = nextPdf;
      setPdf(nextPdf);
    };

    void loadPdf();

    return () => {
      cancelled = true;
      if (currentPdf) void currentPdf.destroy();
    };
  }, [appDocument]);

  const handleTextSelect = useCallback((payload: TextSelection) => {
    selectionRef.current = payload;
    setSelection(payload);
  }, []);

  const handleComment = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel) return;
    onCreateComment({
      pageNumber: sel.pageNumber,
      selectedText: sel.selectedText,
      textPrefix: sel.textPrefix,
      textSuffix: sel.textSuffix,
    });
    selectionRef.current = null;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [onCreateComment]);

  const handleQuote = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel) return;
    onQuoteInChat({ text: sel.selectedText, pageNumber: sel.pageNumber });
    selectionRef.current = null;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [onQuoteInChat]);

  const handleDismiss = useCallback(() => {
    setSelection(null);
  }, []);

  const handlePageVisible = useCallback((pageNumber: number) => {
    setVisiblePage(pageNumber);
  }, []);

  const handleGoToPage = (event: React.FormEvent) => {
    event.preventDefault();
    const page = parseInt(goToInput, 10);
    if (!page || page < 1 || !appDocument || page > appDocument.pageCount)
      return;

    const container = scrollRef.current;
    if (!container) return;

    const target = container.querySelector(
      `[data-page="${page}"]`,
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setShowGoTo(false);
    setGoToInput("");
  };

  const showSkeleton = loading || (!!appDocument && !pdf);

  if (!appDocument && !loading) {
    return (
      <section className="pdf-viewer pdf-viewer--empty">
        <div className="pdf-viewer__empty-content">
          <h2>No document loaded</h2>
          <p>Upload a PDF to start highlighting and commenting.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="pdf-viewer">
      <header className="pdf-viewer__header">
        {appDocument ? (
          <h2>{appDocument.name}</h2>
        ) : (
          <div className="pdf-viewer__title-skeleton" aria-hidden="true" />
        )}
        <div className="pdf-viewer__nav">
          {appDocument && !showSkeleton && showGoTo ? (
            <form
              className="pdf-viewer__goto"
              onSubmit={handleGoToPage}
            >
              <input
                className="pdf-viewer__goto-input"
                type="number"
                min={1}
                max={appDocument.pageCount}
                value={goToInput}
                onChange={(e) => setGoToInput(e.target.value)}
                placeholder={`1–${appDocument.pageCount}`}
                autoFocus
                onBlur={() => {
                  if (!goToInput) setShowGoTo(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowGoTo(false);
                    setGoToInput("");
                  }
                }}
              />
              <button type="submit" className="pdf-viewer__goto-go">
                Go
              </button>
            </form>
          ) : appDocument ? (
            <button
              className="pdf-viewer__page-indicator"
              onClick={() => setShowGoTo(true)}
              title="Go to page"
              type="button"
            >
              <span>{showSkeleton ? 1 : visiblePage}</span>
              <span className="pdf-viewer__page-sep">/</span>
              <span>{appDocument.pageCount}</span>
            </button>
          ) : (
            <div className="pdf-viewer__page-indicator-skeleton" aria-hidden="true" />
          )}
        </div>
      </header>

      <div ref={scrollRef} className="pdf-viewer__scroll">
        {showSkeleton ? (
          <PdfViewerSkeleton pageCount={appDocument?.pageCount ?? 2} />
        ) : appDocument && pdf ? (
          Array.from({ length: appDocument.pageCount }, (_, i) => (
            <PdfPage
              key={i + 1}
              pageNumber={i + 1}
              pdf={pdf}
              selectedThreadId={selectedThreadId}
              threads={threads}
              onTextSelect={handleTextSelect}
              onSelectThread={onSelectThread}
              onPageVisible={handlePageVisible}
            />
          ))
        ) : (
          <div className="pdf-viewer__loading">Loading…</div>
        )}
      </div>

      <SelectionPopover
        selection={selection}
        onComment={handleComment}
        onQuote={handleQuote}
        onDismiss={handleDismiss}
      />
    </section>
  );
};

const PdfViewerSkeleton = ({ pageCount }: { pageCount: number }) => {
  const skeletonPages = Math.max(1, Math.min(pageCount, 2));

  return (
    <div className="pdf-viewer__skeleton" aria-hidden="true">
      {Array.from({ length: skeletonPages }, (_, index) => (
        <article key={index} className="pdf-page-card pdf-page-card--skeleton">
          <div className="pdf-page-card__label">
            <span>{index + 1}</span>
          </div>

          <div className="pdf-page-card__surface pdf-page-card__surface--skeleton">
            <div className="pdf-page-card__skeleton-content">
              <div className="pdf-page-card__skeleton-line pdf-page-card__skeleton-line--title" />
              <div className="pdf-page-card__skeleton-line pdf-page-card__skeleton-line--w-100" />
              <div className="pdf-page-card__skeleton-line pdf-page-card__skeleton-line--w-92" />
              <div className="pdf-page-card__skeleton-line pdf-page-card__skeleton-line--w-96" />
              <div className="pdf-page-card__skeleton-line pdf-page-card__skeleton-line--w-84" />
              <div className="pdf-page-card__skeleton-gap" />
              <div className="pdf-page-card__skeleton-line pdf-page-card__skeleton-line--w-88" />
              <div className="pdf-page-card__skeleton-line pdf-page-card__skeleton-line--w-100" />
              <div className="pdf-page-card__skeleton-line pdf-page-card__skeleton-line--w-90" />
              <div className="pdf-page-card__skeleton-line pdf-page-card__skeleton-line--w-72" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};
