"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { NotificationBell } from "@/components/NotificationBell";

type StoreTab = "home" | "categories" | "orders" | "profile" | "admin" | "owner";

const STORE_NAV: { key: StoreTab; href: string; label: string; icon: string }[] = [
  { key: "home", href: "/store", label: "HOME", icon: "home" },
  { key: "categories", href: "/store/categories", label: "CATEGORIES", icon: "grid" },
  { key: "orders", href: "/store/orders", label: "ORDERS", icon: "list" },
  { key: "profile", href: "/store/profile", label: "PROFILE", icon: "person" },
  { key: "admin", href: "/store/admin", label: "ADMIN", icon: "admin" },
  { key: "owner", href: "/store/owner", label: "OWNER", icon: "owner" },
];

const ICONS: Record<string, string> = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" ry="1"/><rect x="14" y="3" width="7" height="7" rx="1" ry="1"/><rect x="14" y="14" width="7" height="7" rx="1" ry="1"/><rect x="3" y="14" width="7" height="7" rx="1" ry="1"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  person: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"><circle cx="12" cy="7" r="4"/></path></svg>`,
  admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  owner: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15l1 2L16 6l2 1.4V19c0 .55-.45 1-1 1h-5z"/></svg>`,
  dots: `<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>`,
  bell: `<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>`,
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

export function StoreNavItem({ item, active }: { item: typeof STORE_NAV[number]; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-[0.15em] whitespace-nowrap cursor-pointer font-bold",
        active ? "text-gold" : "text-ink-soft",
      )}
      aria-current={active ? "page" : undefined}
      role="tab"
      aria-selected={active ? "true" : "false"}
    >
      <span
        className="flex items-center justify-center w-6 h-6 shrink-0"
        dangerouslySetInnerHTML={{ __html: ICONS[item.icon] }}
      />
      <span className={cn("leading-none", active ? "font-extrabold" : "font-normal")}>
        {item.label}
      </span>
      {active && (
        <span className="tab-indicator absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gold-gradient rounded-full" />
      )}
    </Link>
  );
}

interface StoreShellProps {
  children: ReactNode;
  dock?: ReactNode;
}

export function StoreShell({ children, dock }: StoreShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

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
    <div className="relative min-h-screen bg-[#0a0a0a]">
      {/* Store header — shield logo, gold serif brand, search icon. */}
      <header
        className="sticky top-0 z-30 border-b border-border shadow-sm px-4 pt-3 pb-2 sm:px-6"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8 shrink-0">
              <svg
                className="absolute inset-0 h-full w-full fill-current"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-brand-gold" />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} aria-label="Back to app selection">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => {}} aria-label="Search">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </Button>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main
        id="store-main"
        className="relative mx-auto max-w-[1440px] scroll-mt-16 px-4 py-6 sm:px-6 sm:py-8 bg-[#0a0a0a] pb-28 sm:pb-10"
      >
        {children}
      </main>

      <nav
        aria-label="Store"
        className="store-dock fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 pb-4 sm:pb-3 sm:px-6"
      >
        <div className="mx-auto flex max-w-[340px] items-center justify-center gap-2 overflow-x-auto whitespace-nowrap border border-border rounded-full px-3 py-2 shadow-lg" style={{ backgroundColor: "#0a0a0a" }}>
          {visibleNav.map((item) => (
            <StoreNavItem key={item.href} item={item} active={activeTab === item.key} />
          ))}
        </div>
      </nav>
    </div>
  );
}