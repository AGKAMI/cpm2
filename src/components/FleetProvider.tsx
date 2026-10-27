"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiRequestError } from "@/lib/client";
import { computeFleetStats } from "@/lib/stats";
import type { AccountSummary, FleetEvent, FleetStats, ImportReport, TrophySummary } from "@/lib/types";
import { useToast } from "@/components/ui/Toaster";

type AdjustField = "cash" | "coins" | "cars";

type TrophyTotals = { gold: number; silver: number; bronze: number; total: number };

type FleetContextValue = {
  accounts: AccountSummary[];
  archived: AccountSummary[];
  stats: FleetStats | null;
  events: FleetEvent[];
  trophies: Record<number, TrophySummary>;
  trophyTotals: TrophyTotals;
  loading: boolean;
  error: string | null;
  refresh: (silent?: boolean) => Promise<void>;
  adjust: (account: AccountSummary, field: AdjustField, delta: number) => Promise<void>;
  createAccount: (payload: unknown) => Promise<AccountSummary | null>;
  updateAccount: (id: number, payload: unknown) => Promise<void>;
  archiveAccount: (account: AccountSummary) => Promise<void>;
  restoreAccount: (account: AccountSummary) => Promise<void>;
  buySlots: (account: AccountSummary, count: number) => Promise<void>;
  importCsv: (csv: string) => Promise<ImportReport>;
};

const FleetContext = createContext<FleetContextValue | null>(null);

function describe(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Unexpected error.";
}

