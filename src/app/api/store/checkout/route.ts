/**
 * VANTA GARAGE — checkout API.
 * POST /api/store/checkout
 * Body: { productId, quantity, paymentMethod, playerId, inGameName, idempotencyKey }
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
import { confirmPayment, createOrder, expireReservation } from "@/lib/store/checkout";
import { creditWallet, debitWallet } from "@/lib/store/wallet";
import { getProduct, productPromotionMap } from "@/lib/store/products";
import { buildPayFastCheckoutUrl } from "@/lib/store/payfast";
import { createStarsInvoiceLink, starsForCents } from "@/lib/store/stars";
import { effectiveUnitPriceCents } from "@/lib/store/pricing";
import { siteUrl } from "@/lib/site";
import type { Customer } from "@/lib/store-types";

const checkoutSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).default(1),
  paymentMethod: z.enum(["payfast", "eft", "stars", "wallet"]),
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
  paymentMethod: "eft" | "payfast" | "stars" | "wallet",
): Promise<Customer> {
  // Telegram auth is REQUIRED for Stars (an in-Telegram payment) and for
  // wallet (store credit lives on the linked customer's account, so a
  // player-id guest could never have a balance). EFT / PayFast are web flows
  // identified by Player ID — no Telegram signature needed.
  if (paymentMethod === "stars" || paymentMethod === "wallet") {
    const telegramUserId = await assertTelegramAuth(request);
    if (telegramUserId !== null) {
      const linked = await getCustomerByPlatformIdentity("telegram", String(telegramUserId));
      if (linked) return linked.customer;
      const created = await createCustomer({ inGameName, playerId });
      await linkPlatformIdentity(created.id, "telegram", String(telegramUserId), "");
      return created;
    }
    throw new ApiError(
      401,
      "TELEGRAM_AUTH_INVALID",
      paymentMethod === "wallet"
        ? "Paying with wallet needs your Telegram account — reopen the store from Telegram and try again."
        : "Telegram signature did not verify — reopen the console from Telegram and try again.",
    );
  }
  return (await getCustomerByPlayerId(playerId)) ?? await createCustomer({ inGameName, playerId });
}

export async function POST(request: Request) {
  try {
    const body = checkoutSchema.parse(await readJson(request));
    const normalizedPlayerId = body.playerId.trim().toUpperCase();
    const customer = await resolveBuyer(
      request,
      normalizedPlayerId,
      body.inGameName.trim(),
      body.paymentMethod,
    );

    const product = await getProduct(body.productId);
    if (!product) {
      throw new ApiError(404, "product_not_found", "That vehicle isn't in the catalogue.");
    }
    if (!product.isPublished) {
      throw new ApiError(400, "product_unpublished", "That vehicle isn't available for purchase.");
    }
    // PayFast settles in ZAR, Telegram Stars price from a ZAR-per-star rate,
    // and the wallet holds ZAR cents. Letting a USD/GBP product through one
    // of those gateways would charge its ZAR-denominated amount while
    // labelling the order in the foreign currency. EFT is a manual transfer
    // the reviewer verifies, so it may settle in the buyer's currency.
    if (
      body.paymentMethod !== "eft" &&
      (product.currency || "ZAR").toUpperCase() !== "ZAR"
    ) {
      throw new ApiError(
        400,
        "UNSUPPORTED_GATEWAY_CURRENCY",
        "Card, Stars and wallet payments are available in ZAR only. Choose EFT for this item.",
      );
    }

    // Charge the price the storefront advertised: product sale first, then a
    // live product promotion attached to this product. Display and checkout
    // share effectiveUnitPriceCents so the buyer is never charged more than
    // the price they were shown.
    const promos = await productPromotionMap(product.game);
    const unitCents = effectiveUnitPriceCents(product, promos.get(product.id));
    const amountCents = unitCents * body.quantity;

    const result = await createOrder({
      customerId: customer.id,
      productId: body.productId,
      quantity: body.quantity,
      amountCents,
      // Gateway methods settle in the product's base currency (gated to ZAR
      // above): createOrder only re-prices when the target currency differs,
      // and the wallet/PayFast/Stars amounts must match the debit/charge
      // exactly. EFT may settle in the buyer's currency pref — createOrder
      // resolves a configured per-currency price when one exists.
      currency: body.paymentMethod === "eft" ? customer.currencyPref || product.currency : product.currency,
      paymentMethod: body.paymentMethod,
      playerId: normalizedPlayerId,
      inGameName: body.inGameName.trim(),
      // Namespace the client key with the RESOLVED customer. A raw client key
      // (e.g. "checkout_12_<timestamp>") is guessable/replayable; without the
      // namespace, replaying someone else's key returned their order — plus a
      // signed capability for it — from the idempotency early-exit.
      idempotencyKey: `customer_${customer.id}:${body.idempotencyKey}`,
    });

    let payfastUrl: string | null = null;
    let starsInvoiceUrl: string | null = null;
    const origin = siteUrl();
    if (body.paymentMethod === "payfast") {
      // Use the FINAL order amount — createOrder() may replace the base price
      // with a configured price in the buyer's currency. Charging the old
      // amount here made the webhook's amount check reject every payment.
      const pf = buildPayFastCheckoutUrl(
        result.order,
        `${origin}/store/orders/${result.order.id}`,
        `${origin}/store/orders/${result.order.id}?cancelled=1`,
        `${origin}/api/store/payments/payfast/webhook`,
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
        description: `In-game delivery to ${body.inGameName.trim()} (${normalizedPlayerId})`.slice(0, 255),
        payload: String(result.order.id),
        starAmount: starsForCents(result.order.amountCents),
      });
    }

    // ---- Wallet: pay with in-app credits -----------------------------------
    // Debit first (the conditional UPDATE only succeeds while the balance
    // covers the order), then the shared race-safe confirmPayment flips the
    // order and deducts stock. A failure anywhere down the line refunds the
    // debit, so a customer is never charged for an order they didn't get.
    // The debit uses the FINAL order amount — the same number every other
    // gateway charges.
    let walletPaid = false;
    let walletBalanceAfter: number | null = null;
    if (body.paymentMethod === "wallet") {
      const chargeCents = result.order.amountCents;
      const debit = await debitWallet({
        customerId: result.order.customerId,
        amountCents: chargeCents,
        type: "order_payment",
        reference: String(result.order.id),
        note: `Order ${result.order.id} — ${product.name}`,
      });
      if (!debit.ok) {
        await expireReservation(result.order.id);
        return fail({
          status: 400,
          body: {
            error: {
              code: "insufficient_wallet_balance",
              message: "Your wallet balance is too low for this order. Top up and try again.",
            },
          },
        });
      }
      walletBalanceAfter = debit.balanceCents;
      try {
        await confirmPayment(String(result.order.id));
        walletPaid = true;
      } catch (err) {
        // Pay the customer back — the order did not go through.
        await creditWallet({
          customerId: result.order.customerId,
          amountCents: chargeCents,
          type: "refund",
          reference: `refund-${result.order.id}`,
          note: `Refund — order ${result.order.id} could not be confirmed`,
        });
        await expireReservation(result.order.id);
        throw err;
      }
    }

    // A per-order capability replaces the old customer-wide guest session.
    // It lets a web buyer (new or returning, by player id) read THIS order and
    // attach EFT proof without granting profile/cart/other-order access. A
    // guessable player id can no longer be traded for a store session — which
    // is why no session cookie is minted here: creating an (unpaid) order is
    // not identity proof.
    const orderAccessToken = createOrderAccessToken(result.order.id, result.order.customerId);
    return ok({
      order: result.order,
      reservedUntil: result.reservedUntil,
      payfastUrl,
      starsInvoiceUrl,
      walletPaid,
      walletBalanceCents: walletBalanceAfter,
      canUploadProof: true,
      orderAccessToken,
    }, 201);
  } catch (err) {
    return fail(err);
  }
}
