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
): Promise<Customer> {
  // Session/Telegram customer first — the cart is keyed by CUSTOMER id, so a
  // logged-in web shopper must resolve to the same customer their cart belongs
  // to. Falling through to playerId here would create a fresh customer with an
  // empty cart (the classic "your cart is empty" false negative).
  const linked = await getStoreCustomer(request);
  if (linked) return linked.customer;

  const telegramUserId = await assertTelegramAuth(request);
  if (telegramUserId !== null) {
    const tgLinked = await getCustomerByPlatformIdentity("telegram", String(telegramUserId));
    if (tgLinked) return tgLinked.customer;
    const created = await createCustomer({ inGameName, playerId });
    await linkPlatformIdentity(created.id, "telegram", String(telegramUserId), "");
    return created;
  }
  return (await getCustomerByPlayerId(playerId)) ?? await createCustomer({ inGameName, playerId });
}

export async function POST(request: Request) {
  try {
    const body = cartCheckoutSchema.parse(await readJson(request));
    const customer = await resolveBuyer(request, body.playerId.trim(), body.inGameName.trim());
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

    const playerId = body.playerId.trim();
    const inGameName = body.inGameName.trim();
    const orders = [];

    for (const item of cart.items) {
      const idempotencyKey = `cart_${customer.id}_${item.productId}_${item.quantity}`;
      const result = await createOrder({
        customerId: customer.id,
        productId: item.productId,
        quantity: item.quantity,
        amountCents: item.basePriceCents * item.quantity,
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
      (sum, i) => sum + i.basePriceCents * i.quantity,
      0,
    );

    return ok({
      orders,
      orderIds: orders.map((o) => o.id),
      subtotalCents,
      currency: cart.currency,
      itemCount: cart.items.length,
    }, 201);
  } catch (err) {
    return fail(err);
  }
}
