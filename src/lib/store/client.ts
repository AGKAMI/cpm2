/**
 * VANTA GARAGE — client-side store API caller.
 * Mirrors the existing @/lib/client pattern for store endpoints.
 */

const STORE_BASE = "/api/store";

// Simple in-memory fetch cache — dedupes concurrent identical requests
// and serves stale data with a short TTL so page-to-page nav is instant.
const cache = new Map<string, { data: unknown; expiry: number }>();
const inflight = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 30_000; // 30 seconds

function getCacheKey(path: string): string {
  return path;
}

/**
 * Paths whose response depends on WHO is calling (session cookie, Telegram
 * identity, playerId). These must never be served from the browser cache: on
 * a shared machine the next user would see the previous user's profile,
 * orders or cart for up to the 30s TTL. The public catalogue paths below are
 * identity-independent and safe to cache.
 */
const PRIVATE_PATH_PREFIXES = [
  "/profile",
  "/orders",
  "/cart",
  "/customers",
  "/checkout",
  "/account",
  "/admin",
  "/appointments",
  "/trade",
];

function isCacheablePath(path: string): boolean {
  return !PRIVATE_PATH_PREFIXES.some((p) => path.startsWith(p));
}

import { clientInitData } from "../client-initdata";

// In a desktop browser the official SDK empties window.Telegram.WebApp.initData,
// so read the initData captured from the URL hash first (see client-initdata.ts).
export function telegramInitData(): string {
  return clientInitData();
}

/**
 * Web guests identify themselves by the player id captured at checkout
 * (Telegram identities are linked server-side and don't need this).
 */
function guestPlayerId(): string | null {
  if (typeof window === "undefined" || telegramInitData()) return null;
  const pid = window.localStorage.getItem("vanta_player_id");
  return pid && pid.trim() ? pid.trim() : null;
}

const TELEGRAM_INIT_DATA_HEADER = "X-Telegram-Init-Data";

