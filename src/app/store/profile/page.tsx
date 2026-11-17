import { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { ProfileClient } from "@/components/ProfileClient";
import { ProfileSkeleton } from "@/components/skeleton";

export const metadata: Metadata = {
  title: "Profile - VANTA GARAGE",
};

export const dynamic = "force-dynamic";

async function ProfileContent() {
  const headerList = await headers();
  const initData = headerList.get("x-telegram-init-data");

  const fetchHeaders: HeadersInit = {};
  if (initData) fetchHeaders["X-Telegram-Init-Data"] = initData;

  // Same-origin self-fetch. Resolve the host from the request headers instead
  // of hardcoding one: a fixed localhost:3000 only works where something
  // answers on that port. On a hostless deploy nothing listens there, the
  // fetch throws, and the route dies through an error boundary.
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3001";
  const proto = headerList.get("x-forwarded-proto") ?? "http";

  const res = await fetch(`${proto}://${host}/api/store/profile`, {
    headers: fetchHeaders,
    cache: "no-store",
  });

  let customer = null;
  let telegramUser = null;
  if (res.ok) {
    const data = await res.json();
    customer = data.customer ?? null;
    telegramUser = data.telegramUser ?? null;
  }

  return (
    <ProfileClient
      initialCustomer={customer}
      initialTelegramUser={telegramUser}
    />
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}
