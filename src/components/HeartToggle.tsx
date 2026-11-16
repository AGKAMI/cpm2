"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadServerWishlist,
  subscribeWishlist,
  toggleWishlist,
} from "@/lib/store/wishlist-client";

/**
 * Heart toggle for wishlist.
 *
 * State source: the shared wishlist client — one server fetch per page
 * (`/api/store/wishlist`, customer-linked via Telegram), mirrored into
 * localStorage so hearts are right for guests too and render instantly.
 *
 * Hydration rule: never read localStorage during render — start from a
 * server-safe default and mirror stored state after mount.
 *
 * Cards render this button inside their <Link>. The click handler must
 * preventDefault() as well as stopPropagation(): stopPropagation alone
 * blocks React's Link onClick, but the browser still performs the
 * anchor's DEFAULT navigation, so the card would open instead of the
 * wishlist toggling.
 */
export function HeartToggle({ productId }: { productId: number }) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let alive = true;
    // Pull the page's shared server wishlist once, then subscribe to
    // cross-card toggles so every heart for the same product stays in sync.
    void loadServerWishlist().then((ids) => {
      if (alive) setIsWishlisted(ids.has(productId));
    });
    const unsubscribe = subscribeWishlist((changed) => {
      if (changed.has(productId)) {
        setIsWishlisted(localStorage.getItem(`vanta_wishlist_${productId}`) === "true");
      }
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [productId]);

  const onToggle = useCallback(
    (e: React.MouseEvent) => {
      // We sit inside the card's <Link> — swallow the event entirely so the
      // card never navigates. preventDefault is the one that stops the
      // browser's anchor default action; stopPropagation keeps it away
      // from React's Link handler too.
      e.preventDefault();
      e.stopPropagation();
      setIsWishlisted((prev) => {
        toggleWishlist(productId, !prev);
        return !prev;
      });
    },
    [productId],
  );

  return (
    <span className="heart-fav-wrap">
      <button
        type="button"
        onClick={onToggle}
        className={`heart-fav ${mounted && isWishlisted ? "is-active" : ""}`}
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
        <span className="heart-title">Add to wishlist</span>
      </button>
    </span>
  );
}
