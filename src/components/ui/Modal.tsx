"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  /** When true, modal opens as a popover: starts at scale 0.95, transforms from trigger origin. */
  popover?: boolean;
  /** CSS transform-origin string (e.g. "top left", "120px 20px"). Defaults to center. */
  origin?: string;
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-2xl",
  popover = false,
  origin,
}: ModalProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [opened, setOpened] = useState(open);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Open: mount the sheet → then apply .is-open so the scale-up
  // transition runs from --modal-scale to 1.
  // Close: drop .is-open → apply .is-closing → wait --modal-close-dur → unmount.
  useEffect(() => {
    if (open) {
      // Defer all setState so the mount render commits before we
      // apply .is-open (triggers the scale-up transition).
      const t = setTimeout(() => {
        setClosing(false);
        setMounted(true);
        requestAnimationFrame(() => setOpened(true));
      }, 0);
      return () => clearTimeout(t);
    } else if (!open && mounted) {
      const closeMs =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--modal-close-dur",
          ),
        ) || 150;
      // Defer the close-state flip so the current frame renders with
      // .is-open still active, then transition to .is-closing.
      const t1 = setTimeout(() => {
        setOpened(false);
        setClosing(true);
      }, 0);
      const t2 = setTimeout(() => {
        setClosing(false);
        setMounted(false);
      }, closeMs);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
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
      if (!closing && triggerRef.current?.isConnected) triggerRef.current.focus();
      triggerRef.current = null;
    };
  }, [mounted, closing]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="pointer-events-none fixed inset-0 bg-background animate-fade" aria-hidden />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={({ "--popover-origin": origin ?? "center" } as React.CSSProperties)}
        className={`t-modal relative z-10 my-auto flex max-h-[92vh] w-full flex-col overflow-hidden rounded-md border border-border bg-color-paper-sunken shadow-lg ${width} ${popover ? "t-popover" : ""} ${opened ? "is-open" : ""} ${closing ? "is-closing" : ""}`}
      >
        <header className="flex items-start gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium leading-tight text-foreground">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-muted-foreground hover:border-primary hover:text-primary-foreground transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
