/**
 * VANTA GARAGE — bulk cart checkout API.
 * POST /api/store/cart/checkout
 * Body: { playerId, inGameName, paymentMethod? }
 *
 * Checks out every cart item in one call: one order per product (the orders
 * schema is per-product), stock reserved per order, then the cart is cleared.
 * EFT is the supported method for a cart (PayFast charges one combined
 * amount per order; a multi-order cart would split it).
 */

import { fail, ok, readJson } from "@/lib/route";
import { createOrderAccessToken } from "@/lib/auth";
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
import { effectiveUnitPriceCents } from "@/lib/store/pricing";
import { getProduct, productPromotionMap } from "@/lib/store/products";
import { getCart, clearCart } from "@/lib/store/cart";
import { getStoreCustomer } from "@/lib/store/auth";
import type { Customer } from "@/lib/store-types";
import { listAdmins } from "@/lib/store/admin-service";
import { sendNotification } from "@/lib/store/notifications";

const cartCheckoutSchema = z.object({
  playerId: z.string().min(1, "Player ID is required"),
  inGameName: z.string().min(1, "In-game name is required"),
  paymentMethod: z.enum(["payfast", "eft", "stars"]).default("eft"),
});

export const dynamic = "force-dynamic";

async function resolveBuyer(
  request: Request,
  playerId: string,
  inGameName: string,
  paymentMethod: "eft" | "payfast" | "stars",
): Promise<Customer> {
  // Session/Telegram customer first — the cart is keyed by CUSTOMER id, so a
  // logged-in web shopper must resolve to the same customer their cart belongs
  // to. Falling through to playerId here would create a fresh customer with an
  // empty cart (the classic "your cart is empty" false negative).
  const linked = await getStoreCustomer(request);
  if (linked) return linked.customer;

  // Telegram auth is only required for Stars payments, which happen inside
  // Telegram and need the user linked. EFT / PayFast are web flows identified
  // by Player ID — no Telegram signature needed.
  let telegramUserId: number | null = null;
  if (paymentMethod === "stars") {
    telegramUserId = await assertTelegramAuth(request);
    if (telegramUserId !== null) {
      const tgLinked = await getCustomerByPlatformIdentity("telegram", String(telegramUserId));
      if (tgLinked) return tgLinked.customer;
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
    const body = cartCheckoutSchema.parse(await readJson(request));
    const normalizedPlayerId = body.playerId.trim().toUpperCase();
    const customer = await resolveBuyer(request, normalizedPlayerId, body.inGameName.trim(), body.paymentMethod);
    const cart = await getCart(customer.id);

    if (cart.items.length === 0) {
      throw new ApiError(400, "CART_EMPTY", "Your cart is empty.");
    }
    if (body.paymentMethod === "payfast" && cart.items.length > 1) {
      throw new ApiError(
        400,
        "PAYFAST_CART_UNSUPPORTED",
        "Cart checkout currently supports EFT only. Check out PayFast items one at a time.",
      );
    }
    // PayFast and Stars settle in ZAR; an order labelled in another currency
    // would be charged at a ZAR rate while its audit trail says otherwise.
    if (body.paymentMethod !== "eft" && cart.items.some((i) => (i.currency || "ZAR").toUpperCase() !== "ZAR")) {
      throw new ApiError(
        400,
        "UNSUPPORTED_GATEWAY_CURRENCY",
        "Card and Stars payments are available in ZAR only. Choose EFT for this cart.",
      );
    }

    const playerId = normalizedPlayerId;
    const inGameName = body.inGameName.trim();
    const orders = [];
    // Promotions are game-scoped; each cart item now carries its product's
    // game, so consult that game's map exactly like the single-product
    // checkout does. (Consulting cpm1 first could apply a CPM1-scoped promo
    // to a CPM2 product the storefront never discounted.)
    const [cpm1Promos, cpm2Promos] = await Promise.all([
      productPromotionMap("cpm1"),
      productPromotionMap("cpm2"),
    ]);
    const promoFor = (item: { productId: number; game: string }) =>
      (item.game === "cpm1" ? cpm1Promos : cpm2Promos).get(item.productId);

    for (const item of cart.items) {
      // Include the cart row's last update so adding the same product again
      // later does not replay an old, already-paid order. A genuine retry of
      // the unchanged cart still resolves to the same order.
      const idempotencyKey = `cart_${customer.id}_${item.productId}_${item.quantity}_${item.updatedAt}`;
      const result = await createOrder({
        customerId: customer.id,
        productId: item.productId,
        quantity: item.quantity,
        // Product sale + any live promotion, exactly like single checkout and
        // the price shown on the card.
        amountCents: effectiveUnitPriceCents(item, promoFor(item)) * item.quantity,
        currency: item.currency,
        paymentMethod: body.paymentMethod,
        playerId,
        inGameName,
        idempotencyKey,
      });
      orders.push(result.order);
    }

    // Orders created (or all already existed via idempotency) — empty the cart.
    await clearCart(customer.id);

    // Notify admins/owners via Telegram about the new order.
    const firstProduct = await getProduct(orders[0].productId);
    const admins = await listAdmins();
    if (admins.length > 0) {
      const line = "═".repeat("NEW ORDER".length);
      const formatPrice = (cents: number, currency = "ZAR") =>
        new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(cents / 100);
      const message =
        `${line}\nNEW ORDER\n${line}\n\n` +
        `🔔 New order submitted\n` +
        `▸ ${firstProduct?.name ?? "Unknown product"}\n` +
        `▸ Order: ${orders[0].id}\n` +
        `▸ ${formatPrice(orders[0].amountCents, orders[0].currency)}\n` +
        `▸ Player: ${inGameName} (${playerId})\n\n` +
        `⚠ Verify payment and arrange delivery.`;
      await Promise.all(
        admins.map((a) =>
          sendNotification(Number(a.telegramUserId), message),
        ),
      ).catch(() => {}); // Don't fail checkout if notification fails
    }

    const subtotalCents = cart.items.reduce(
      (sum, i) => sum + effectiveUnitPriceCents(i, promoFor(i)) * i.quantity,
      0,
    );

    return ok({
      orders,
      orderIds: orders.map((o) => o.id),
      orderAccessTokens: orders.map((o) => ({
        orderId: o.id,
        token: createOrderAccessToken(o.id, o.customerId),
      })),
      subtotalCents,
      currency: cart.currency,
      itemCount: cart.items.length,
    }, 201);
  } catch (err) {
    return fail(err);
  }
}
