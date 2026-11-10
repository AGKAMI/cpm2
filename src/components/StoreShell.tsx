"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Dock } from "@/components/ui/dock";
import { LucideIcon } from "lucide-react";
import { Home, Grid, List } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationBell } from "@/components/NotificationBell";
import { useTheme } from "@/hooks/useTheme";
import { vantaApi } from "@/lib/store/client";
import { AdminIcon } from "@/components/ui/admin-icon";
import { OwnerIcon } from "@/components/ui/owner-icon";
import { ProfileIcon } from "@/components/ui/profile-icon";
import SwitchComponent from "@/components/ui/switch8";

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

const VANTA_LOCKUP = `
<svg viewBox="0 0 100 114" width="32" height="36.48" style="flex:none;display:block">
  <linearGradient id="vgGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3a0"/><stop offset=".5" stop-color="#d4af4f"/><stop offset="1" stop-color="#8f6f26"/></linearGradient>
  <path d="M12,8H88L94,14V60Q94,90 50,108Q6,90 6,60V14Z" fill="none" stroke="url(#vgGold)" stroke-width="4"/>
  <path d="M19,28H81V60Q81,80 50,95Q19,80 19,60Z" fill="none" stroke="#d4af4f" stroke-width="2"/>
  <path d="M25,38 50,86 75,38" fill="none" stroke="#d4af4f" stroke-width="9" stroke-linejoin="miter"/>
  <path d="M77,38H63Q57,38 57,44V48Q57,53 63,53H72V61H61" fill="none" stroke="#d4af4f" stroke-width="5"/>
</svg>
`;

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
  const { mode, toggleTheme } = useTheme();

  useEffect(() => {
    const initData =
      typeof window !== "undefined" && typeof window.Telegram !== "undefined"
        ? window.Telegram.WebApp?.initData ?? ""
        : "";
    const headers: HeadersInit = {};
    if (initData) headers["X-Telegram-Init-Data"] = initData;

    fetch("/api/store/admin/is-admin", { cache: "no-store", headers })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setIsAdmin(Boolean(data?.isAdmin));
        setIsOwner(Boolean(data?.isOwner));
      })
      .catch(() => {
        setIsAdmin(false);
        setIsOwner(false);
      });

    // Fetch Telegram profile for avatar
    vantaApi
      .profile()
      .then((data) => {
        if (data.telegramUser) {
          setProfile({
            photoUrl: data.telegramUser.photoUrl,
            displayName: data.telegramUser.displayName,
            username: data.telegramUser.username,
          });
        }
      })
      .catch(() => {
        // Profile fetch is non-fatal
      });
  }, []);

  // Track login state via localStorage so logout in ProfileClient
  // immediately hides admin/owner tabs and profile in this shell.
  useEffect(() => {
    const checkLogin = () => {
      if (typeof window !== "undefined") {
        setCustomerLoggedIn(Boolean(localStorage.getItem("vanta_customer_id")));
      }
    };
    checkLogin();
    window.addEventListener("storage", checkLogin);
    window.addEventListener("focus", checkLogin);
    return () => {
      window.removeEventListener("storage", checkLogin);
      window.removeEventListener("focus", checkLogin);
    };
  }, []);

  const visibleNav = STORE_NAV.filter(
    (t) =>
      (t.key !== "admin" || isAdmin === true) &&
      (t.key !== "owner" || isOwner === true),
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
      {/* Store header — Vanta logo centered, avatar left, controls right. */}
      <AnimatePresence mode="popLayout">
        <header
          className="sticky top-0 z-30 border-b border-border shadow-sm px-4 pt-3 pb-2 sm:px-6"
          style={{ backgroundColor: "var(--background)" }}
        >
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              {activeTab !== "profile" && (
                <div className="relative h-8 w-8 shrink-0">
                  <motion.div
                    layoutId="vanta-profile-avatar"
                    transition={{ type: "spring", stiffness: 320, damping: 32 }}
                    className="h-8 w-8 rounded-full overflow-hidden border-2 border-gold/40"
                  >
                    {profile?.photoUrl && customerLoggedIn ? (
                      <img
                        src={profile.photoUrl}
                        alt={profile.displayName || "Profile"}
                        className="h-full w-full object-cover"
                        loading="eager"
                      />
                    ) : (
                      <svg
                        className="absolute inset-0 h-full w-full fill-current text-ink-soft"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </motion.div>
                  <div className="absolute inset-0 h-full w-full rounded-full border-2 border-gold/40 animate-pulse-ring" />
                </div>
              )}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
              <div className="h-6 w-6 sm:h-8 sm:w-8 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: VANTA_LOCKUP }} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")} aria-label="Back to app selection">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </Button>
              <SwitchComponent
                checked={mode === "night"}
                onCheckedChange={() => toggleTheme()}
              />
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
      </AnimatePresence>

      <Dock
        items={visibleNav.map((item) => ({
          icon: ICON_MAP[item.key],
          label: item.label.charAt(0).toUpperCase() + item.label.slice(1),
          href: item.href,
          active: activeTab === item.key,
        }))}
      />
    </div>
  );
}