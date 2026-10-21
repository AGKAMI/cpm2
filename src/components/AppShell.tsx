"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AccountSummary } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AccountFormModal } from "@/components/AccountFormModal";
import { SlotModal } from "@/components/SlotModal";
import { ExportConfirmModal, SlotPurchaseConfirmModal } from "@/components/ConfirmDialogs";
import { CarBackdrop } from "@/components/CarBackdrop";
import { ImportModal } from "@/components/ImportModal";
import { useFleet } from "@/components/FleetProvider";
import { useTheme } from "@/hooks/useTheme";

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

import { createContext, useContext } from "react";

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) throw new Error("useShell must be used inside <AppShell>");
  return context;
}

const NAV = [
  { href: "/", label: "Overview", hint: "O" },
  { href: "/fleet", label: "Fleet", hint: "F" },
  { href: "/activity", label: "Activity", hint: "A" },
  { href: "/settings", label: "Settings", hint: "S" },
];

const SHORTCUTS = [
  { keys: "N", action: "New account" },
  { keys: "/", action: "Search the fleet" },
  { keys: "E", action: "Export the fleet" },
  { keys: "G then F", action: "Go to fleet" },
  { keys: "G then A", action: "Go to activity" },
  { keys: "G then S", action: "Go to settings" },
  { keys: "?", action: "Show this list" },
  { keys: "Esc", action: "Close a dialog" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const fleet = useFleet();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

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
        if (key === "f") router.push("/fleet");
        if (key === "a") router.push("/activity");
        if (key === "s") router.push("/settings");
        if (key === "o") router.push("/");
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
      if (key === "e") {
        event.preventDefault();
        setExportOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [router]);

  function performExport(format: "csv" | "json") {
    setExportOpen(false);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.href = `/api/export?format=${format}&confirm=true`;
    link.download = `cpm2-fleet-${stamp}.${format}`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
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
          className="sr-only left-4 top-4 z-50 rounded-full bg-racing px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper focus:not-sr-only focus:absolute"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
          <div className="dial-sweep" aria-hidden />
          <div className="relative mx-auto flex max-w-[1440px] flex-wrap items-end gap-x-6 gap-y-3 px-4 pb-2.5 pt-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="roundel">
                <svg
                  viewBox="0 0 24 24"
                  className="h-[18px] w-[18px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5" aria-hidden="true"
                >
                  <path d="M4 13l1.5-4.5A2 2 0 017.4 7h9.2a2 2 0 011.9 1.5L20 13" strokeLinecap="round" />
                  <path d="M3.5 13h17v4.5h-17z" strokeLinejoin="round" />
                  <circle cx="7" cy="17.5" r="1.6" />
                  <circle cx="17" cy="17.5" r="1.6" />
                </svg>
              </span>
              <span>
                <span className="wordmark block text-[23px] leading-none text-ink" translate="no">
                  Fleet <span className="text-racing">Ledger</span>
                </span>
                <span className="label-caps mt-1.5 block">
                  Car Parking Multiplayer 2 · account register
                </span>
              </span>
            </Link>

            <nav className="ml-auto flex items-center gap-4 sm:gap-6">
              {NAV.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`tab ${active ? "tab-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden items-center gap-2 border border-ink/12 bg-paper-raised px-2.5 py-1.5 sm:flex">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    fleet.error ? "bg-oxblood" : fleet.loading ? "bg-brass animate-blink" : "bg-racing"
                  }`}
                />
                <span className="num text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  {fleet.error ? "offline" : fleet.loading ? "syncing" : "live"}
                </span>
              </span>

              <button
                type="button"
                onClick={toggleTheme}
                title={theme === "night" ? "Switch to paper" : "Switch to night"}
                aria-label={theme === "night" ? "Switch to paper theme" : "Switch to night theme"}
                className="square-btn h-9 w-9"
              >
                {theme === "night" ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path
                      d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                Import
              </Button>
              <Button variant="primary" size="sm" onClick={openNewAccount}>
                + Add account
              </Button>
            </div>
          </div>
          <div className="rule-double mx-auto max-w-[1440px]" />
        </header>

        <main
          id="main"
          className="relative mx-auto max-w-[1440px] scroll-mt-24 px-4 py-6 sm:px-6 sm:py-8"
        >
          {children}
        </main>

        <footer className="relative mx-auto max-w-[1440px] px-4 pb-10 pt-4 sm:px-6">
          <div className="rule-double mb-3" />
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="num text-[10px] text-ink-faint">
              Fleet Ledger · Car Parking Multiplayer 2 · 20 base car slots · 15 extra slots max per account · 100
              coins per slot
            </p>
            <p className="num text-[10px] text-ink-faint">passwords encrypted at rest · AES-256-GCM</p>
          </div>
        </footer>

        <AccountFormModal
          key={`form-${formSession}`}
          open={formOpen}
          account={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={async (payload) => {
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
          onClose={() => setSlotAccount(null)}
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

        <ImportModal open={importOpen} busy={false} onClose={() => setImportOpen(false)} onImport={fleet.importCsv} />

        <Modal
          open={confirmState !== null}
          onClose={() => closeConfirm(false)}
          title={confirmState?.title ?? ""}
          width="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => closeConfirm(false)} type="button">
                Keep it
              </Button>
              <Button variant="danger" onClick={() => closeConfirm(true)} type="button">
                {confirmState?.confirmLabel ?? "Confirm"}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-ink-soft">{confirmState?.message ?? ""}</p>
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
                className="flex items-baseline justify-between gap-4 border-b border-ink/8 py-2 last:border-0"
              >
                <dt className="num text-[12px] text-ink">{item.action}</dt>
                <dd className="num rounded-full border border-ink/15 bg-paper-sunken px-1.5 py-0.5 text-[11px] text-ink-soft">
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
