"use client";

"use client";

import { useCallback, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toaster";
import { vantaApi, formatPrice, type VantaProduct } from "@/lib/store/client";

type StoreTab = "home" | "categories" | "orders" | "profile";

const STORE_NAV: { key: StoreTab; href: string; label: string; hint: string }[] = [
  { key: "home", href: "/store", label: "Home", hint: "H" },
  { key: "categories", href: "/store/categories", label: "Categories", hint: "C" },
  { key: "orders", href: "/store/orders", label: "Orders", hint: "O" },
  { key: "profile", href: "/store/profile", label: "Profile", hint: "P" },
];

export function StoreNavItem({ item, active }: { item: typeof STORE_NAV[number]; active: boolean }) {
  return (
    <a
      key={item.href}
      href={item.href}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-200 whitespace-nowrap",
        active
          ? "bg-primary border border-primary text-primary-foreground hover:bg-primary"
          : "bg-background border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span>{item.label}</span>
    </a>
  );
}

interface StoreShellProps {
  children: ReactNode;
}

export function StoreShell({ children }: StoreShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const activeTab: StoreTab =
    (STORE_NAV.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.key ??
      "home");

  function goHome() {
    router.push("/store");
  }

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background pt-[env(safe-area-inset-top)] pb-2">
        <div className="mx-auto max-w-[1440px] flex items-center justify-between gap-3 px-4 sm:px-6">
          <a href="/store" className="flex items-center gap-3">
            <span className="block text-[20px] leading-none text-foreground">
              VANTA <span className="text-primary">GARAGE</span>
            </span>
          </a>
          <Button variant="ghost" size="icon" onClick={goHome} aria-label="Home">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3" />
            </svg>
          </Button>
        </div>
      </header>

      <main id="store-main" className="relative mx-auto max-w-[1440px] scroll-mt-16 px-4 py-6 sm:px-6 sm:py-8 bg-background">
        {children}
      </main>

      <nav
        aria-label="Store"
        className="store-dock fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 pb-4 sm:pb-3 sm:px-6 sm:hidden"
      >
        <div className="mx-auto flex max-w-[340px] items-center justify-center gap-2 overflow-x-auto whitespace-nowrap bg-background border-t border-border rounded-full px-3 py-2 shadow-xl">
          {STORE_NAV.map((item) => (
            <StoreNavItem key={item.href} item={item} active={activeTab === item.key} />
          ))}
        </div>
      </nav>
    </div>
  );
}