export function FleetProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [archived, setArchived] = useState<AccountSummary[]>([]);
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [events, setEvents] = useState<FleetEvent[]>([]);
  const [trophies, setTrophies] = useState<Record<number, TrophySummary>>({});
  const [trophyTotals, setTrophyTotals] = useState<TrophyTotals>({
    gold: 0,
    silver: 0,
    bronze: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const syncTimer = useRef<number | null>(null);
  // Mirror of the active list, so stats can be recomputed synchronously after
  // a local patch without waiting for the server.
  const accountsRef = useRef<AccountSummary[]>([]);
  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [active, archivedList, eventList, trophyList] = await Promise.all([
        api.list(),
        api.list({ archived: true }),
        api.events(),
        api.fleetTrophies(),
      ]);
      setAccounts(active.accounts);
      setStats(active.stats);
      setArchived(archivedList.accounts);
      setEvents(eventList.events);
      setTrophies(
        Object.fromEntries(trophyList.accounts.map((summary) => [summary.accountId, summary])),
      );
      setTrophyTotals(trophyList.totals);
      setError(null);
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred so the first paint is not blocked by a synchronous state write.
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(
    () => () => {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    },
    [],
  );

  /**
   * One quiet full sync, debounced. Mutations apply their server response
   * locally INSTANTLY (the phone feels immediate even over the tailnet) and
   * the audit log / trophy totals catch up in a single burst — a burst of
   * taps costs ONE round trip instead of four requests per tap.
   */
  const scheduleSync = useCallback(() => {
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      syncTimer.current = null;
      void refresh(true);
    }, 1200);
  }, [refresh]);

  /** Applies one server-confirmed account into whichever list holds it. */
  const applyAccount = useCallback((next: AccountSummary) => {
    let placed = false;
    setAccounts((current) =>
      current.map((account) => {
        if (account.id !== next.id) return account;
        placed = true;
        return next;
      }),
    );
    setArchived((current) =>
      current.map((account) => {
        if (account.id !== next.id) return account;
        placed = true;
        return next;
      }),
    );
    return placed;
  }, []);

  /** Optimistic local patch so steppers feel instant. */
  const patchLocal = useCallback((id: number, patch: Partial<AccountSummary>) => {
    setAccounts((current) =>
      current.map((account) =>
        account.id === id ? { ...account, ...patch, updatedAt: new Date().toISOString() } : account,
      ),
    );
  }, []);

  const adjust = useCallback(
    async (account: AccountSummary, field: AdjustField, delta: number) => {
      const next = Math.max(0, account[field] + delta);
      patchLocal(account.id, { [field]: next } as Partial<AccountSummary>);
      try {
        const { account: saved } = await api.update(account.id, { [field]: next });
        applyAccount(saved);
        // Stats recompute locally — zero round trips for the header tiles.
        setStats(
          computeFleetStats(
            accountsRef.current.map((item) => (item.id === saved.id ? saved : item)),
          ),
        );
        scheduleSync();
      } catch (err) {
        patchLocal(account.id, { [field]: account[field] } as Partial<AccountSummary>);
        toast.error("Rejected", describe(err));
      }
    },
    [applyAccount, patchLocal, scheduleSync, toast],
  );

  const createAccount = useCallback(
    async (payload: unknown) => {
      try {
        const { account } = await api.create(payload);
        setAccounts((current) => [account, ...current]);
        setStats((current) =>
          current ? { ...current, accounts: current.accounts + 1 } : current,
        );
        scheduleSync();
        toast.success("Account added", `${account.email} is on the books.`);
        return account;
      } catch (err) {
        toast.error("Could not add account", describe(err));
        return null;
      }
    },
    [scheduleSync, toast],
  );

  const updateAccount = useCallback(
    async (id: number, payload: unknown) => {
      try {
        const { account } = await api.update(id, payload);
        if (!applyAccount(account)) setAccounts((current) => [account, ...current]);
        scheduleSync();
        toast.success("Saved", "Changes are written to the ledger.");
      } catch (err) {
        toast.error("Could not save", describe(err));
      }
    },
    [applyAccount, scheduleSync, toast],
  );

  const archiveAccount = useCallback(
    async (account: AccountSummary) => {
      try {
        await api.archive(account.id);
        setAccounts((current) => current.filter((item) => item.id !== account.id));
        setArchived((current) => [account, ...current]);
        setStats(computeFleetStats(accountsRef.current.filter((item) => item.id !== account.id)));
        scheduleSync();
        toast.success("Archived", `${account.email} is filed away — balances kept.`, {
          label: "Undo",
          onClick: () => {
            void api
              .restore(account.id)
              .then(({ account: restored }) => {
                setArchived((current) => current.filter((item) => item.id !== restored.id));
                setAccounts((current) => [restored, ...current]);
                setStats(
                  computeFleetStats([restored, ...accountsRef.current]),
                );
                scheduleSync();
              })
              .catch((err: unknown) => toast.error("Could not restore", describe(err)));
          },
        });
      } catch (err) {
        toast.error("Could not archive", describe(err));
      }
    },
    [scheduleSync, toast],
  );

  const restoreAccount = useCallback(
    async (account: AccountSummary) => {
      try {
        const { account: restored } = await api.restore(account.id);
        setArchived((current) => current.filter((item) => item.id !== restored.id));
        setAccounts((current) => [restored, ...current]);
        scheduleSync();
        toast.success("Restored", `${restored.email} is back in the fleet.`);
      } catch (err) {
        toast.error("Could not restore", describe(err));
      }
    },
    [scheduleSync, toast],
  );

  const buySlots = useCallback(
    async (account: AccountSummary, count: number) => {
      try {
        const { account: saved } = await api.buySlots(account.id, count);
        applyAccount(saved);
        scheduleSync();
        toast.success("Slot purchased", `${count} slot${count === 1 ? "" : "s"} added to ${saved.email}.`);
      } catch (err) {
        toast.error("Purchase rejected", describe(err));
      }
    },
    [applyAccount, scheduleSync, toast],
  );

  const importCsv = useCallback(
    async (csv: string) => {
      try {
        const { import: report } = await api.importCsv(csv);
        await refresh(true);
        toast.success(
          "Import finished",
          `${report.created} added · ${report.skipped} skipped · ${report.failed} failed`,
        );
        return report;
      } catch (err) {
        toast.error("Import failed", describe(err));
        throw err;
      }
    },
    [refresh, toast],
  );

  const value = useMemo<FleetContextValue>(
    () => ({
      accounts,
      archived,
      stats,
      events,
      trophies,
      trophyTotals,
      loading,
      error,
      refresh,
      adjust,
      createAccount,
      updateAccount,
      archiveAccount,
      restoreAccount,
      buySlots,
      importCsv,
    }),
    [
      accounts,
      archived,
      stats,
      events,
      trophies,
      trophyTotals,
      loading,
      error,
      refresh,
      adjust,
      createAccount,
      updateAccount,
      archiveAccount,
      restoreAccount,
      buySlots,
      importCsv,
    ],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet(): FleetContextValue {
  const context = useContext(FleetContext);
  if (!context) {
    throw new Error("useFleet must be used inside <FleetProvider>");
  }
  return context;
}
