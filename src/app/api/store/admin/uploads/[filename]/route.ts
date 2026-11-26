/**
 * VANTA GARAGE — Serve uploaded admin images.
 * GET /api/store/admin/uploads/[filename] — serve an uploaded image file.
 */

import { fail } from "@/lib/route";
import { getUpload } from "@/lib/store/uploads";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;


    // Strict allow-list. `filename` comes straight off the URL and was fed to
    // path.join(), which does NOT neutralise traversal — proven live before this
    // guard: GET /api/store/admin/uploads/..%2F..%2Fpackage.json returned 200
    // with the app's package.json contents.
    // Every filename written by saveUpload() is a uuid + a known image
    // extension, so anything else is refused here.
    if (
      !filename ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("..") ||
      // An optional descriptive prefix before the uuid (e.g. the EFT proof
            // uploads name themselves eft-proof-<uuid>.jpg). The traversal guards
            // above (no /, no \, no ..) still hold; this only widens the name shape
            // saveUpload can produce.
            !/^(?:[a-z0-9][a-z0-9-]*-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|gif|webp)$/i.test(
              filename,
            )
    ) {
      return fail({
        status: 400,
        body: { error: { code: "invalid_filename", message: "Image not found." } },
      });
    }

    // DB-backed copy first — serverless deploys have a read-only FS and never
    // wrote the file to disk in the first place.
    const stored = await getUpload(filename);
    if (stored) {
      return new Response(new Uint8Array(stored.buffer), {
        status: 200,
        headers: {
          "Content-Type": stored.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Fallback: files committed to git (public/uploads) and local dev writes.
    const filepath = join(
      process.cwd(),
      "public",
      "uploads",
      filename,
    );

    if (!existsSync(filepath)) {
      return fail({
        status: 404,
        body: { error: { code: "not_found", message: "Image not found." } },
      });
    }

    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const contentType =
      ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "gif"
            ? "image/gif"
            : ext === "webp"
              ? "image/webp"
              : "application/octet-stream";

    const file = await readFile(filepath);

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
