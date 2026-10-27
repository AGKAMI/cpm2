"use client";

import { useEffect, useState } from "react";

type BgPhoto = {
  url: string;
  author: string;
  authorUrl: string;
  query: string;
};

/**
 * Full-bleed car photo behind the dash — fetched from our own /api/bg
 * (Unsplash, key stays server-side). The photo sits UNDER a heavy
 * midnight scrim so the ledger stays readable and is NOT dismissible —
 * KAMI wants it always on. Degrades to the plain canvas when the API has no key.
 */
export function CarBackdrop() {
  const [photo, setPhoto] = useState<BgPhoto | null>(null);

  useEffect(() => {
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
  }, []);

  if (!photo) return null;

  return (
    <div className="car-backdrop" aria-hidden={false}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Unsplash URL, unknown dimensions at build time */}
      <img
        src={photo.url}
        alt=""
        className="car-backdrop-img"
        loading="eager"
        // The backdrop must never race the ledger for bandwidth on a phone.
        fetchPriority="low"
        decoding="async"
        referrerPolicy="no-referrer"
      />
      <div className="car-backdrop-scrim" />
      <div className="car-backdrop-glow" />
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
          strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M3 8.5h3l1.6-2.2h8.8L18 8.5h3v9.5H3z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
        {photo.author} · Unsplash
      </a>
    </div>
  );
}
