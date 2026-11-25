"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Dock } from "@/components/ui/dock";
import { LucideIcon } from "lucide-react";
import { Home, Grid, List, ShoppingCart } from "lucide-react";

import { NotificationBell } from "@/components/NotificationBell";
import { HubIdentity } from "@/components/HubIdentity";
import { FleetProvider } from "@/components/FleetProvider";
import { vantaApi } from "@/lib/store/client";
import { useTheme } from "@/hooks/useTheme";
import { AdminIcon } from "@/components/ui/admin-icon";
import { OwnerIcon } from "@/components/ui/owner-icon";
import { ProfileIcon } from "@/components/ui/profile-icon";

type StoreTab =
  | "home"
  | "categories"
  | "orders"
  | "profile"
  | "admin"
  | "owner";

type StoreIcon = React.ComponentType<{ className?: string }>;

const STORE_NAV: { key: StoreTab; href: string; label: string; icon: StoreIcon }[] = [
  { key: "home", href: "/store", label: "HOME", icon: Home },
  { key: "categories", href: "/store/categories", label: "CATEGORIES", icon: Grid },
  { key: "orders", href: "/store/orders", label: "ORDERS", icon: List },
  { key: "profile", href: "/store/profile", label: "PROFILE", icon: ProfileIcon },
  { key: "admin", href: "/store/admin", label: "ADMIN", icon: AdminIcon },
  { key: "owner", href: "/store/owner", label: "OWNER", icon: OwnerIcon },
];

const ICON_MAP: Record<StoreTab, StoreIcon> = {
  home: Home,
  categories: Grid,
  orders: List,
  profile: ProfileIcon,
  admin: AdminIcon,
  owner: OwnerIcon,
};

interface StoreShellProps {
  children: ReactNode;
  dock?: ReactNode;
}

