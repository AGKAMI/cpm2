/**
 * VANTA GARAGE — Product media API.
 * GET /api/store/media?productId=X — list media for a product
 * POST /api/store/media?productId=X — upload media for a product (admin only)
 */

import { fail, ok, readJson } from "@/lib/route";
import { createMedia, listMedia } from "@/lib/store/media-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    if (!productId) {
      return fail({ status: 400, body: { error: { code: "missing_product_id", message: "productId required." } } });
    }
    const media = await listMedia(Number(productId));
    return ok({ media });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const productId = Number(body.productId as string);
    const provider = String(body.provider ?? "");
    const providerId = String(body.providerId ?? "");
    const publicUrl = String(body.publicUrl ?? "");
    const originalRef = String(body.originalRef ?? "");
    const fileType = String(body.fileType ?? "image");
    const width = body.width !== undefined ? Number(body.width as number) : null;
    const height = body.height !== undefined ? Number(body.height as number) : null;
    const fileSize = body.fileSize !== undefined ? Number(body.fileSize as number) : null;

    if (!productId || !provider || !providerId || !publicUrl) {
      return fail({ status: 400, body: { error: { code: "missing_fields", message: "Missing required fields." } } });
    }

    const media = await createMedia(
      productId,
      provider,
      providerId,
      publicUrl,
      originalRef,
      fileType,
      width,
      height,
      fileSize,
    );

    return ok({ media });
  } catch (err) {
    return fail(err);
  }
}