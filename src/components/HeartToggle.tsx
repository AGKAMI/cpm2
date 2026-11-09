"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Heart toggle for wishlist. Pure UI — reads/writes to localStorage
 * so wishlist state persists until Nemotron's wishlist API is wired up.
 */
export function HeartToggle({ productId }: { productId: number }) {
  const key = `vanta_wishlist_${productId}`;
  const [isWishlisted, setIsWishlisted] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    setIsWishlisted(stored === "true");
  }, [key]);

  const toggle = useCallback(() => {
    const next = !isWishlisted;
    setIsWishlisted(next);
    localStorage.setItem(key, String(next));
  }, [isWishlisted, key]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={`relative w-10 h-10 rounded-full border border-border bg-background flex items-center justify-center text-ink-soft hover:border-gold hover:text-gold transition-all duration-200 ${isWishlisted ? "text-gold border-gold" : ""}`}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={isWishlisted}
    >
      <svg
        className={`w-5 h-5 transition-all duration-200 ${isWishlisted ? "scale-110" : "scale-100"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.05.99-3.59 2.5L12 13l-0.91-1.66A7 7 0 0 0 3.59 7.5A5.507 5.507 0 0 0 19 14z" />
        <path d="M22 12c0 4.71-2.8 7.65-5 8.61a1 1 0 0 1-.29-.02A1 1 0 0 1 16 19a1 1 0 0 1-.44 0c-.23 0-.47-.01-.69-.14a12.4 12.4 0 0 1-2.94-1.35c-.51-.57-.98-1.24-1.4-2a1 1 0 0 1 .1-.6c.28-.42.73-.69 1.19-.87a12.4 12.4 0 0 1 2.7-.76c2.04-.24 3.55-1 4.1-2.27A10.4 10.4 0 0 0 22 12z" />
      </svg>
      {isWishlisted && (
        <span className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-gold border-2 border-background text-[8px] font-bold flex items-center justify-center text-ink">
          ✓
        </span>
      )}
    </button>
  );
}
