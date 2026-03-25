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
  selectedThreadId: string | null;
  threads: AppThread[];
  onCreateComment: (payload: {
    pageNumber: number;
    selectedText: string;
    textPrefix: string;
    textSuffix: string;
  }) => void;
  onQuoteInChat: (text: string) => void;
  onSelectThread: (threadId: string) => void;
}

export const PdfViewer = ({
  document: appDocument,
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
    onQuoteInChat(sel.selectedText);
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

  if (!appDocument) {
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
        <h2>{appDocument.name}</h2>
        <div className="pdf-viewer__nav">
          {showGoTo ? (
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
          ) : (
            <button
              className="pdf-viewer__page-indicator"
              onClick={() => setShowGoTo(true)}
              title="Go to page"
              type="button"
            >
              <span>{visiblePage}</span>
              <span className="pdf-viewer__page-sep">/</span>
              <span>{appDocument.pageCount}</span>
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="pdf-viewer__scroll">
        {pdf ? (
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