export async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const cacheKey = getCacheKey(path);
  const cacheable = isCacheablePath(path);

  // Return cached data if still fresh (only for GET requests without body,
  // and only for identity-independent paths)
  if ((!init?.method || init.method === "GET") && cacheable) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }
    // Deduplicate concurrent identical requests
    const existing = inflight.get(cacheKey);
    if (existing) {
      return existing as T;
    }
  }

  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const initData = telegramInitData();
  if (initData) headers.set(TELEGRAM_INIT_DATA_HEADER, initData);

  let response: Response;
  try {
    response = await fetch(`${STORE_BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error("Cannot reach the store. Check your connection.");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const body = payload as { error?: { code?: string; message?: string } } | null;
    throw new Error(body?.error?.message ?? `Request failed with status ${response.status}.`);
  }

  const result = payload as T;

  // Cache invalidation: mutations clear the relevant cache so the next GET returns fresh data
  if (init?.method && init.method !== "GET") {
    if (path.startsWith("/products") || path.startsWith("/admin/products")) {
      cache.delete(getCacheKey("/products"));
    }
    if (path.startsWith("/categories") || path.startsWith("/admin/categories")) {
      cache.delete(getCacheKey("/categories"));
    }
  }

  // Cache GET responses — public paths only (see PRIVATE_PATH_PREFIXES)
  if ((!init?.method || init.method === "GET") && cacheable) {
    const promise = Promise.resolve(result);
    inflight.set(cacheKey, promise);
    setTimeout(() => inflight.delete(cacheKey), 5000);
    cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS });
  }

  return result;
}

export const vantaApi = {
  products: (params?: { q?: string; featured?: boolean }) => {
    let url = "/products";
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.featured) qs.set("featured", "1");
    if (qs.toString()) url += `?${qs.toString()}`;
    return request<{ products: VantaProduct[]; total: number }>(url);
  },
  categories: () => request<{ categories: VantaCategory[] }>("/categories"),
  wallet: () =>
    request<{
      wallet: { balanceCents: number; currency: string };
      transactions: {
        id: string;
        customerId: string;
        type: string;
        amountCents: number;
        balanceAfterCents: number;
        status: string;
        reference: string | null;
        note: string | null;
        createdAt: string;
      }[];
    }>("/wallet"),
  topUpWallet: (body: { amountCents: number }) =>
    request<{ redirectUrl: string; txnId: string }>("/wallet/topup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createCategory: (body: { name: string; slug: string; description?: string; sortOrder?: number; imageUrl?: string; game?: "cpm1" | "cpm2" }) =>
    request<{ category: VantaCategory }>("/admin/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCategory: (id: number, body: { name?: string; slug?: string; description?: string; sortOrder?: number; imageUrl?: string; game?: "cpm1" | "cpm2" }) =>
    request<{ category: VantaCategory }>(`/admin/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteCategory: (id: number) =>
    request<{ deleted: boolean }>(`/admin/categories/${id}`, {
      method: "DELETE",
    }),
  promotions: () => request<{ promotions: VantaPromotion[] }>("/promotions"),
  createPromotion: (body: unknown) =>
    request<{ promotion: VantaPromotion }>("/admin/promotions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePromotion: (id: number, body: unknown) =>
    request<{ promotion: VantaPromotion }>(`/admin/promotions?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deletePromotion: (id: number) =>
    request<{ deleted: boolean }>(`/admin/promotions?id=${id}`, {
      method: "DELETE",
    }),
  createProduct: (body: unknown) =>
    request<{ product: VantaProduct }>("/admin/products", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProduct: (id: number, body: unknown) =>
    request<{ product: VantaProduct }>(`/admin/products?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  updateProductPublish: (id: number, publish: boolean) =>
      request<{ product: VantaProduct }>(`/admin/products?id=${id}`, {
        method: "PUT",
        body: JSON.stringify({ isPublished: publish }),
      }),
    deleteProduct: (id: number) =>
      request<{ deleted: boolean }>(`/admin/products?id=${id}`, {
        method: "DELETE",
      }),
  orders: () => {
    let url = "/orders";
    const pid = guestPlayerId();
    if (pid) url += `?playerId=${encodeURIComponent(pid)}`;
    return request<{ orders: VantaOrder[] }>(url);
  },
  order: (id: string) => {
    let url = `/orders?id=${encodeURIComponent(id)}`;
    const pid = guestPlayerId();
    if (pid) url += `&playerId=${encodeURIComponent(pid)}`;
    return request<{ order: VantaOrder }>(url);
  },
  checkout: (body: unknown) =>
    request<{
      order: VantaOrder;
      reservedUntil: string;
      payfastUrl: string | null;
      starsInvoiceUrl: string | null;
      walletPaid?: boolean;
      walletBalanceCents?: number | null;
    }>("/checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  // Cart (customer-gated via Telegram)
  cart: () => request<CartSummary>("/cart"),
  cartAdd: (productId: number, quantity?: number) =>
    request<{ cart: CartSummary; added: boolean }>("/cart", {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    }),
  cartUpdate: (productId: number, quantity: number) =>
    request<{ cart: CartSummary; updated: boolean }>("/cart", {
      method: "PATCH",
      body: JSON.stringify({ productId, quantity }),
    }),
  cartRemove: (productId: number) =>
    request<{ cart: CartSummary; removed: boolean }>(`/cart?productId=${productId}`, {
      method: "DELETE",
    }),
  cartCheckout: (body: { playerId: string; inGameName: string; paymentMethod?: "payfast" | "eft" | "stars" }) =>
    request<{ orders: VantaOrder[]; orderIds: string[]; subtotalCents: number; currency: string; itemCount: number }>("/cart/checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  media: (productId: number) =>
    request<{ media: VantaProductMedia[] }>(`/media?productId=${productId}`),
  mediaCovers: (ids: number[]) =>
    request<{ covers: Record<string, string> }>(`/media/covers?ids=${ids.join(",")}`),

  // Customer profile
  profile: () => request<{ customer: VantaCustomer | null; telegramUser: TelegramUser | null }>("/profile"),
  notifications: (customerId: number) =>
    request<{ enabled: boolean }>(`/customers/${encodeURIComponent(customerId)}/notifications`),
  updateNotifications: (customerId: number, enabled: boolean) =>
    request<{ enabled: boolean }>(`/customers/${encodeURIComponent(customerId)}/notifications`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),

  // Admin order management
    adminOrders: () => request<{ orders: VantaOrder[] }>("/admin/orders"),
    adminAdmins: () => request<{ admins: VantaAdminRecord[] }>("/admin/admins"),
    createAdmin: (body: { telegramUserId: string; telegramUsername: string; nickname: string }) =>
      request<{ admin: VantaAdminRecord }>("/admin/admins", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    deleteAdmin: (telegramUserId: string) =>
      request<{ deleted: boolean }>(`/admin/admins/${encodeURIComponent(telegramUserId)}`, {
        method: "DELETE",
      }),
    notifyAdminPromoted: (body: { telegramUserId: string; promotedBy: string }) =>
      request<{ success: boolean }>("/admin/notify-admin-promoted", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    adminHeartbeat: () => request<{ ok: boolean }>("/admin/heartbeat", {
      method: "POST",
    }),
    adminDashboardStats: () =>
    request<DashboardStats>("/admin/dashboard/stats"),
  adminDashboardAlerts: () =>
    request<{ alerts: DashboardAlert[] }>("/admin/dashboard/alerts"),

  ownerStats: () => request<OwnerStats>("/owner/stats"),

  verifyPayment: (orderId: string) =>
    request<{ orderId: string; paymentState: string; orderState: string }>(
      `/admin/orders/${encodeURIComponent(orderId)}/verify-payment`,
      { method: "POST", body: JSON.stringify({ orderId }) },
    ),
  rejectPayment: (orderId: string, reason?: string) =>
    request<{ orderId: string; paymentState: string; orderState: string; reason: string | null }>(
      `/admin/orders/${encodeURIComponent(orderId)}/reject-payment`,
      { method: "POST", body: JSON.stringify({ orderId, reason }) },
    ),
  setDeliveryEvidence: (orderId: string, evidenceUrl: string) =>
    request<{ orderId: string; deliveryEvidence: string; orderState: string }>(
      `/admin/orders/${encodeURIComponent(orderId)}/delivery-evidence`,
      { method: "POST", body: JSON.stringify({ orderId, evidenceUrl }) },
    ),
};

export type VantaProduct = {
  id: number;
  categoryId: number | null;
  cpm2CarCode: number | null;
  /** Absolute cover URL (resolved from product media). */
  coverUrl?: string | null;
  /** Catalogue the product belongs to. */
  game?: "cpm1" | "cpm2";
  /** What kind of thing is being sold — a car or a game account. */
  kind?: "car" | "account" | "service";
  /** Stars price, quoted with the configured STARS_ZAR_PER_STAR by the API. */
  starsPrice?: number;
  /** The live product promotion, when one is attached to this product. */
  promo?: {
    id: number;
    discountPercent: number;
    backgroundColor: string;
    accentColor: string;
    pillColor: string;
    title: string;
  } | null;
  /** The promotional price (after the promo's discount), when it applies. */
  promoPriceCents?: number | null;
  name: string;
  description: string;
  basePriceCents: number;
  discountPercent: number;             // 0-90; sale price = base * (100 - discount) / 100
  currency: string;
  stockQuantity: number;
  availabilityState: string;
  exclusivity: string;
  isFeatured: boolean;
  isNew: boolean;
  isSale: boolean;
  isPublished: boolean;
  imageUrl: string | null;
  version: number;
  airSuspension: boolean;       // Air suspension installation included
  unlockedBodykits: boolean;    // Design unlocks bodykits
  specHp: number | null;        // legacy — perf specs kept for old rows only
  specTopSpeed: number | null;
  specZeroHundred: string | null;
  specDrive: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VantaProductMedia = {
  id: number;
  productId: number;
  publicUrl: string;
  sortOrder: number;
};

export type VantaCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  /** Which catalogue this shelf belongs to — CPM1 (flags/mods/...) or CPM2 (cars). */
  game?: "cpm1" | "cpm2";
  createdAt: string;
};

export type VantaPromotion = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  discountPercent: number;
  discountCode: string;
  ctaText: string;
  ctaLink: string;
  backgroundColor: string;
  accentColor: string;
  imageUrl: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type VantaAdminRecord = {
  id: number;
  telegramUserId: string;
  telegramUsername: string;
  nickname: string;
  role: "owner" | "admin";
  addedBy: string | null;
  addedAt: string;
  isActive: boolean;
  lastSeen: string | null;
};

export type VantaOrder = {
  id: string;
  customerId: number;
  productId: number;
  quantity: number;
  orderState: string;
  paymentState: string;
  deliveryState: string;
  amountCents: number;
  currency: string;
  exchangeRate: number | null;
  reservedUntil: string | null;
  paymentMethod: string;
  playerId: string;
  inGameName: string;
  appointmentId: string | null;
  /** Uploaded EFT proof of payment (durable uploads URL), when attached. */
  eftProofUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  productId: number;
  name: string;
  coverImage: string | null;
  basePriceCents: number;
  discountPercent: number;
  currency: string;
  stockQuantity: number;
  quantity: number;
  exclusivity: string;
  addedAt: string;
};

export type CartSummary = {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  currency: string;
};

export type VantaCustomer = {
  id: number;
  inGameName: string;
  playerId: string;
  email: string;
  currencyPref: string;
  telegramLinked?: boolean;
  telegramId?: string | null;
  role?: "owner" | "admin" | "customer";
  notificationsEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TelegramUser = {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  displayName: string;
};

export type DashboardStats = {
  totalOrders: number;
  totalRevenueCents: number;
  pendingOrders: number;
  verifiedOrders: number;
  rejectedPayments: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
};

export type DashboardAlert = {
  id: string;
  type: string;
  severity: "high" | "medium";
  title: string;
  description: string;
  entityId: string;
  createdAt: string;
};

export type OwnerStats = {
  totalCustomers: number;
  totalOrders: number;
  totalRevenueCents: number;
  totalAdmins: number;
  totalProducts: number;
  verifiedOrders: number;
  starsOrders: number;
  starsEarned: number;
  starsHeld: number;
  starsAvailable: number;
  starsRevenueCents: number;
};

export function formatPrice(cents: number, currency = "ZAR"): string {
  const rands = cents / 100;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(rands);
}
