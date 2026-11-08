"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AccountSummary } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toaster";
import { Modal } from "@/components/ui/Modal";
import { AccountFormModal } from "@/components/AccountFormModal";
import { SlotModal } from "@/components/SlotModal";
import { ExportConfirmModal, SlotPurchaseConfirmModal } from "@/components/ConfirmDialogs";
import { CarBackdrop } from "@/components/CarBackdrop";
import { ImportModal } from "@/components/ImportModal";
import { useFleet } from "@/components/FleetProvider";
import { ThemeMenu } from "@/components/ThemeMenu";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
};

type ShellContextValue = {
  openNewAccount: () => void;
  openEditAccount: (account: AccountSummary) => void;
  openSlotPurchase: (account: AccountSummary) => void;
  openExport: () => void;
  openImport: () => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) throw new Error("useShell must be used inside <AppShell>");
  return context;
}

const NAV = [
  { href: "/fleet/cpm1", label: "CPM1", hint: "1" },
  { href: "/fleet/cpm2", label: "CPM2", hint: "2" },
  { href: "/trade", label: "Trade", hint: "T" },
  { href: "/settings", label: "Settings", hint: "S" },
];

const STORE_NAV = [
  ...NAV,
  { href: "/store", label: "Store", hint: "V" },
];

function getNavForPath(pathname: string) {
  return pathname.startsWith("/store") ? STORE_NAV : NAV;
}

/** Shaped pill nav item with hover lift + active glow — used by both desktop header and mobile dock. */
function NavItem({ item, active }: { item: (typeof NAV)[number]; active: boolean }) {
  const Icon = NAV_ICONS[item.href];
  return (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        active
          ? "bg-primary border border-primary text-primary-foreground hover:bg-racing hover:text-primary-foreground hover:border-primary"
          : "bg-background border border-border text-muted-foreground hover:border-primary hover:text-primary-foreground hover:border-primary",
      )}
      aria-current={active ? "page" : undefined}
    >
      {Icon}
      <span>{item.label}</span>
    </Link>
  );
}

/**
 * Fleet nav icon for one game — the car glyph. The registers sit side by side
 * and the text label does the distinguishing.
 */
function GameNavIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 13l1.5-4.5A2 2 0 017.4 7h9.2a2 2 0 011.9 1.5L20 13" strokeLinecap="round" />
      <path d="M3.5 13h17v4.5h-17z" strokeLinejoin="round" />
      <circle cx="7" cy="17.5" r="1.6" />
      <circle cx="17" cy="17.5" r="1.6" />
    </svg>
  );
}

