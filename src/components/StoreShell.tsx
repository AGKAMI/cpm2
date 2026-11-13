"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Dock } from "@/components/ui/dock";
import { LucideIcon } from "lucide-react";
import { Home, Grid, List } from "lucide-react";

import { NotificationBell } from "@/components/NotificationBell";
import { vantaApi } from "@/lib/store/client";
import { AdminIcon } from "@/components/ui/admin-icon";
import { OwnerIcon } from "@/components/ui/owner-icon";
import { ProfileIcon } from "@/components/ui/profile-icon";

type StoreTab = "home" | "categories" | "orders" | "profile" | "admin" | "owner";

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

const VANTA_LOCKUP = "/kami-vanta-logo.svg";

interface StoreShellProps {
  children: ReactNode;
  dock?: ReactNode;
}

export function StoreShell({ children, dock }: StoreShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<{ photoUrl?: string; displayName?: string; username?: string } | null>(null);
  const [customerLoggedIn, setCustomerLoggedIn] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(true);

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

  // Re-check admin when session flag appears from another tab.
  useEffect(() => {
    const onAdminSessionStorage = () => {
      if (typeof window !== "undefined") {
        const nowActive = adminSessionActive();
        if (nowActive && isAdmin !== true && isOwner !== true) {
          void refreshStatus();
        }
      }
    };
    window.addEventListener("storage", onAdminSessionStorage);
    return () =>
      window.removeEventListener("storage", onAdminSessionStorage);
  }, [isAdmin, isOwner]);

  const visibleNav = STORE_NAV.filter(
    (t) =>
      (t.key !== "admin" || isAdmin === true || adminSessionActive()) &&
      (t.key !== "owner" || isOwner === true || adminSessionActive()),
  );

  const activeTab: StoreTab | undefined =
    visibleNav.find((t) => {
      if (t.key === "home") {
        return pathname === t.href;
      }
      return pathname === t.href || pathname.startsWith(`${t.href}/`);
    })?.key;

  return (
    <div className="relative min-h-screen bg-background">
      <>
        <header
          className="sticky top-0 z-30 border-b border-border shadow-sm px-4 pt-8 pb-8 sm:px-6"
          style={{ backgroundColor: "var(--background)" }}
        >
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              {activeTab !== "profile" && (
                <div className="relative h-8 w-8 shrink-0">
                  <div
                    className="h-8 w-8 rounded-full overflow-hidden border-2 border-gold"
                  >
                    {profile?.photoUrl ? (
                      <Image
                        src={profile.photoUrl}
                        alt={profile.displayName || "Profile"}
                        className="h-full w-full object-cover"
                        loading="eager"
                        width={80}
                        height={80}
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-ink-soft text-xs font-bold select-none">
                        {(profile?.displayName || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "absolute inset-0 h-full w-full rounded-full border-2 border-gold animate-pulse-ring transition-opacity duration-700 ease-out",
                      loaded ? "opacity-100" : "opacity-0",
                    )}
                  />
                </div>
              )}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
              <Image
                src={VANTA_LOCKUP}
                alt="Vanta Garage"
                className="h-24 w-24 sm:h-32 sm:w-32"
                width={96}
                height={96}
                style={{ objectFit: "contain" }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/")}
                aria-label="Back to app selection"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </Button>
              <NotificationBell />
            </div>
          </div>
        </header>
        <main
          id="store-main"
          className="relative mx-auto max-w-[1440px] scroll-mt-16 px-4 py-6 sm:px-6 sm:py-8 bg-background pb-28 sm:pb-10"
        >
          {children}
        </main>
      </>

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
