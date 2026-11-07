/**
 * VANTA GARAGE — client-side store API caller.
 * Mirrors the existing @/lib/client pattern for store endpoints.
 */

const STORE_BASE = "/api/store";

function telegramInitData(): string {
  if (typeof window === "undefined" || typeof window.Telegram === "undefined") return "";
  const webApp = window.Telegram?.WebApp;
  return typeof webApp?.initData === "string" ? webApp.initData : "";
}

const TELEGRAM_INIT_DATA_HEADER = "X-Telegram-Init-Data";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
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

  return payload as T;
}

export const vantaApi = {
  products: (params?: { q?: string; featured?: boolean }) => {
    const url = new URL(`${STORE_BASE}/products`);
    if (params?.q) url.searchParams.set("q", params.q);
    if (params?.featured) url.searchParams.set("featured", "1");
    return request<{ products: VantaProduct[]; total: number }>(url.pathname + url.search);
  },
  categories: () => request<{ categories: VantaCategory[] }>("/categories"),
  createProduct: (body: unknown) =>
    request<{ product: VantaProduct }>("/products", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  orders: () => request<{ orders: VantaOrder[] }>("/orders"),
  order: (id: string) => request<{ order: VantaOrder }>(`/orders?id=${encodeURIComponent(id)}`),
  checkout: (body: unknown) =>
    request<{ order: VantaOrder; reservedUntil: string; payfastUrl: string | null }>("/checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  media: (productId: number) =>
    request<{ media: VantaProductMedia[] }>(`/admin/media?productId=${productId}`),
};

export type VantaProduct = {
  id: number;
  categoryId: number | null;
  cpm2CarCode: number | null;   // CPM2 catalog car code
  name: string;
  description: string;
  basePriceCents: number;
  currency: string;
  stockQuantity: number;
  availabilityState: string;
  exclusivity: string;
  isFeatured: boolean;
  isPublished: boolean;
  version: number;
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
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
};

export type VantaOrder = {
  id: string;
  customerId: number;
  productId: number;
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
  createdAt: string;
  updatedAt: string;
};

export function formatPrice(cents: number, currency = "ZAR"): string {
  const rands = cents / 100;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(rands);
}
