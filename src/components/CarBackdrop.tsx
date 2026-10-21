"use client";

import { useEffect, useState } from "react";

type BgPhoto = {
  url: string;
  author: string;
  authorUrl: string;
  query: string;
};

function initiallyHidden(): boolean {
  if (typeof window === "undefined") return true; // SSR: no photo, no flash
  return localStorage.getItem("cpm2:bg-hidden") === "1";
}

/**
 * Full-bleed car photo behind the paper ledger — fetched from our own
 * /api/bg (Unsplash, key stays server-side). The photo sits UNDER a heavy
 * paper scrim so the ledger stays readable; it rotates daily and can be
 * dismissed. Everything degrades to plain paper when the API has no key.
 */
export function CarBackdrop() {
  const [hidden, setHidden] = useState<boolean>(initiallyHidden);
  const [photo, setPhoto] = useState<BgPhoto | null>(null);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    fetch("/api/bg")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.url) {
          setPhoto({ url: data.url, author: data.author, authorUrl: data.authorUrl, query: data.query });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hidden]);

  function dismiss() {
    localStorage.setItem("cpm2:bg-hidden", "1");
    setHidden(true);
  }

  if (!photo || hidden) return null;

  return (
    <div className="car-backdrop" aria-hidden={false}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Unsplash URL, unknown dimensions at build time */}
      <img
        src={photo.url}
        alt=""
        className="car-backdrop-img"
        loading="eager"
        referrerPolicy="no-referrer"
      />
      <div className="car-backdrop-scrim" />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide background photo"
        className="car-backdrop-hide"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <a
        href={photo.authorUrl}
        target="_blank"
        rel="noreferrer"
        className="car-backdrop-credit"
      >
        <svg
          viewBox="0 0 24 24"
          className="mr-1 inline-block h-3 w-3 align-[-2px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5h3l1.6-2.2h8.8L18 8.5h3v9.5H3z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
        {photo.author} · Unsplash
      </a>
    </div>
  );
}
