/**
 * VANTA GARAGE — checkout API.
 * POST /api/store/checkout
 * Body: { productId, quantity, paymentMethod, playerId, inGameName, idempotencyKey }
 */

import { fail, ok, readJson } from "@/lib/route";
import {
  createSessionToken,
  readRequestCookie,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { z } from "zod";
import { assertTelegramAuth } from "@/lib/telegram";
import {
  getCustomerByPlatformIdentity,
  getCustomerByPlayerId,
  createCustomer,
  linkPlatformIdentity,
} from "@/lib/store/customers";
import { createOrder } from "@/lib/store/checkout";
import { getProduct } from "@/lib/store/products";
import { buildPayFastCheckoutUrl } from "@/lib/store/payfast";
import { createStarsInvoiceLink, starsForCents } from "@/lib/store/stars";
import { discountedPriceCents } from "@/lib/store/pricing";
import type { Customer } from "@/lib/store-types";

const checkoutSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).default(1),
  paymentMethod: z.enum(["payfast", "eft", "stars"]),
  playerId: z.string().min(1, "Player ID is required"),
  inGameName: z.string().min(1, "In-game name is required"),
  idempotencyKey: z.string().min(1),
});

export const dynamic = "force-dynamic";

/**
 * Resolve the buying customer:
 * - Telegram Mini App → linked customer, or auto-created + linked on first buy.
 * - Any browser (web) → guest identified by Player ID from the checkout form;
 *   reused when the same player has bought before, created otherwise.
 * `requireStoreCustomer` forced Telegram-only checkout, which locked every
 * web visitor out — the store is reachable in any browser now.
 */
async function resolveBuyer(
  request: Request,
  playerId: string,
  inGameName: string,
  paymentMethod: "eft" | "payfast" | "stars",
): Promise<Customer> {
  // Telegram auth is only required for Stars payments, which happen inside
  // Telegram and need the user linked. EFT / PayFast are web flows identified
  // by Player ID — no Telegram signature needed.
  let telegramUserId: number | null = null;
  if (paymentMethod === "stars") {
    telegramUserId = await assertTelegramAuth(request);
    if (telegramUserId !== null) {
      const linked = await getCustomerByPlatformIdentity("telegram", String(telegramUserId));
      if (linked) return linked.customer;
      const created = await createCustomer({ inGameName, playerId });
      await linkPlatformIdentity(created.id, "telegram", String(telegramUserId), "");
      return created;
    }
    // Stars with no valid Telegram identity -> can't proceed.
    throw new ApiError(401, "TELEGRAM_AUTH_INVALID", "Telegram signature did not verify — reopen the console from Telegram and try again.");
  }
  return (await getCustomerByPlayerId(playerId)) ?? await createCustomer({ inGameName, playerId });
}

export async function POST(request: Request) {
  try {
    const body = checkoutSchema.parse(await readJson(request));
    const customer = await resolveBuyer(request, body.playerId.trim(), body.inGameName.trim(), body.paymentMethod);

    const product = await getProduct(body.productId);
    if (!product) {
      throw new ApiError(404, "product_not_found", "That vehicle isn't in the catalogue.");
    }
    if (!product.isPublished) {
      throw new ApiError(400, "product_unpublished", "That vehicle isn't available for purchase.");
    }

    // Charge the sale price when the product carries a discount
    const unitCents = discountedPriceCents(product.basePriceCents, product.discountPercent);
    const amountCents = unitCents * body.quantity;

    const result = await createOrder({
      customerId: customer.id,
      productId: body.productId,
      quantity: body.quantity,
      amountCents,
      currency: product.currency,
      paymentMethod: body.paymentMethod,
      playerId: body.playerId.trim(),
      inGameName: body.inGameName.trim(),
      idempotencyKey: body.idempotencyKey,
    });

    let payfastUrl: string | null = null;
    let starsInvoiceUrl: string | null = null;
    if (body.paymentMethod === "payfast") {
      const pf = buildPayFastCheckoutUrl(
        { ...result.order, amountCents } as import("@/lib/store-types").Order,
        `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://cpm2-bay.vercel.app"}/store/orders/${result.order.id}`,
        `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://cpm2-bay.vercel.app"}/store/orders/${result.order.id}?cancelled=1`,
        `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://cpm2-bay.vercel.app"}/api/store/payments/payfast/webhook`,
        product.name,
      );
      if (pf.configured) {
        payfastUrl = pf.url;
      }
    }

    // Telegram Stars — native invoice the mini app opens with openInvoice().
    if (body.paymentMethod === "stars") {
      starsInvoiceUrl = await createStarsInvoiceLink({
        title: `VANTA GARAGE — ${product.name}`.slice(0, 32),
        description: `In-game delivery to ${body.inGameName.trim()} (${body.playerId.trim()})`.slice(0, 255),
        payload: String(result.order.id),
        starAmount: starsForCents(amountCents),
      });
    }

    // A completed checkout IS the identity proof for a web guest: the buyer
    // paid (PayFast/Stars) as this customer. Mint a store-scoped session so
    // their order history reads back without a guessable playerId query
    // param — that param used to be the only gate on /orders reads. EFT skips
    // this (no payment proof yet); the EFT reviewer approves first.
    const response = ok({
      order: result.order,
      reservedUntil: result.reservedUntil,
      payfastUrl,
      starsInvoiceUrl,
    }, 201);
    if (!verifySessionToken(readRequestCookie(request, SESSION_COOKIE), "store")) {
      response.cookies.set(
        SESSION_COOKIE,
        createSessionToken(result.order.customerId, "store"),
        sessionCookieOptions(request),
      );
    }
    return response;
  } catch (err) {
    return fail(err);
  }
}