const NAV_ICONS: Record<string, ReactNode> = {
  "/fleet/cpm1": <GameNavIcon />,
  "/fleet/cpm2": <GameNavIcon />,
  "/trade": (
    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 8h13M14 4.5L17.5 8 14 11.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16H7M10 12.5L6.5 16l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "/settings": (
    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 7h9M17.5 7H20M4 17h2.5M9.5 17H20" strokeLinecap="round" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="7" cy="17" r="2.2" />
    </svg>
  ),
  "/store": (
    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      <path d="M9 17v-2m6 2v-2m-6-10v2m6 2v2" />
    </svg>
  ),
};

const SHORTCUTS = [
  { keys: "N", action: "New account" },
  { keys: "/", action: "Search the fleet" },
  { keys: "G then 1", action: "Go to the CPM1 register" },
  { keys: "G then 2", action: "Go to the CPM2 register" },
  { keys: "G then T", action: "Go to the trade desk" },
  { keys: "G then S", action: "Go to settings" },
  { keys: "G then V", action: "Go to the store" },
  { keys: "?", action: "Show this list" },
  { keys: "Esc", action: "Close a dialog" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const fleet = useFleet();
  const router = useRouter();
  const pathname = usePathname();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountSummary | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [slotAccount, setSlotAccount] = useState<AccountSummary | null>(null);
  const [slotSession, setSlotSession] = useState(0);
  const [pendingSlot, setPendingSlot] = useState<{ account: AccountSummary; count: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const [confirmResolver, setConfirmResolver] = useState<((value: boolean) => void) | null>(null);
  const toast = useToast();
  const [awaitingExportConsent, setAwaitingExportConsent] = useState(false);
  const [exportConsentPassword, setExportConsentPassword] = useState("");
  const [exportConsentBusy, setExportConsentBusy] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("json");

  function openNewAccount() {
    setEditing(null);
    setFormSession((value) => value + 1);
    setFormOpen(true);
  }

  function openEditAccount(account: AccountSummary) {
    setEditing(account);
    setFormSession((value) => value + 1);
    setFormOpen(true);
  }

  function openSlotPurchase(account: AccountSummary) {
    setSlotAccount(account);
    setSlotSession((value) => value + 1);
  }

  function confirm(options: ConfirmOptions): Promise<boolean> {
    setConfirmState(options);
    return new Promise<boolean>((resolve) => {
      setConfirmResolver(() => resolve);
    });
  }

  function closeConfirm(result: boolean) {
    confirmResolver?.(result);
    setConfirmResolver(null);
    setConfirmState(null);
  }

  // Keyboard shortcuts.
  useEffect(() => {
    let pendingG = false;
    let timer = 0;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        setShortcutsOpen(false);
        return;
      }
      if (typing) return;

      if (pendingG) {
        pendingG = false;
        window.clearTimeout(timer);
        const key = event.key.toLowerCase();
        if (key === "1") router.push("/fleet/cpm1");
        if (key === "2") router.push("/fleet/cpm2");
        if (key === "f") router.push("/fleet");
        if (key === "t") router.push("/trade");
        if (key === "s") router.push("/settings");
        if (key === "v") router.push("/store");
        return;
      }

      if (event.key.toLowerCase() === "g") {
        pendingG = true;
        timer = window.setTimeout(() => {
          pendingG = false;
        }, 1200);
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        const field = document.getElementById("fleet-search") as HTMLInputElement | null;
        if (field) {
          field.focus();
          field.select();
        } else {
          router.push("/fleet");
        }
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((value) => !value);
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        openNewAccount();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [router]);

  function triggerExport() {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.href = `/api/export?format=${exportFormat}&confirm=true`;
    link.download = `cpm2-fleet-${stamp}.${exportFormat}`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setAwaitingExportConsent(false);
    setExportConsentPassword("");
  }

  async function confirmExportConsent() {
    if (!exportConsentPassword.trim()) return;
    setExportConsentBusy(true);
    try {
      const response = await fetch("/api/auth/reveal-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: exportConsentPassword }),
      });
      if (!response.ok) {
        toast.error("Wrong console password", "Try again.");
        return;
      }
      triggerExport();
    } finally {
      setExportConsentBusy(false);
    }
  }

  function performExport(format: "csv" | "json") {
    setExportOpen(false);
    setExportFormat(format);
    setExportConsentPassword("");
    setAwaitingExportConsent(true);
  }

  const shell: ShellContextValue = {
    openNewAccount,
    openEditAccount,
    openSlotPurchase,
    openExport: () => setExportOpen(true),
    openImport: () => setImportOpen(true),
    confirm,
  };

  return (
    <ShellContext.Provider value={shell}>
      <div className="relative min-h-screen">
        <CarBackdrop />
        <a
          href="#main"
          className="sr-only left-4 top-4 z-50 rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-secondary-foreground focus:not-sr-only focus:absolute"
        >
          Skip to content
        </a>
        {pathname === "/" ? null : (
                <header
          className="sticky top-0 z-30 border-b border-border shadow-lg pt-[env(safe-area-inset-top)]"
          style={{ backgroundColor: "var(--color-paper-raised)" }}
        >
          <div className="relative mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3 pt-3 sm:px-6">
            <Link href="/fleet" className="flex items-center gap-3">
              <img
                src="/icon.svg"
                alt=""
                aria-hidden="true"
                width={40}
                height={40}
                className="h-10 w-10 shrink-0"
              />
              <span>
                <span className="block text-[20px] leading-none text-foreground" translate="no">
                  Fleet <span className="text-primary">Ledger</span>
                </span>
              </span>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} aria-label="Back to app selection">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l-7-7 7-7"/></svg>
            </Button>

            <nav className="ml-auto hidden items-center gap-2 sm:flex">
                          {getNavForPath(pathname).map((item) => {
                            const active =
                              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                            return <NavItem key={item.href} item={item} active={active} />;
                          })}
                        </nav>

            <div className="ml-auto flex flex-wrap items-center gap-2 sm:ml-0">
              <span className="flex items-center gap-2 rounded-md bg-background px-3 py-1 border border-border">
                <span
                  className={`h-2 w-2 rounded-full animate-pulse ${fleet.error ? "bg-destructive" : fleet.loading ? "bg-secondary" : "bg-racing"}`}
                />
                <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {fleet.error ? "offline" : fleet.loading ? "syncing" : "live"}
                </span>
              </span>

              <ThemeMenu />

              {pathname.startsWith("/fleet") ? (
                <Button size="sm" onClick={openNewAccount}>
                  + Add account
                </Button>
              ) : null}
            </div>
          </div>
        </header>
        )}

        <main
          id="main"
          className="relative mx-auto max-w-[1440px] scroll-mt-20 px-4 py-6 sm:px-6 sm:py-8 bg-background"
        >
          {children}
        </main>

        <footer className="relative mx-auto max-w-[1440px] px-4 pb-12 pt-4 sm:px-6 sm:pb-16">
          <div className="border-t border-border mb-4" />
        </footer>

        {pathname === "/" ? null : (
                <nav
                  aria-label="Primary"
                  className="mobile-dock fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 pb-4 sm:pb-3 sm:px-6 sm:hidden"
                >
          <div
                      className="mx-auto flex max-w-[340px] items-center justify-center gap-2 overflow-x-auto whitespace-nowrap bg-background border-t border-border rounded-full px-3 py-2 shadow-xl"
                    >
                      {getNavForPath(pathname).map((item) => {
                        const active =
                          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                        return <NavItem key={item.href} item={item} active={active} />;
                      })}
                    </div>
        </nav>
        )}

        <AccountFormModal
          key={`form-${formSession}`}
          open={formOpen}
          account={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={async (payload: Record<string, unknown>) => {
            if (editing) {
              await fleet.updateAccount(editing.id, payload);
              return true;
            }
            const created = await fleet.createAccount(payload);
            return created !== null;
          }}
        />

        <SlotModal
          key={`slot-${slotSession}`}
          open={slotAccount !== null}
          account={slotAccount}
          onClose={() => {
            if (pendingSlot === null) setSlotAccount(null);
          }}
          onReview={(count) => {
            if (slotAccount) setPendingSlot({ account: slotAccount, count });
          }}
        />

        <SlotPurchaseConfirmModal
          open={pendingSlot !== null}
          account={pendingSlot?.account ?? null}
          count={pendingSlot?.count ?? 1}
          onCancel={() => setPendingSlot(null)}
          onConfirm={() => {
            if (pendingSlot) void fleet.buySlots(pendingSlot.account, pendingSlot.count);
            setPendingSlot(null);
          }}
        />

        <ExportConfirmModal
          open={exportOpen}
          accountCount={fleet.accounts.length}
          onCancel={() => setExportOpen(false)}
          onConfirm={performExport}
        />

        {awaitingExportConsent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
            <div className="relative w-full max-w-[340px] rounded-lg border border-border bg-background p-6 text-center shadow-lg">
              <h2 className="text-lg font-medium text-foreground mb-2">Confirm the export</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Export exposes every stored password. Re-enter the console password to continue.
              </p>
              <input
                type="password"
                placeholder="console password"
                value={exportConsentPassword}
                onChange={(event) => setExportConsentPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void confirmExportConsent();
                }}
                autoComplete="current-password"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-background file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-background"
              />
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setAwaitingExportConsent(false)} type="button">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={confirmExportConsent}
                  disabled={exportConsentBusy}
                  type="button"
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}

        <ImportModal open={importOpen} busy={false} onClose={() => setImportOpen(false)} onImport={fleet.importCsv} />

        <Modal
          open={confirmState !== null}
          onClose={() => closeConfirm(false)}
          title={confirmState?.title ?? ""}
          width="max-w-md"
          footer={
            <>
              <Button variant="outline" onClick={() => closeConfirm(false)} type="button">
                Keep it
              </Button>
              <Button variant="destructive" onClick={() => closeConfirm(true)} type="button">
                {confirmState?.confirmLabel ?? "Confirm"}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-muted-foreground">{confirmState?.message ?? ""}</p>
        </Modal>

        <Modal
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
          title="Keyboard shortcuts"
          subtitle="Everything here works without touching the mouse."
          width="max-w-md"
        >
          <dl className="flex flex-col">
            {SHORTCUTS.map((item) => (
              <div
                key={item.keys}
                className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0"
              >
                <dt className="text-sm font-medium text-foreground">{item.action}</dt>
                <dd className="rounded-full border border-input bg-background px-2 py-0.5 text-[11px] text-muted-foreground border border-border">
                  {item.keys}
                </dd>
              </div>
            ))}
          </dl>
        </Modal>
      </div>
    </ShellContext.Provider>
  );
}
