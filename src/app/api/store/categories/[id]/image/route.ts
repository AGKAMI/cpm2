/**
 * VANTA GARAGE — category artwork.
 * GET /api/store/categories/[id]/image
 *
 * Category art is stored inline in the DB as a base64 data URL. Serving it
 * here keeps ~800 KB of base64 out of every page that lists categories while
 * still rendering the artwork (browser caches the response).
 */

import { getStoreDb } from "@/lib/store-db";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const DATA_URL = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/;

// Only these widths are honoured, so a hostile caller cannot ask the
// optimizer for arbitrary sizes.
const WIDTHS = new Set([120, 240, 400, 640, 800, 1600]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const db = await getStoreDb();
  const result = await db.execute({
    sql: "SELECT image_url FROM vanta_categories WHERE id = ?",
    args: [categoryId],
  });
  const raw = result.rows[0]?.image_url;
  const value = typeof raw === "string" ? raw : "";

  if (!value) return new Response("Not found", { status: 404 });

  const match = value.match(DATA_URL);
  if (match) {
    const mime = match[1] || "image/jpeg";
    const bytes = Buffer.from(match[3], match[2] ? "base64" : "utf8");
    const requested = Number(new URL(request.url).searchParams.get("w") ?? 0);
    if (WIDTHS.has(requested)) {
      try {
        const resized = await sharp(bytes)
          .resize({ width: requested, withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer();
        return new Response(new Uint8Array(resized), {
          headers: {
            "Content-Type": "image/webp",
            "Content-Length": String(resized.byteLength),
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch {
        // Fall through to the original bytes if sharp cannot decode it.
      }
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Already a plain path/URL — redirect rather than loop back into this route.
  if (value.startsWith("/api/store/categories/")) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(null, { status: 307, headers: { Location: value } });
}
