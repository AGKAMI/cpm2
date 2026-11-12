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

function telegramInitData(): string {
  if (typeof window === "undefined" || typeof window.Telegram === "undefined") return "";
  const webApp = window.Telegram?.WebApp;
  return typeof webApp?.initData === "string" ? webApp.initData : "";
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

function ownerEmail(): string | null {
  if (typeof window === "undefined") return null;
  const email = window.localStorage.getItem("vanta_owner_email");
  return email && email.trim() ? email.trim() : null;
}

const TELEGRAM_INIT_DATA_HEADER = "X-Telegram-Init-Data";
const OWNER_EMAIL_HEADER = "X-Owner-Email";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const cacheKey = getCacheKey(path);

  // Return cached data if still fresh (only for GET requests without body)
  if (!init?.method || init.method === "GET") {
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
  const email = ownerEmail();
  if (email) headers.set(OWNER_EMAIL_HEADER, email);

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

  // Cache invalidation: mutations on product-related paths clear the products cache
  // so the next GET returns fresh data (fixes "create product doesn't show up" bug)
  if (
    init?.method &&
    init.method !== "GET" &&
    (path.startsWith("/products") || path.startsWith("/admin/products"))
  ) {
    cache.delete(getCacheKey("/products"));
  }

  // Cache GET responses
  if (!init?.method || init.method === "GET") {
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
  createCategory: (body: { name: string; slug: string; description?: string; sortOrder?: number }) =>
    request<{ category: VantaCategory }>("/admin/categories", {
      method: "POST",
      body: JSON.stringify(body),
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
    request<{ order: VantaOrder; reservedUntil: string; payfastUrl: string | null }>("/checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  media: (productId: number) =>
    request<{ media: VantaProductMedia[] }>(`/media?productId=${productId}`),

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
  name: string;
  description: string;
  basePriceCents: number;
  currency: string;
  stockQuantity: number;
  availabilityState: string;
  exclusivity: string;
  isFeatured: boolean;
  isNew: boolean;
  isSale: boolean;
  isPublished: boolean;
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
  sortOrder: number;
  isActive: boolean;
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
};

export function formatPrice(cents: number, currency = "ZAR"): string {
  const rands = cents / 100;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(rands);
}

// ── SWR hooks — cached, auto-revalidating data fetches ─────────────────────
import useSWR from "swr";

function fetcher<T>(path: string): Promise<T> {
  return request(path);
}

export function useProducts(params?: { q?: string; featured?: boolean }) {
  let url = "/products";
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.featured) qs.set("featured", "1");
  if (qs.toString()) url += `?${qs.toString()}`;
  const { data, error, isLoading, mutate } = useSWR<{ products: VantaProduct[]; total: number }>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
  });
  return {
    products: data?.products ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
  };
}

export function useCategories() {
  const { data, error, isLoading, mutate } = useSWR<{ categories: VantaCategory[] }>("/categories", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
  });
  return {
    categories: data?.categories ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function usePromotions() {
  const { data, error, isLoading, mutate } = useSWR<{ promotions: VantaPromotion[] }>("/promotions", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
  });
  return {
    promotions: data?.promotions ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR<{ customer: VantaCustomer | null; telegramUser: TelegramUser | null }>("/profile", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
  });
  return {
    customer: data?.customer ?? null,
    telegramUser: data?.telegramUser ?? null,
    isLoading,
    error,
    mutate,
  };
}

export function useMedia(productId: number) {
  const { data, error, isLoading } = useSWR<{ media: VantaProductMedia[] }>(
    productId ? `/media?productId=${productId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
    },
  );
  return {
    media: (data as { media: unknown[] } | undefined)?.media ?? [],
    isLoading,
    error,
  };
}
