import { Metadata } from "next";
import { headers } from "next/headers";
import { ProfileClient } from "@/components/ProfileClient";

export const metadata: Metadata = {
  title: "Profile - VANTA GARAGE",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const headerList = await headers();
  const initData = headerList.get("x-telegram-init-data");

  const fetchHeaders: HeadersInit = {};
  if (initData) fetchHeaders["X-Telegram-Init-Data"] = initData;

  const res = await fetch("http://localhost:3000/api/store/profile", {
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
