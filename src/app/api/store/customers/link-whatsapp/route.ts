/**
 * VANTA GARAGE — link WhatsApp to customer.
 * POST /api/store/customers/link-whatsapp — link a WhatsApp identity to the customer.
 * Customer-gated via requireStoreCustomer.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { z } from "zod";

const linkWhatsAppSchema = z.object({
  whatsappNumber: z.string().min(1).max(50),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const db = await getStoreDb();

    const body = linkWhatsAppSchema.parse(await readJson(request));
    const now = new Date().toISOString();

    await db.execute({
      sql: `
        INSERT OR REPLACE INTO vanta_platform_identities (customer_id, platform, platform_user_id, platform_username, linked_at)
        VALUES (?, 'whatsapp', ?, ?, ?)
      `,
      args: [customer.customer.id, body.whatsappNumber, "", now],
    });

    return ok({ linked: true, platform: "whatsapp" });
  } catch (err) {
    return fail(err);
  }
}
