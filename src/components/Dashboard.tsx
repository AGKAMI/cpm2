"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiRequestError } from "@/lib/client";
import { LIMITS, formatNumber } from "@/lib/constants";
import { computeFleetStats } from "@/lib/stats";
import type { AccountSummary, FleetEvent, FleetStats } from "@/lib/types";
import { ToastProvider, useToast } from "@/components/ui/Toaster";
import { Button } from "@/components/ui/Button";
import { StatTiles } from "@/components/StatTiles";
import { AccountTable, type SortKey } from "@/components/AccountTable";
import { AccountFormModal } from "@/components/AccountFormModal";
import { SlotModal } from "@/components/SlotModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Toolbar, type ConsoleTab, type FleetFilter } from "@/components/Toolbar";
import { ExportConfirmModal, SlotPurchaseConfirmModal } from "@/components/ConfirmDialogs";

export default function Dashboard() {
  return (
    <ToastProvider>
      <Console />
    </ToastProvider>
  );
}

function Console() {
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [archived, setArchived] = useState<AccountSummary[]>([]);
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [events, setEvents] = useState<FleetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FleetFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tab, setTab] = useState<ConsoleTab>("fleet");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountSummary | null>(null);
  const [slotAccount, setSlotAccount] = useState<AccountSummary | null>(null);
  const [pendingSlot, setPendingSlot] = useState<{ account: AccountSummary; count: number } | null>(
    null,
  );
  const [slotBusy, setSlotBusy] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | null>(null);
  const [deleting, setDeleting] = useState<AccountSummary | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [slotSession, setSlotSession] = useState(0);

  function openForm(account: AccountSummary | null) {
    setFormSession((value) => value + 1);
    setEditing(account);
    setFormOpen(true);
  }

  function openSlots(account: AccountSummary) {
    setSlotSession((value) => value + 1);
    setSlotAccount(account);
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [fleet, archive, log] = await Promise.all([
        api.list(),
        api.list({ archived: true }),
        api.events(),
      ]);
      setAccounts(fleet.accounts);
      setStats(fleet.stats);
      setArchived(archive.accounts);
      setEvents(log.events);
      setOffline(null);
    } catch (err) {
      setOffline(
        err instanceof ApiRequestError ? err.message : "Could not reach the local database.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fleet, archive, log] = await Promise.all([
          api.list(),
          api.list({ archived: true }),
          api.events(),
        ]);
        if (cancelled) return;
        setAccounts(fleet.accounts);
        setStats(fleet.stats);
        setArchived(archive.accounts);
        setEvents(log.events);
        setOffline(null);
      } catch (err) {
        if (!cancelled) {
          setOffline(
            err instanceof ApiRequestError ? err.message : "Could not reach the local database.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (typing) return;

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        openForm(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = tab === "archived" ? archived : accounts;

    if (needle) {
      list = list.filter(
        (account) =>
          account.email.toLowerCase().includes(needle) ||
          account.notes.toLowerCase().includes(needle),
      );
    }

    if (filter !== "all" && tab === "fleet") {
      list = list.filter((account) => {
        switch (filter) {
          case "full":
            return account.cars >= account.capacity;
          case "slots":
            return account.slots > 0;
          case "cash-cap":
            return account.cash >= LIMITS.MAX_CASH;
          case "coin-cap":
            return account.coins >= LIMITS.MAX_COINS;
          default:
            return true;
        }
      });
    }

    const direction = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case "email":
          return a.email.localeCompare(b.email) * direction;
        case "cash":
          return (a.cash - b.cash) * direction;
        case "coins":
          return (a.coins - b.coins) * direction;
        case "cars":
          return (a.cars - b.cars) * direction;
        case "updated":
        default:
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
      }
    });
  }, [accounts, archived, query, filter, sortKey, sortDir, tab]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "email" ? "asc" : "desc");
  }

  async function handleCreate(payload: Record<string, unknown>): Promise<boolean> {
    try {
      const { account } = await api.create(payload);
      toast.success("Account tracked", `${account.email} is now in the fleet.`);
      await load(true);
      return true;
    } catch (err) {
      reportError(err, toast);
      throw err;
    }
  }

  async function handleUpdate(payload: Record<string, unknown>): Promise<boolean> {
    if (!editing) return false;
    try {
      const { account } = await api.update(editing.id, payload);
      toast.success("Account updated", `${account.email} saved.`);
      await load(true);
      return true;
    } catch (err) {
      reportError(err, toast);
      throw err;
    }
  }

  async function handleAdjust(
    account: AccountSummary,
    field: "cash" | "coins" | "cars",
    delta: number,
  ) {
    const next = Math.max(0, account[field] + delta);
    if (next === account[field]) return;

    setBusyId(account.id);
    try {
      const { account: updated } = await api.update(account.id, { [field]: next });
      setAccounts((current) => {
        const merged = current.map((item) => (item.id === updated.id ? updated : item));
        setStats(computeFleetStats(merged));
        return merged;
      });
    } catch (err) {
      reportError(err, toast);
    } finally {
      setBusyId(null);
    }
  }

  function reviewSlotPurchase(count: number) {
    if (!slotAccount) return;
    setPendingSlot({ account: slotAccount, count });
    setSlotAccount(null);
  }

  async function confirmSlotPurchase() {
    if (!pendingSlot) return;
    setSlotBusy(true);
    try {
      const { account } = await api.buySlots(pendingSlot.account.id, pendingSlot.count);
      toast.success(
        "Car slot bought",
        `${pendingSlot.count} slot${pendingSlot.count === 1 ? "" : "s"} added — garage now holds ${account.capacity} cars.`,
      );
      setPendingSlot(null);
      await load(true);
    } catch (err) {
      reportError(err, toast);
    } finally {
      setSlotBusy(false);
    }
  }

  async function handleArchive() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api.archive(deleting.id);
      toast.success(
        "Account archived",
        `${deleting.email} left the fleet — nothing was deleted, restore it from the Archived tab.`,
      );
      setDeleting(null);
      await load(true);
    } catch (err) {
      reportError(err, toast);
    } finally {
      setDeletingBusy(false);
    }
  }

  async function handleRestore(account: AccountSummary) {
    try {
      const { account: restored } = await api.restore(account.id);
      toast.success("Account restored", `${restored.email} is back in the fleet.`);
      await load(true);
    } catch (err) {
      reportError(err, toast);
    }
  }

  function performExport() {
    const format = exportFormat;
    setExportFormat(null);
    if (!format) return;

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.href = `/api/export?format=${format}&confirm=true`;
    link.download = `cpm2-fleet-${stamp}.${format}`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="relative min-h-screen">
      <div className="grid-overlay pointer-events-none absolute inset-0" />

      <header className="sticky top-0 z-30 border-b border-white/8 bg-carbon-950/80 backdrop-blur-xl">
        <div className="hazard-strip h-[3px] w-full opacity-90" />
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-amber-glow/30 bg-amber-glow/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-glow" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 13l1.5-4.5A2 2 0 017.4 7h9.2a2 2 0 011.9 1.5L20 13" strokeLinecap="round" />
                <path d="M3.5 13h17v4.5h-17z" strokeLinejoin="round" />
                <circle cx="7" cy="17.5" r="1.6" />
                <circle cx="17" cy="17.5" r="1.6" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-[15px] font-bold uppercase tracking-[0.24em] text-ash-100">
                CPM2 <span className="text-amber-glow">Fleet</span>
              </h1>
              <p className="font-display text-[9px] uppercase tracking-[0.34em] text-ash-600">
                Account console
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="panel-tight hidden items-center gap-2 rounded-lg px-3 py-2 sm:flex">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  offline ? "bg-red-glow" : loading ? "bg-amber-glow animate-blink" : "bg-mint-glow"
                }`}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash-500">
                {offline ? "db offline" : loading ? "syncing" : "sqlite · wal"}
              </span>
            </span>

            <button
              type="button"
              onClick={() => setExportFormat("csv")}
              className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 font-display text-[10px] uppercase tracking-[0.16em] text-ash-400 transition hover:border-amber-glow/40 hover:text-amber-glow"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => setExportFormat("json")}
              className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 font-display text-[10px] uppercase tracking-[0.16em] text-ash-400 transition hover:border-amber-glow/40 hover:text-amber-glow"
            >
              Backup
            </button>
            <Button variant="primary" size="sm" onClick={() => openForm(null)}>
              + Add account
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
        <StatTiles stats={stats} />

        <Toolbar
          query={query}
          onQuery={setQuery}
          filter={filter}
          onFilter={setFilter}
          tab={tab}
          onTab={setTab}
          onRefresh={() => void load(true)}
          archivedCount={archived.length}
          searchRef={searchRef}
        />

        {offline ? (
          <div className="mt-6 rounded-xl border border-red-glow/30 bg-red-glow/10 px-4 py-3 text-sm text-red-glow">
            {offline}
          </div>
        ) : null}

        <div className="mt-4">
          {tab === "log" ? (
            <ActivityFeed events={events} />
          ) : loading && accounts.length === 0 ? (
            <LoadingPanel />
          ) : visible.length === 0 ? (
            <EmptyState
              tab={tab}
              hasAccounts={accounts.length > 0}
              onAdd={() => openForm(null)}
            />
          ) : (
            <section className="panel animate-rise overflow-hidden rounded-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-2.5">
                <span className="label-caps">
                  {visible.length} of {tab === "archived" ? archived.length : accounts.length}{" "}
                  account{tab === "archived" ? archived.length === 1 ? "" : "s" : ""}
                </span>
                <span className="font-mono text-[10px] text-ash-600">
                  caps · {formatNumber(LIMITS.MAX_CASH)} cash · {formatNumber(LIMITS.MAX_COINS)} coins ·{" "}
                  {LIMITS.BASE_CAR_SLOTS}+{LIMITS.MAX_PURCHASED_SLOTS} cars
                </span>
              </div>
              <AccountTable
                accounts={visible}
                busyId={busyId}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                mode={tab === "archived" ? "archived" : "active"}
                onEdit={openForm}
                onBuySlot={openSlots}
                onDelete={(account) => setDeleting(account)}
                onRestore={handleRestore}
                onAdjust={handleAdjust}
              />
            </section>
          )}
        </div>
      </main>

      <footer className="relative mx-auto max-w-[1440px] px-4 pb-10 pt-2 sm:px-6">
        <p className="font-mono text-[10px] text-ash-600">
          {LIMITS.BASE_CAR_SLOTS} base car slots · {LIMITS.MAX_PURCHASED_SLOTS} extra slots max per account ·{" "}
          {LIMITS.SLOT_COST_COINS} coins per slot · passwords encrypted at rest with AES-256-GCM
        </p>
      </footer>

      <AccountFormModal
        key={`form-${formSession}`}
        open={formOpen}
        account={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={editing ? handleUpdate : handleCreate}
      />

      <SlotModal
        key={`slot-${slotSession}`}
        open={slotAccount !== null}
        account={slotAccount}
        onClose={() => setSlotAccount(null)}
        onReview={reviewSlotPurchase}
      />

      <SlotPurchaseConfirmModal
        open={pendingSlot !== null}
        account={pendingSlot?.account ?? null}
        count={pendingSlot?.count ?? 1}
        busy={slotBusy}
        onCancel={() => setPendingSlot(null)}
        onConfirm={() => void confirmSlotPurchase()}
      />

      <ExportConfirmModal
        open={exportFormat !== null}
        format={exportFormat}
        accountCount={accounts.length}
        onCancel={() => setExportFormat(null)}
        onConfirm={performExport}
      />

      <ConfirmModal
        open={deleting !== null}
        title="Archive account"
        message={
          deleting
            ? `Archive ${deleting.email}? Nothing is deleted — every balance, car and slot is kept and you can restore it from the Archived tab.`
            : ""
        }
        confirmLabel="Archive"
        busy={deletingBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleArchive()}
      />
    </div>
  );
}

function reportError(err: unknown, toast: ReturnType<typeof useToast>) {
  if (err instanceof ApiRequestError) {
    toast.error("Rejected", err.message);
    return;
  }
  toast.error("Something broke", err instanceof Error ? err.message : "Unexpected error.");
}

function LoadingPanel() {
  return (
    <div className="panel animate-fade overflow-hidden rounded-xl">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-white/5 px-4 py-4 last:border-0"
          style={{ animationDelay: `${index * 90}ms` }}
        >
          <div className="h-3 w-16 rounded bg-white/5" />
          <div className="h-3 w-56 rounded bg-white/5" />
          <div className="ml-auto h-3 w-24 rounded bg-white/5" />
          <div className="h-3 w-24 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  tab,
  hasAccounts,
  onAdd,
}: {
  tab: ConsoleTab;
  hasAccounts: boolean;
  onAdd: () => void;
}) {
  if (tab === "archived") {
    return (
      <div className="panel animate-rise rounded-xl px-6 py-16 text-center">
        <p className="font-display text-xs uppercase tracking-[0.25em] text-ash-500">
          Archive is empty
        </p>
        <p className="mt-2 text-sm text-ash-600">
          Archived accounts keep every balance and can be restored at any time.
        </p>
      </div>
    );
  }

  if (hasAccounts) {
    return (
      <div className="panel rounded-xl px-6 py-16 text-center">
        <p className="font-display text-xs uppercase tracking-[0.25em] text-ash-500">No match</p>
        <p className="mt-2 text-sm text-ash-600">
          Nothing in the fleet matches the current search or filter.
        </p>
      </div>
    );
  }

  return (
    <div className="panel animate-rise corner-ticks relative overflow-hidden rounded-xl px-6 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 grid-overlay" />
      <div className="relative">
        <p className="font-display text-3xl font-bold uppercase tracking-[0.3em] text-white/10">
          EMPTY GARAGE
        </p>
        <p className="mt-4 text-sm text-ash-400">
          No accounts tracked yet. Add the first one and the console starts logging every balance,
          coin, car and purchased slot.
        </p>
        <Button variant="primary" onClick={onAdd} className="mt-6">
          + Track your first account
        </Button>
        <p className="mt-4 font-mono text-[10px] text-ash-600">
          tip: press “N” anywhere to open the form
        </p>
      </div>
    </div>
  );
}
