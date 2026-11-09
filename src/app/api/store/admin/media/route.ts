/**
 * VANTA GARAGE — Admin media CRUD.
 * GET    /api/store/admin/media?productId=X   — list media for a product
 * POST   /api/store/admin/media                — upload media
 * DELETE /api/store/admin/media                — delete media (body: { productId, providerId })
 */

import { fail, ok, readJson } from "@/lib/route";
import { createMedia, deleteMedia, listMedia } from "@/lib/store/media-service";

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
    const productId = String(body.productId);
    const provider = String(body.provider);
    const providerId = String(body.providerId);
    const publicUrl = String(body.publicUrl);
    const originalRef = body.originalRef as string;
    const fileType = body.fileType as string;
    const width = body.width as number | undefined;
    const height = body.height as number | undefined;
    const fileSize = body.fileSize as number | undefined;

    if (!productId || !provider || !providerId || !publicUrl) {
      return fail({ status: 400, body: { error: { code: "missing_fields", message: "Missing required fields." } } });
    }

    const media = await createMedia(
      Number(productId),
      provider,
      providerId,
      publicUrl,
      originalRef ?? "",
      fileType ?? "image",
      width ?? null,
      height ?? null,
      fileSize ?? null,
    );

    return ok({ media });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const { productId, providerId } = body;

    if (!productId || !providerId) {
      return fail({ status: 400, body: { error: { code: "missing_fields", message: "productId and providerId required." } } });
    }

    await deleteMedia(Number(productId), providerId);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}