export function StoreShell({ children, dock }: StoreShellProps) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<{ photoUrl?: string; displayName?: string; username?: string } | null>(null);
  const [customerLoggedIn, setCustomerLoggedIn] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(true);
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  // localStorage must NEVER be read during render: the server can't see it,
  // so an admin's first client render computed a different dock than the SSR
  // HTML (React #418 → hydration recovery wipes <main> → black page). Mirror
  // the flag into state after mount instead — same eventual UI, safe hydration.
  const [adminSessionFlag, setAdminSessionFlag] = useState<boolean>(false);
  useEffect(() => {
    const sync = () =>
      setAdminSessionFlag(
        typeof window !== "undefined" &&
          localStorage.getItem("vanta_admin_session") === "true",
      );
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const mode = "night" as const;

  const adminSessionActive = () =>
    typeof window !== "undefined" &&
    localStorage.getItem("vanta_admin_session") === "true";

  // Single non-blocking check for Telegram initData — replaces the old
  // 4-second polling loop (150ms interval × up to 26 iterations).
  const getTelegramInitData = async (): Promise<string> => {
    if (typeof window === "undefined" || typeof window.Telegram === "undefined")
      return "";
    return window.Telegram.WebApp?.initData ?? "";
  };

  // Combined admin + profile status check.
  const refreshStatus = async () => {
    const initData = await getTelegramInitData();
    const headers: HeadersInit = {};
    if (initData) headers["X-Telegram-Init-Data"] = initData;

    try {
      const r = await fetch("/api/store/admin/is-admin", {
        cache: "no-store",
        headers,
      });
      if (r.ok) {
        const data = await r.json();
        setIsAdmin(Boolean(data?.isAdmin));
        setIsOwner(Boolean(data?.isOwner));
        if (data?.isAdmin || data?.isOwner) {
          localStorage.setItem("vanta_admin_session", "true");
        }
      }
    } catch {
      // Keep last-known state.
    }

    try {
      const data = await vantaApi.profile();
      if (data.telegramUser) {
        setProfile({
          photoUrl: data.telegramUser.photoUrl,
          displayName: data.telegramUser.displayName,
          username: data.telegramUser.username,
        });
      }
    } catch {
      // Profile fetch is non-fatal.
    }
  };

  // Mount + focus + storage: refresh status once, no polling.
  useEffect(() => {
    refreshStatus();
    const onFocus = () => void refreshStatus();
    const onStorage = () => void refreshStatus();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Admin presence heartbeat: ping the server every 60s so the owner page can
  // show live online/offline dots. Only fires when the user is verified admin/owner.
  useEffect(() => {
    if (isAdmin !== true && isOwner !== true) return;
    const t = setInterval(() => void vantaApi.adminHeartbeat(), 60_000);
    return () => clearInterval(t);
  }, [isAdmin, isOwner]);

  // Customer login state via localStorage.
  useEffect(() => {
    const checkLogin = () => {
      if (typeof window !== "undefined") {
        setCustomerLoggedIn(
          Boolean(localStorage.getItem("vanta_customer_id")),
        );
      }
    };
    checkLogin();
    window.addEventListener("storage", checkLogin);
    return () => window.removeEventListener("storage", checkLogin);
  }, []);

  // Re-check admin when session flag appears (other tab via storage event,
  // same tab via the explicit vanta-admin-session event from admin login).
  useEffect(() => {
    const onAdminSession = () => {
      if (typeof window !== "undefined") {
        const nowActive = adminSessionActive();
        if (nowActive && isAdmin !== true && isOwner !== true) {
          void refreshStatus();
        }
      }
    };
    window.addEventListener("storage", onAdminSession);
    window.addEventListener("vanta-admin-session", onAdminSession);
    return () => {
      window.removeEventListener("storage", onAdminSession);
      window.removeEventListener("vanta-admin-session", onAdminSession);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isOwner]);

  const visibleNav = STORE_NAV.filter(
    (t) =>
      // ADMIN: server-verified admin or the mirrored session flag (hydration-safe).
      (t.key !== "admin" || isAdmin === true || adminSessionFlag) &&
      // OWNER: only the server-verified owner result — a plain admin must
      // never see the owner dock entry just because vanta_admin_session is set.
      (t.key !== "owner" || isOwner === true),
  );

  const activeTab: StoreTab | undefined =
    visibleNav.find((t) => {
      if (t.key === "home") {
        return pathname === t.href;
      }
      return pathname === t.href || pathname.startsWith(`${t.href}/`);
    })?.key;

  // The home header persists everywhere EXCEPT profile / admin / owner.
  const homeHeader = !(
    pathname?.startsWith("/store/profile") ||
    pathname?.startsWith("/store/admin") ||
    pathname?.startsWith("/store/owner")
  );

  return (
    <div className="relative min-h-screen bg-background">
      <FleetProvider>
        <>
          <header
            className={
              homeHeader
                ? "sticky top-0 z-30 border-b border-border px-4 pt-3 pb-3 sm:px-6"
                : "sticky top-0 z-30 border-b border-border shadow-sm px-4 pt-3 pb-3 sm:px-6"
            }
            style={{ backgroundColor: "var(--background)" }}
          >
            {homeHeader ? (
              /* The HOME header persists on every store page except profile,
                 admin and owner: greeting + real profile + notifications. */
              <div className="flex items-center gap-3">
                <HubIdentity />
                <NotificationBell />
                {/* Cart stays a HEADER action — it's only the bottom nav that
                    drops it */}
                <Link
                  href="/store/cart"
                  aria-label="Cart"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-secondary text-foreground transition-colors hover:border-primary/60"
                >
                  <ShoppingCart className="h-5 w-5" />
                </Link>
              </div>
            ) : (
            <div className="relative flex items-center justify-between gap-2">
              {/* LEFT — leave the store, then the brand */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/";
                  }}
                  aria-label="Back to app selection"
                  title="Back to app selection"
                  className="grid w-10 h-10 shrink-0 place-items-center rounded-full border border-border bg-background text-ink-soft transition-colors hover:border-gold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[var(--scale-medium)]"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>

                <Link
                  href="/store"
                  className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Image
                    src="/kami-vanta-logo-no-wings.png"
                    alt=""
                    aria-hidden="true"
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 rounded-lg object-contain"
                  />
                  <span className="hidden truncate text-[15px] font-semibold uppercase leading-none tracking-[0.22em] text-foreground sm:block">
                    Vanta <span className="text-gold">Garage</span>
                  </span>
                </Link>
              </div>

              {/* RIGHT — appearance, alerts, then the account chip */}
              <div className="flex items-center gap-2 shrink-0">
              {/* Quick dark/light switch — 32px circle, same as back and the bell */}
              <button
                type="button"
                onClick={() => setThemeMode(themeMode === "night" ? "paper" : "night")}
                aria-label={`Switch to ${themeMode === "night" ? "daylight" : "midnight"} theme`}
                aria-pressed={themeMode === "paper"}
                className="relative w-8 h-8 rounded-full border border-border bg-background flex items-center justify-center text-ink-soft hover:border-gold hover:text-gold transition-colors disabled:opacity-50"
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${themeMode === "night" ? "opacity-100" : "opacity-0"}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width={20}
                    height={20}
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${themeMode === "paper" ? "opacity-100" : "opacity-0"}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width={20}
                    height={20}
                    aria-hidden="true"
                  >
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                  </svg>
                </span>
              </button>
              <NotificationBell />
            </div>
          </div>
          )}
        </header>
        <main
          id="store-main"
          className="relative mx-auto max-w-[1440px] scroll-mt-16 px-4 py-6 sm:px-6 sm:py-8 bg-background pb-28 sm:pb-24"
        >
          {children}
        </main>
      </>
        </FleetProvider>
      <Dock
        mode={mode}
        items={visibleNav.map((item) => ({
          icon: ICON_MAP[item.key],
          label:
            item.label.charAt(0).toUpperCase() + item.label.slice(1),
          href: item.href,
          active: activeTab === item.key,
        }))}
      />
    </div>
  );
}
