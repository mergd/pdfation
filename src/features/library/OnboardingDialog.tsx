import { useState } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import { ArrowLeft, ArrowRight, Sparkle, X } from '@phosphor-icons/react'

import './onboarding-dialog.css'

const ONBOARDING_SLIDES = [
  {
    badge: 'Workspace',
    title: 'Read, highlight, and turn passages into conversations',
    description:
      'Open a document to browse the pages, highlight text inline, and build context-rich chats without losing your place in the PDF.',
    imageAlt: 'The pdfation workspace with the document viewer open.',
    imageSrc: '/onboarding/workspace.png',
    imagePosition: 'center center',
  },
  {
    badge: 'Library',
    title: 'Keep every PDF in one calm, visual place',
    description:
      'Your library is the home base. Upload your own files, keep the demo around for reference, and jump back into any document in a click.',
    imageAlt: 'The pdfation library showing a PDF card and upload action.',
    imageSrc: '/onboarding/library.png',
    imagePosition: 'center top',
  },
  {
    badge: 'Flow',
    title: 'Keep annotations, chats, and sharing in sync',
    description:
      'Highlights stay anchored to the document, chats stay organized in the sidebar, and share snapshots make it easy to hand work off.',
    imageAlt: 'The pdfation workspace showing the live chat and thread history.',
    imageSrc: '/onboarding/chat.png',
    imagePosition: 'center center',
  },
  {
    badge: 'Share',
    title: 'Send a complete snapshot, not just the file',
    description:
      'Share links bundle the PDF together with comments and chat history, so someone else can import the same working context into their own browser.',
    imageAlt: 'The pdfation share dialog showing snapshot sharing options.',
    imageSrc: '/onboarding/share.png',
    imagePosition: 'center center',
  },
] as const

interface OnboardingDialogProps {
  open: boolean
  onDismiss: () => void
}

export const OnboardingDialog = ({ open, onDismiss }: OnboardingDialogProps) => {
  const [activeIndex, setActiveIndex] = useState(0)

  const slide = ONBOARDING_SLIDES[activeIndex]
  const isFirstSlide = activeIndex === 0
  const isLastSlide = activeIndex === ONBOARDING_SLIDES.length - 1

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onDismiss()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="onboarding-backdrop" />
        <Dialog.Popup className="onboarding-dialog">
          <header className="onboarding-dialog__header">
            <div className="onboarding-dialog__eyebrow">
              <Sparkle size={13} weight="fill" />
              <span>Welcome to pdfation</span>
            </div>
            <Dialog.Close className="onboarding-dialog__close" aria-label="Dismiss onboarding">
              <X size={14} weight="bold" />
            </Dialog.Close>
          </header>

          <div className="onboarding-dialog__body">
            <div className="onboarding-dialog__media">
              <img
                key={slide.imageSrc + slide.imagePosition}
                alt={slide.imageAlt}
                className="onboarding-dialog__image"
                src={slide.imageSrc}
                style={{ objectPosition: slide.imagePosition }}
              />
              <div className="onboarding-dialog__media-glow" aria-hidden="true" />
            </div>

            <div className="onboarding-dialog__copy">
              <span className="badge badge-accent">{slide.badge}</span>
              <Dialog.Title className="onboarding-dialog__title">
                What is pdfation?
              </Dialog.Title>
              <p className="onboarding-dialog__lede">
                pdfation is a lightweight PDF workspace for reading, annotating, and chatting with
                documents in one place.
              </p>
              <h2 className="onboarding-dialog__slide-title">{slide.title}</h2>
              <p className="onboarding-dialog__slide-description">{slide.description}</p>

              <div className="onboarding-dialog__footer">
                <div className="onboarding-dialog__pagination">
                  <span className="onboarding-dialog__count">
                    {activeIndex + 1} / {ONBOARDING_SLIDES.length}
                  </span>
                  <div className="onboarding-dialog__dots" aria-label="Onboarding slides">
                    {ONBOARDING_SLIDES.map((item, index) => (
                      <button
                        key={item.title}
                        type="button"
                        className={`onboarding-dialog__dot${index === activeIndex ? ' onboarding-dialog__dot--active' : ''}`}
                        aria-label={`Go to ${item.badge} slide`}
                        aria-pressed={index === activeIndex}
                        onClick={() => setActiveIndex(index)}
                      />
                    ))}
                  </div>
                </div>

                <div className="onboarding-dialog__actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      if (!isFirstSlide) {
                        setActiveIndex((current) => current - 1)
                      }
                    }}
                    disabled={isFirstSlide}
                  >
                    <ArrowLeft size={14} weight="bold" />
                    Previous
                  </button>

                  {!isLastSlide ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setActiveIndex((current) => current + 1)}
                    >
                      Next
                      <ArrowRight size={14} weight="bold" />
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={onDismiss}>
                      Start exploring
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
