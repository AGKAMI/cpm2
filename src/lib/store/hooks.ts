/**
 * SWR data hooks — CLIENT-ONLY.
 *
 * These must never be imported from a server component: swr's exports map puts
 * the `react-server` condition first and that build exports no `useSWR`, so
 * pulling this module into the server graph fails the Turbopack build with
 * "Export default doesn't exist". Keep it behind "use client".
 */

"use client";

import useSWR from "swr";
import {
  request,
  type VantaProduct,
  type VantaProductMedia,
  type VantaCategory,
  type VantaCustomer,
  type VantaPromotion,
  type TelegramUser,
} from "./client";

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
