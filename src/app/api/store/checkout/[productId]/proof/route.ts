/**
 * VANTA GARAGE — EFT proof upload.
 * POST /api/store/checkout/[productId]/proof
 *
 * Takes the ACTUAL FILE (multipart: orderId + file), stores it durably
 * (vanta_uploads, served by the public /api/store/admin/uploads/[filename]
 * route) and records the resulting URL on the order as eft_proof_url.
 *
 * The old route took a JSON { proofUrl } STRING the client made up and
 * required Telegram initData — web EFT buyers (browser session, no Telegram)
 * could never attach proof, and nothing ever called it: the checkout UI
 * collected a file and dropped it. Admins approved bank transfers with no
 * evidence at all.
 *
 * Auth: the ORDER'S OWNER, proven by either identity path (Telegram initData
 * or the signed web session). The [productId] segment is ignored — a proof
 * belongs to an ORDER, not a product.
 */

import crypto from "node:crypto";
import { fail, ok } from "@/lib/route";
import { canAccessOrder } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { getOrder } from "@/lib/store/checkout";
import { contentTypeForFilename, saveUpload, uploadsMaxBytes } from "@/lib/store/uploads";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXT = /\.(png|jpe?g|webp|gif)$/i;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const orderId = String(form.get("orderId") ?? "");
    const file = form.get("file");

    if (!orderId) {
      return fail({
        status: 400,
        body: { error: { code: "missing_fields", message: "orderId required." } },
      });
    }
    if (!(file instanceof File) || file.size === 0) {
      return fail({
        status: 400,
        body: { error: { code: "missing_file", message: "Attach the proof image (PNG or JPG, max 5MB)." } },
      });
    }
    if (file.size > MAX_BYTES || file.size > uploadsMaxBytes()) {
      return fail({
        status: 400,
        body: {
          error: {
            code: "too_large",
            message: `Proof is ${Math.round(file.size / 1024)}KB — the max is ${Math.round(uploadsMaxBytes() / 1024 / 1024)}MB.`,
          },
        },
      });
    }

    const order = await getOrder(orderId);
    if (!order) {
      return fail({
        status: 404,
        body: { error: { code: "order_not_found", message: "Order not found." } },
      });
    }
    // The checkout capability is an accepted proof of ownership for web
    // guests; a full store session works too. A player id never does.
    if (!canAccessOrder(request, order)) {
      return fail({
        status: 403,
        body: {
          error: {
            code: "forbidden",
            message: "Open this order from your checkout confirmation, or sign in to your store account.",
          },
        },
      });
    }
    if (order.paymentMethod !== "eft") {
      return fail({
        status: 400,
        body: { error: { code: "not_eft", message: "Only EFT orders take a proof upload." } },
      });
    }

    // Extension from the uploaded file's own name, checked against the same
    // allow-list the serving route enforces — never a client-controlled path.
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ext || !ALLOWED_EXT.test(`.${ext}`)) {
      return fail({
        status: 400,
        body: { error: { code: "invalid_file", message: "Proof must be a PNG or JPG image." } },
      });
    }
    const filename = `eft-proof-${crypto.randomUUID()}.${ext}`;
    await saveUpload(filename, Buffer.from(await file.arrayBuffer()));

    // The bytes are durable; the public uploads route serves them.
    const proofUrl = `/api/store/admin/uploads/${filename}`;
    const db = await getStoreDb();
    await db.execute({
      sql: `UPDATE vanta_orders SET eft_proof_url = ?, updated_at = ? WHERE id = ?`,
      args: [proofUrl, new Date().toISOString(), orderId],
    });

    return ok({
      orderId,
      proofUrl,
      contentType: contentTypeForFilename(filename),
      message: "EFT proof uploaded. An admin will verify it against the bank statement.",
    });
  } catch (err) {
    return fail(err);
  }
}
