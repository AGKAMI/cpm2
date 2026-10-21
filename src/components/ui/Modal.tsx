"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-2xl",
}: ModalProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest callback without re-running the focus/keyboard effect.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Keep the keyboard inside the sheet while it is open.
      if (event.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusable = sheet.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Put the caret in the sheet so keyboard users are not left behind it.
    const timer = window.setTimeout(() => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const target =
        sheet.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select") ??
        sheet.querySelector<HTMLElement>("button");
      target?.focus();
    }, 30);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="pointer-events-none fixed inset-0 bg-ink/30 animate-fade" aria-hidden />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`panel animate-pop relative z-10 my-auto flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[18px] border-t-[3px] border-t-racing shadow-[0_24px_50px_-32px_rgba(23,32,27,0.6)] ${width}`}
      >
        <header className="flex items-start gap-4 border-b border-ink/12 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="wordmark text-[19px] leading-tight text-ink">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs text-ink-faint">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="square-btn h-8 w-8"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-ink/12 bg-paper-sunken px-5 py-4 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
