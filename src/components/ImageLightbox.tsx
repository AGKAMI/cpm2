"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type LightboxImage = {
  src: string;
  alt?: string;
  badge?: string;
};

/**
 * The one in-app image viewer for the whole app. Tapping an image must never
 * kick the user out to a browser tab: this opens over the current page with
 * swipe (touch), arrow buttons and keyboard navigation between images.
 */
export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: LightboxImage[];
  /** Open image index, or null when closed. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const open = index !== null && images.length > 0;
  const current = open ? Math.min(Math.max(index, 0), images.length - 1) : 0;

  const goTo = useCallback(
    (next: number) => {
      if (images.length === 0) return;
      onIndexChange(((next % images.length) + images.length) % images.length);
    },
    [images.length, onIndexChange],
  );

  const prev = useCallback(() => goTo(current - 1), [goTo, current]);
  const next = useCallback(() => goTo(current + 1), [goTo, current]);

  // Keyboard: Esc closes, arrows move. Body scroll locked while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, prev, next]);

  // Preload neighbours so swiping feels instant.
  useEffect(() => {
    if (!open || images.length < 2) return;
    for (const neighbour of [current - 1, current + 1]) {
      const img = new window.Image();
      img.src = images[((neighbour % images.length) + images.length) % images.length].src;
    }
  }, [open, current, images]);

  if (!mounted || !open) return null;

  const image = images[current];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.alt ?? "Image viewer"}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar — counter + close */}
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 text-white">
        <span className="num text-[11px] uppercase tracking-[0.2em] text-white/70">
          {current + 1} / {images.length}
          {image.badge ? <span className="ml-3 text-white">{image.badge}</span> : null}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 text-xl text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          ×
        </button>
      </div>

      {/* Stage — swipe here; tapping the image itself does nothing (no new tab, no close). */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6 sm:px-20"
        style={{ touchAction: "pan-y" }}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
          touchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const startX = touchStartX.current;
          const startY = touchStartY.current;
          touchStartX.current = null;
          touchStartY.current = null;
          if (startX === null || startY === null) return;
          const touch = event.changedTouches[0];
          if (!touch) return;
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          // Horizontal swipe only — vertical movement is scroll intent.
          if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
          if (dx < 0) next();
          else prev();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={image.src}
          src={image.src}
          alt={image.alt ?? ""}
          draggable={false}
          className="max-h-full max-w-full select-none rounded-xl object-contain"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/50 text-2xl text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/50 text-2xl text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {images.map((img, i) => (
            <button
              key={`${img.src}-${i}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goTo(i);
              }}
              aria-label={`Go to image ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === current ? "w-5 bg-white" : "w-2 bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
