/** FLEET LEDGER — Single account image.
 * GET    /api/accounts/[id]/images/[imageId]?serve=1 — serve image binary
 * GET    /api/accounts/[id]/images/[imageId] — image metadata
 * PATCH  /api/accounts/[id]/images/[imageId] — set cover (body: { isCover: boolean })
 * DELETE /api/accounts/[id]/images/[imageId] — delete image
 */

import { fail, ok } from "@/lib/route";
import { currentUserId } from "@/lib/auth";
import { parseId } from "@/lib/http";
import { readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import {
  listAccountImages,
  removeAccountImage,
  setAccountCoverImage,
} from "@/lib/service-turso";

type RouteContext = {
  params: Promise<{ id: string; imageId: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id, imageId } = await context.params;
    const accountId = parseId(id);
    const imgId = parseId(imageId);
    const url = new URL(request.url);
    const serve = url.searchParams.get("serve") === "1";

    const images = await listAccountImages(accountId);
    const image = images.find((img) => img.id === imgId);

    if (!image) {
      return fail({
        status: 404,
        body: { error: { code: "not_found", message: "Image not found on this account." } },
      });
    }

    if (serve) {
      // Serve the actual image binary from public/uploads/fleet/
      const filename = image.imageUrl.split("/").pop();
      if (!filename) {
        return fail({
          status: 404,
          body: { error: { code: "not_found", message: "Image file not available." } },
        });
      }

      const filepath = join(process.cwd(), "public", "uploads", "fleet", filename);
      if (!existsSync(filepath)) {
        return fail({
          status: 404,
          body: { error: { code: "not_found", message: "Image file missing from disk." } },
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
    }

    return ok({ image });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const userId = currentUserId(request);
    const { id, imageId } = await context.params;
    const accountId = parseId(id);
    const imgId = parseId(imageId);

    const body = await request.json();
    const { isCover } = body as { isCover?: boolean };

    if (isCover === undefined) {
      return fail({
        status: 400,
        body: { error: { code: "missing_field", message: "isCover field is required." } },
      });
    }

    if (isCover) {
      await setAccountCoverImage(accountId, imgId, userId);
    }

    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  try {
    const userId = currentUserId(request);
    const { id, imageId } = await context.params;
    const accountId = parseId(id);
    const imgId = parseId(imageId);

    await removeAccountImage(accountId, imgId, userId);
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
