"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiRequestError } from "@/lib/client";
import type { AccountSummary, FleetEvent, FleetStats, ImportReport } from "@/lib/types";
import { useToast } from "@/components/ui/Toaster";

type AdjustField = "cash" | "coins" | "cars";

type FleetContextValue = {
  accounts: AccountSummary[];
  archived: AccountSummary[];
  stats: FleetStats | null;
  events: FleetEvent[];
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [active, archivedList, eventList] = await Promise.all([
        api.list(),
        api.list({ archived: true }),
        api.events(),
      ]);
      setAccounts(active.accounts);
      setStats(active.stats);
      setArchived(archivedList.accounts);
      setEvents(eventList.events);
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
        await api.update(account.id, { [field]: next });
        await refresh(true);
      } catch (err) {
        patchLocal(account.id, { [field]: account[field] } as Partial<AccountSummary>);
        toast.error("Rejected", describe(err));
      }
    },
    [patchLocal, refresh, toast],
  );

  const createAccount = useCallback(
    async (payload: unknown) => {
      try {
        const { account } = await api.create(payload);
        await refresh(true);
        toast.success("Account added", `${account.email} is on the books.`);
        return account;
      } catch (err) {
        toast.error("Could not add account", describe(err));
        return null;
      }
    },
    [refresh, toast],
  );

  const updateAccount = useCallback(
    async (id: number, payload: unknown) => {
      try {
        await api.update(id, payload);
        await refresh(true);
        toast.success("Saved", "Changes are written to the ledger.");
      } catch (err) {
        toast.error("Could not save", describe(err));
      }
    },
    [refresh, toast],
  );

  const archiveAccount = useCallback(
    async (account: AccountSummary) => {
      try {
        await api.archive(account.id);
        await refresh(true);
        toast.success("Archived", `${account.email} is filed away — balances kept.`, {
          label: "Undo",
          onClick: () => {
            void api
              .restore(account.id)
              .then(() => refresh(true))
              .catch((err: unknown) => toast.error("Could not restore", describe(err)));
          },
        });
      } catch (err) {
        toast.error("Could not archive", describe(err));
      }
    },
    [refresh, toast],
  );

  const restoreAccount = useCallback(
    async (account: AccountSummary) => {
      try {
        await api.restore(account.id);
        await refresh(true);
        toast.success("Restored", `${account.email} is back in the fleet.`);
      } catch (err) {
        toast.error("Could not restore", describe(err));
      }
    },
    [refresh, toast],
  );

  const buySlots = useCallback(
    async (account: AccountSummary, count: number) => {
      try {
        await api.buySlots(account.id, count);
        await refresh(true);
        toast.success("Slot purchased", `${count} slot${count === 1 ? "" : "s"} added to ${account.email}.`);
      } catch (err) {
        toast.error("Purchase rejected", describe(err));
      }
    },
    [refresh, toast],
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
