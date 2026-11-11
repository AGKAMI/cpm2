/**
 * VANTA GARAGE — Serve uploaded admin images.
 * GET /api/store/admin/uploads/[filename] — serve an uploaded image file.
 */

import { fail, ok } from "@/lib/route";
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
