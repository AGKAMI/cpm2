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
