/**
 * VANTA GARAGE — KAMI-Bot local image -> app URL converter.
 *
 * The WhatsApp bot shipped its whole catalogue as LOCAL PNGs (25MB across
 * 40 files) — server bloat, and buffers are read off disk on every send.
 * This walks the bot's assets/, uploads each image into the app's upload
 * store (vanta_uploads, served as public URLs), rewrites catalog.json's
 * image fields to the absolute URLs, and deletes the local files.
 *
 * Usage:  node --experimental-strip-types scripts/convert-bot-images.mts
 * Env:    cpm2/.env.local (SESSION secret + app base URL)
 *
 * Safety: catalog.json is backed up before any write; a local file is only
 * deleted after its upload verified 200 AND the URL is written into the
 * rewritten catalog.
 */

import fs from "fs";
import path from "path";

// ── env (cpm2/.env.local) ──────────────────────────────────────
for (const raw of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  const i = line.indexOf("=");
  if (i < 0 || line.startsWith("#")) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[k] = v.replace(/\r\n|\r|\n/g, "");
}

const { createSessionToken } = await import("../src/lib/auth.ts");

const BOT_ROOT = "C:/Users/ojuni/Downloads/KAMI-Bot-main";
const ASSETS_DIR = path.join(BOT_ROOT, "assets");
const CATALOG_PATH = path.join(BOT_ROOT, "catalog.json");
const APP_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://cpm2-bay.vercel.app").replace(/\/$/, "");
const UPLOAD_ENDPOINT = `${APP_ORIGIN}/api/store/admin/upload-image`;
// Walking comes from catalog.json references, not a dir scan — see main().

// Owner = customer 1 (Telegram 7036681178 = STORE_ADMIN_TELEGRAM_ID).
const OWNER_ID = 1;
const token = createSessionToken(OWNER_ID, "console");

async function uploadImage(absPath: string): Promise<string> {
  const bytes = fs.readFileSync(absPath);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentTypeFor(absPath) }), path.basename(absPath));
  const resp = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: { cookie: `cpm2_session=${token}` },
    body: form,
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`${path.basename(absPath)}: HTTP ${resp.status} ${JSON.stringify(body)?.slice(0, 160)}`);
  }
  const url = (body as { url?: string } | null)?.url;
  if (!url || !url.startsWith("/")) throw new Error(`${path.basename(absPath)}: no url in response`);
  return `${APP_ORIGIN}${url}`;
}

function contentTypeFor(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

// Idempotent re-runs: only upload images that catalog.json STILL references
// locally — a file already converted to an app URL is never re-uploaded.
function stillReferencedLocalImages(): string[] {
  const cat = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const wanted = new Set<string>();
  for (const group of Object.values(cat)) {
    if (!group || typeof group !== "object") continue;
    for (const item of Object.values(group as Record<string, { image?: string }>)) {
      if (item && typeof item === "object" && item.image?.startsWith("assets/")) {
        wanted.add(item.image);
      }
    }
  }
  return [...wanted];
}

async function main() {
  if (!fs.existsSync(CATALOG_PATH)) throw new Error(`catalog.json not found at ${CATALOG_PATH}`);

  const wanted = stillReferencedLocalImages();
  const files: string[] = wanted.filter((rel) => fs.existsSync(path.join(ASSETS_DIR, rel.replace(/^assets\//, ""))));
  console.log(`CONVERT ${files.length} images still local (of ${wanted.length} catalog references; already-converted entries skipped)`);

  // Upload each image -> absolute URL, keyed by its catalog.json-relative path
  const urlMap = new Map<string, string>();
  const failures: string[] = [];
  for (const rel of files) {
    const relPath = rel.replace(/^assets\//, ""); // catalog stores "assets/mods/x.png"
    try {
      const url = await uploadImage(path.join(ASSETS_DIR, relPath));
      urlMap.set(rel, url); // rel is already catalog-relative ("assets/mods/x.png")
      console.log(`  OK  ${rel} -> ${url.slice(-46)}`);
    } catch (err) {
      failures.push(`${rel}: ${(err as Error).message}`);
      console.log(`  ERR ${rel}: ${(err as Error).message}`);
    }
    // The app rate-limits requests — stay under it (429s cost a full retry).
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (urlMap.size === 0) throw new Error("no images uploaded — aborting before touching catalog.json");

  // Rewrite catalog.json (backup first)
  const original = fs.readFileSync(CATALOG_PATH, "utf8");
  const backup = `${CATALOG_PATH}.bak-images`;
  fs.writeFileSync(backup, original);

  const catalog = JSON.parse(original);
  let rewritten = 0;
  for (const cat of Object.keys(catalog)) {
    const items = catalog[cat];
    if (!items || typeof items !== "object") continue;
    for (const [key, item] of Object.entries(items as Record<string, { image?: string }>)) {
      if (!item || typeof item !== "object" || !item.image) continue;
      const mapped = urlMap.get(item.image);
      if (mapped) {
        item.image = mapped;
        rewritten++;
      } else if (item.image.startsWith("http")) {
        // already a URL — leave it
      } else {
        console.log(`  WARN ${cat}/${key}: no upload for ${item.image} (left as-is)`);
      }
    }
  }
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));

  // Read-back verification before deleting anything.
  // A local reference whose FILE STILL EXISTS is a real leftover that blocks
  // deletion (never delete a file the catalog still points at). A local
  // reference with NO file on disk (e.g. catalog entries whose images went
  // missing long before this script existed) has nothing to delete and does
  // not block — those entries render text-only, exactly as they do today.
  const verify = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const localRefs = Object.values(verify)
    .flatMap((cat) => (cat && typeof cat === "object" ? Object.values(cat as Record<string, { image?: string }>) : []))
    .filter((item) => item && typeof item === "object" && item.image && item.image.startsWith("assets/"))
    .map((item) => item.image as string);
  const blocking = localRefs.filter((ref) => fs.existsSync(path.join(ASSETS_DIR, ref.replace(/^assets\//, ""))));
  const missing = localRefs.filter((ref) => !fs.existsSync(path.join(ASSETS_DIR, ref.replace(/^assets\//, ""))));

  // Delete ONLY the files that uploaded AND are now referenced by URL —
  // a failed upload keeps its local file so nothing is ever lost.
  let deleted = 0;
  if (blocking.length === 0) {
    for (const rel of files) {
      if (urlMap.has(rel)) {
        fs.rmSync(path.join(ASSETS_DIR, rel.replace(/^assets\//, "")), { force: true });
        deleted++;
      }
    }
  }

  console.log(`CONVERT rewritten=${rewritten} uploaded=${urlMap.size} failed=${failures.length} deleted=${deleted} blocking=${blocking.length} missingFileRefs=${missing.length}`);
  if (failures.length) console.log(`CONVERT failures: ${failures.join(" | ")}`);
  if (blocking.length) console.log(`CONVERT WARNING: ${blocking.length} entries still local AND on disk — their files kept`);
  if (missing.length) console.log(`CONVERT NOTE: ${missing.length} catalog entries reference images that no longer exist anywhere: ${missing.join(", ")} — they render text-only (unchanged behavior)`);
}

main().catch((err) => {
  console.error(`CONVERT fatal: ${(err as Error).message}`);
  process.exit(1);
});
