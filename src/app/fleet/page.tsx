"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFleet } from "@/components/FleetProvider";
import { useShell } from "@/components/AppShell";
import { AccountTable, type SortKey } from "@/components/AccountTable";
import { FleetToolbar, type FleetFilter } from "@/components/Toolbar";
import { Button } from "@/components/ui/Button";

function matchesFilter(account: {
  cash: number;
  coins: number;
  cars: number;
  capacity: number;
  slots: number;
}, filter: FleetFilter): boolean {
  switch (filter) {
    case "full":
      return account.cars >= account.capacity;
    case "slots":
      return account.slots > 0;
    case "cash-cap":
      return account.cash >= 50_000_000;
    case "coin-cap":
      return account.coins >= 30_000;
    default:
      return true;
  }
}

function FleetPageInner() {
  const fleet = useFleet();
  const shell = useShell();
  const router = useRouter();
  const params = useSearchParams();

  const query = params.get("q") ?? "";
  const filter = (params.get("filter") as FleetFilter) ?? "all";
  const sortKey = (params.get("sort") as SortKey) ?? "updated";
  const sortDir = params.get("dir") === "asc" ? "asc" : "desc";
  const showArchived = params.get("view") === "archived";
  const [selected, setSelected] = useState<number[]>([]);

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const queryString = next.toString();
      router.replace(queryString ? `/fleet?${queryString}` : "/fleet", { scroll: false });
    },
    [params, router],
  );

  const source = showArchived ? fleet.archived : fleet.accounts;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = source.filter((account) => {
      if (!matchesFilter(account, filter)) return false;
      if (!needle) return true;
      return (
        account.email.toLowerCase().includes(needle) ||
        account.notes.toLowerCase().includes(needle)
      );
    });

    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
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
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
        default:
          return 0;
      }
    });
  }, [source, query, filter, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      patchParams({ dir: sortDir === "asc" ? "desc" : "asc" });
      return;
    }
    patchParams({ sort: key, dir: "desc" });
  }

  async function archiveSelected() {
    const ids = selected.slice();
    for (const id of ids) {
      const account = source.find((item) => item.id === id);
      if (account) await fleet.archiveAccount(account);
    }
    setSelected([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <FleetToolbar
        query={query}
        onQuery={(value) => patchParams({ q: value })}
        filter={filter}
        onFilter={(value) => patchParams({ filter: value === "all" ? null : value })}
        archivedCount={fleet.archived.length}
        showArchived={showArchived}
        onShowArchived={(value) => {
          patchParams({ view: value ? "archived" : null });
          setSelected([]);
        }}
        onRefresh={() => void fleet.refresh()}
      />

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border border-racing/30 bg-racing/5 px-4 py-2.5">
          <span className="num text-[11px] text-racing">{selected.length} selected</span>
          <Button variant="danger" size="sm" onClick={() => void archiveSelected()}>
            Archive selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      ) : null}

      {fleet.error ? (
        <div className="rounded-[8px] border border-oxblood/35 bg-oxblood/8 px-4 py-3 text-sm text-oxblood">
          {fleet.error}
        </div>
      ) : null}

      <section className="panel animate-rise overflow-hidden rounded-[14px]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/12 bg-paper-sunken px-4 py-2.5">
          <span className="label-caps">
            {visible.length} of {source.length} account{source.length === 1 ? "" : "s"}
            {showArchived ? " (archived)" : ""}
          </span>
          <span className="num text-[10px] text-ink-faint">click an account plate to open its page</span>
        </div>

        {fleet.loading && source.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-ink-faint">Loading the register…</div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              {source.length === 0 ? (showArchived ? "Archive is empty" : "No accounts yet") : "No match"}
            </p>
            <p className="mt-2 text-sm text-ink-faint">
              {source.length === 0
                ? showArchived
                  ? "Archived accounts keep every balance and can be restored at any time."
                  : "Add your first account with the button up top."
                : "Nothing matches this search or filter."}
            </p>
            {source.length === 0 && !showArchived ? (
              <p className="num mt-3 text-[10px] text-ink-faint">
                use “+ Add account” in the header to log the first one
              </p>
            ) : null}
          </div>
        ) : (
          <AccountTable
            accounts={visible}
            busyId={null}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            mode={showArchived ? "archived" : "active"}
            selectable={!showArchived}
            selectedIds={selected}
            onToggleSelect={(id) =>
              setSelected((current) =>
                current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
              )
            }
            onToggleAll={() =>
              setSelected((current) =>
                current.length === visible.length ? [] : visible.map((item) => item.id),
              )
            }
            onEdit={shell.openEditAccount}
            onBuySlot={shell.openSlotPurchase}
            onDelete={(account) => {
              void shell
                .confirm({
                  title: "Archive this account?",
                  message: `${account.email} is filed away with every balance intact. You can restore it from the archived view at any time.`,
                  confirmLabel: "Archive",
                })
                .then((ok) => {
                  if (ok) void fleet.archiveAccount(account);
                });
            }}
            onRestore={(account) => void fleet.restoreAccount(account)}
            onAdjust={(account, field, delta) => void fleet.adjust(account, field, delta)}
          />
        )}
      </section>
    </div>
  );
}

export default function FleetPage() {
  return (
    <Suspense fallback={<div className="px-1 py-10 text-sm text-ink-faint">Loading the register…</div>}>
      <FleetPageInner />
    </Suspense>
  );
}
