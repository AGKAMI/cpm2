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
      .catch(() => {
        // Background photo is cosmetic — silently degrade to plain canvas.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!photo) {
    return (
      <div className="car-backdrop">
        <div className="car-backdrop-scrim" />
        <div className="car-backdrop-glow" />
      </div>
    );
  }

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
    </div>
  );
}
