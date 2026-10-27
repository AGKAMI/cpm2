import { NextResponse } from "next/server";

// Car-guy photo backdrop for the Fleet Ledger — same engine as the RESURGE
// /api/bg route (Unsplash random search, TOS download ping, in-memory cache)
// but tuned for the light paper/livery theme: heritage + JDM garage queries.

const CACHE = new Map<
  string,
  { url: string; author: string; authorUrl: string; query: string; expires: number }
>();
const TTL = 1000 * 60 * 60; // 1h — photo rotation without hammering the free tier

export const dynamic = "force-dynamic";

// Curated car-guy scene list — rotate deterministically per day so the ledger
// feels alive but never flickers on every reload.
const QUERIES = [
  "classic car garage workshop",
  "jdm car night street",
  "vintage car detail engine",
  "car interior steering wheel leather",
  "motorsport pit lane",
  "car wheel rim closeup",
  "muscle car matte black",
  "rally car dust stage",
];

function pickQuery(): { query: string; index: number } {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const index = day % QUERIES.length;
  return { query: QUERIES[index]!, index };
}

export async function GET() {
  const { query, index } = pickQuery();
  const cacheKey = `${index}`;

  const cached = CACHE.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ ...cached, cached: true }, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "UNSPLASH_ACCESS_KEY not set", cached: false },
      { status: 502 },
    );
  }

  const u = new URL("https://api.unsplash.com/photos/random");
  u.searchParams.set("query", query);
  u.searchParams.set("orientation", "landscape");
  u.searchParams.set("content_filter", "high");
  u.searchParams.set("count", "1");

  try {
    const res = await fetch(u, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    });
    if (!res.ok) throw new Error(`unsplash ${res.status}`);
    const data = await res.json();
    const p = Array.isArray(data) ? data[0] : data;
    if (!p?.urls?.regular) throw new Error("no photo in response");

    // Unsplash TOS: register the download when a photo is used.
    if (p.id) {
      fetch(`https://api.unsplash.com/photos/${p.id}/download`, {
        headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      }).catch(() => {});
    }

    const url = `${p.urls.regular}${p.urls.regular.includes("?") ? "&" : "?"}utm_source=CPM2+Fleet+Ledger&utm_medium=referral`;
    const out = {
      url,
      author: p.user?.name ?? "Unknown",
      authorUrl: p.user?.links?.html ?? "",
      query,
      cached: false,
      expires: Date.now() + TTL,
    };
    CACHE.set(cacheKey, out);
    return NextResponse.json(out, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "background fetch failed",
        detail: err instanceof Error ? err.message : String(err),
        cached: false,
      },
      { status: 502 },
    );
  }
}
