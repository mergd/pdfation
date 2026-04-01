import { useState } from "react";
import { Dialog } from "@base-ui-components/react/dialog";
import { ArrowLeft, ArrowRight, Sparkle, X } from "@phosphor-icons/react";

import "./onboarding-dialog.css";

const SLIDES = [
  {
    badge: "Workspace",
    heading: "Read, highlight, and chat — all in one view",
    body: "Open any PDF and start working. Highlight a passage to leave an inline annotation or pull it straight into a conversation.",
    imageAlt: "The pdfation workspace with the document viewer open.",
    imageSrc: "/onboarding/workspace.png",
    imagePosition: "center top",
  },
  {
    badge: "Library",
    heading: "Your documents, always a click away",
    body: "Upload files and organise them visually. Jump back into any document without searching through folders.",
    imageAlt: "The pdfation library showing document cards.",
    imageSrc: "/onboarding/library.png",
    imagePosition: "center top",
  },
  {
    badge: "AI Chat",
    heading: "Ask questions grounded in the actual text",
    body: "Chat threads stay attached to the document context so every answer references the real content, not a hallucinated summary.",
    imageAlt: "The pdfation chat sidebar with threaded conversations.",
    imageSrc: "/onboarding/chat.png",
    imagePosition: "center center",
  },
  {
    badge: "Share",
    heading: "Hand off the full picture, not just the file",
    body: "Share links bundle the PDF with every comment and chat thread so collaborators land in the same working context.",
    imageAlt: "The pdfation share dialog.",
    imageSrc: "/onboarding/share.png",
    imagePosition: "center center",
  },
] as const;

interface OnboardingDialogProps {
  open: boolean;
  onDismiss: () => void;
}

export const OnboardingDialog = ({
  open,
  onDismiss,
}: OnboardingDialogProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const slide = SLIDES[activeIndex];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      onDismiss();
    } else {
      setActiveIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (!isFirst) setActiveIndex((i) => i - 1);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="onboarding-backdrop" />
        <Dialog.Popup className="onboarding-dialog">
          <div className="onboarding__image-region">
            <img
              key={slide.imageSrc}
              alt={slide.imageAlt}
              className="onboarding__image"
              src={slide.imageSrc}
              style={{ objectPosition: slide.imagePosition }}
            />
            <div className="onboarding__image-fade" aria-hidden="true" />

            <div className="onboarding__step-pills">
              {SLIDES.map((s, i) => (
                <button
                  key={s.badge}
                  type="button"
                  className={`onboarding__pill${i === activeIndex ? " onboarding__pill--active" : ""}`}
                  onClick={() => setActiveIndex(i)}
                  aria-label={s.badge}
                >
                  {s.badge}
                </button>
              ))}
            </div>
          </div>

          <div className="onboarding__content">
            <div className="onboarding__text">
              <Dialog.Title className="onboarding__heading">
                {slide.heading}
              </Dialog.Title>
              <p className="onboarding__body">{slide.body}</p>
            </div>

            <div className="onboarding__nav">
              <span className="onboarding__counter">
                {activeIndex + 1}&thinsp;/&thinsp;{SLIDES.length}
              </span>

              <div className="onboarding__nav-buttons">
                <button
                  type="button"
                  className="btn btn-ghost onboarding__nav-btn"
                  onClick={goPrev}
                  disabled={isFirst}
                >
                  <ArrowLeft size={14} weight="bold" />
                </button>

                <button
                  type="button"
                  className="btn btn-primary onboarding__nav-btn onboarding__nav-btn--next"
                  onClick={goNext}
                >
                  {isLast ? "Get started" : "Next"}
                  {!isLast && <ArrowRight size={14} weight="bold" />}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
