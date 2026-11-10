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
  const { mode, toggleTheme } = useTheme();

  let adminPoll: ReturnType<typeof setInterval> | null = null;

  useEffect(() => {
    const fetchAdminStatus = async () => {
      const initData =
        typeof window !== "undefined" && typeof window.Telegram !== "undefined"
          ? window.Telegram.WebApp?.initData ?? ""
          : "";
      const headers: HeadersInit = {};
      if (initData) headers["X-Telegram-Init-Data"] = initData;

      try {
        const r = await fetch("/api/store/admin/is-admin", { cache: "no-store", headers });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setIsAdmin(Boolean(data?.isAdmin));
        setIsOwner(Boolean(data?.isOwner));
      } catch {
        setIsAdmin(false);
        setIsOwner(false);
      }
    };

    fetchAdminStatus();
    // Poll every 5 seconds so admin/owner tabs appear/disappear live
    // without needing a page refresh after login or after adding/removing admins.
    adminPoll = setInterval(fetchAdminStatus, 5000);

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

    return () => {
      if (adminPoll) clearInterval(adminPoll);
    };
  }, []);

  // Re-check admin status when the window regains focus (e.g. after logging
  // in to an admin account in another tab or after adding/removing an admin).
  useEffect(() => {
    const onFocus = () => {
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
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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
          className="sticky top-0 z-30 border-b border-border shadow-sm px-4 pt-8 pb-8 sm:px-6"
          style={{ backgroundColor: "var(--background)" }}
        >
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              {activeTab !== "profile" && (
                <div className="relative h-8 w-8 shrink-0">
                  <motion.div
                    layoutId="vanta-profile-avatar"
                    transition={{ type: "spring", stiffness: 320, damping: 32 }}
                    className="h-8 w-8 rounded-full overflow-hidden border-2 border-gold"
                  >
                    {profile?.photoUrl ? (
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
                  <div className="absolute inset-0 h-full w-full rounded-full border-2 border-gold animate-pulse-ring" />
                </div>
              )}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
              <img src={VANTA_LOCKUP} alt="Vanta Garage" className="h-24 w-24 sm:h-32 sm:w-32" />
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