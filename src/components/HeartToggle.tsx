"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Heart toggle for wishlist. Pure UI — reads/writes to localStorage
 * so wishlist state persists until Nemotron's wishlist API is wired up.
 *
 * Visual: circular button with a heart icon; on hover it expands into a
 * gradient "Favourite" pill (see .heart-fav in globals.css). Expansion is
 * overlay-only so card layout never shifts.
 */
export function HeartToggle({ productId }: { productId: number }) {
  const key = `vanta_wishlist_${productId}`;
  const [isWishlisted, setIsWishlisted] = useState<boolean>(() => {
    const stored = localStorage.getItem(key);
    return stored === "true";
  });

  const toggle = useCallback(() => {
    const next = !isWishlisted;
    setIsWishlisted(next);
    localStorage.setItem(key, String(next));
  }, [isWishlisted, key]);

  return (
    <span className="heart-fav-wrap">
      <button
        type="button"
        onClick={toggle}
        className={`heart-fav ${isWishlisted ? "is-active" : ""}`}
        aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={isWishlisted}
      >
        <svg
          className="heart-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <span className="heart-title">Favourite</span>
      </button>
    </span>
  );
}
