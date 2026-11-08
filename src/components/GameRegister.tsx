"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFleet } from "@/components/FleetProvider";
import { useShell } from "@/components/AppShell";
import { AccountTable, type SortKey } from "@/components/AccountTable";
import { FleetToolbar, type FleetFilter } from "@/components/Toolbar";
import { CarFilterModal } from "@/components/CarFilterModal";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client";
import { carByCode } from "@/lib/car-catalog";
import { GAME_LABELS, formatNumber, type GameType } from "@/lib/constants";
import type { CarOwners } from "@/lib/types";

function matchesFilter(
  account: { cash: number; coins: number; cars: number; capacity: number; slots: number },
  filter: FleetFilter,
): boolean {
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

/**
 * One game's register — accounts, balances and garage capacity, for CPM1 or
 * CPM2 alone.
 *
 * The game is a prop rather than a state toggle on purpose. Each game is its
 * own page (`/fleet/cpm1`, `/fleet/cpm2`) so the URL, the back button and the
 * nav all keep the two games apart; a client-side tab would let the two
 * catalogs blur together the moment a link is shared or reloaded.
 */
export function GameRegister({ game }: { game: GameType }) {
  const fleet = useFleet();
  const shell = useShell();
  const router = useRouter();
  const params = useSearchParams();

  const [selected, setSelected] = useState<number[]>([]);
  const [carPickerOpen, setCarPickerOpen] = useState(false);

  const query = params.get("q") ?? "";
  const filter = (params.get("filter") as FleetFilter) ?? "all";
  const sortKey = (params.get("sort") as SortKey) ?? "updated";
  const sortDir = params.get("dir") === "asc" ? "asc" : "desc";
  const showArchived = params.get("view") === "archived";
  // `car` is a deep-linkable car filter: ?car=49 shows who owns code #49.
  const carParam = params.get("car");

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const queryString = next.toString();
      router.replace(queryString ? `/fleet/${game}?${queryString}` : `/fleet/${game}`, {
        scroll: false,
      });
    },
    [params, router, game],
  );

  const source = showArchived ? fleet.archived : fleet.accounts;

  // The car filter follows the URL so a shared link reproduces the view.
  //
  // State holds ONLY the server answer, keyed by the param that produced it.
  // Everything else — an unparsable code, a code this game does not have, and
  // the "no filter" case — is derived from the URL at render time instead of
  // being written into state, so nothing here needs a setState-in-effect.
  const [loaded, setLoaded] = useState<{
    param: string;
    result: CarOwners | null;
    error: string | null;
  } | null>(null);

  const carParamCode = carParam === null ? null : Number(carParam);
  const carValid =
    carParam === null ||
    (carParamCode !== null &&
      Number.isInteger(carParamCode) &&
      carByCode(carParamCode, game) !== undefined);

  useEffect(() => {
    if (carParam === null || carParamCode === null || !carValid) return;
    const code: number = carParamCode;
    const param: string = carParam;
    let cancelled = false;
    api
      .carOwners(game, code)
      .then((result) => {
        if (!cancelled) {
          setLoaded({ param, result: result.owners, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoaded({
            param,
            result: null,
            error: err instanceof Error ? err.message : "Could not look up that car.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [carParam, carValid, carParamCode, game]);

  /** A cached answer applies only while the URL still names the same car. */
  const carFilter = loaded?.param === carParam ? loaded.result : null;

  const carError =
    carParam === null
      ? null
      : carValid
        ? (loaded?.param === carParam ? loaded.error : null)
        : `No ${GAME_LABELS[game]} car has code #${carParam}.`;

  const ownerIds = useMemo(
    () => new Set(carFilter?.owners.map((owner) => owner.accountId) ?? []),
    [carFilter],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = source.filter((account) => {
      // A car filter is a hard scope: only this game's accounts that actually
      // hold the car pass. Everything else (search, filter chips, sort) then
      // narrows within that set. When the filter is LIVE but nobody owns the
      // car, ownerIds is empty and every account is filtered OUT — showing
      // everyone would silently cancel the filter the user just picked.
      if (account.game !== game) return false;
      if (carFilter && !ownerIds.has(account.id)) return false;
      if (!matchesFilter(account, filter)) return false;
      if (!needle) return true;
      return (
        account.email.toLowerCase().includes(needle) || account.notes.toLowerCase().includes(needle)
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
  }, [source, query, filter, sortKey, sortDir, game, ownerIds, carFilter]);

  const cars = visible.reduce((sum, account) => sum + account.cars, 0);
  const capacity = visible.reduce((sum, account) => sum + account.capacity, 0);
  const slots = visible.reduce((sum, account) => sum + account.slots, 0);

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

  const label = GAME_LABELS[game];

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        folio={game === "cpm1" ? "01" : "02"}
        title={showArchived ? `${label} archive` : `${label} register`}
        meta={`${source.length} ${label} account${source.length === 1 ? "" : "s"}${
          showArchived ? " · restore any time" : ""
        }`}
      />

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

      {/* The car filter is the one control that does not come back to this
          page's own state: it is a question about the garage table, so it
          lives beside the toolbar rather than inside the register's own
          search/filter set. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCarPickerOpen(true)}
          aria-label={`Filter ${label} accounts by car`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M4 13l1.5-4.5A2 2 0 017.4 7h9.2a2 2 0 011.9 1.5L20 13" strokeLinecap="round" />
            <path d="M3.5 13h17v4.5h-17z" strokeLinejoin="round" />
            <circle cx="7" cy="17.5" r="1.6" />
            <circle cx="17" cy="17.5" r="1.6" />
          </svg>
          Filter by car
        </Button>
        {carFilter ? (
          <span className="flex flex-wrap items-center gap-2 rounded-full border border-racing bg-racing px-3 py-1.5">
            <span className="num text-[11px] text-racing">
              #{carFilter.carCode} {carFilter.carName}
            </span>
            <span className="num text-[10px] text-ink-faint">
              {carFilter.owners.length} account{carFilter.owners.length === 1 ? "" : "s"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => patchParams({ car: null })}>
              clear ✕
            </Button>
          </span>
        ) : null}
        {carError ? (
          <span className="num text-[11px] text-oxblood">{carError}</span>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-racing bg-racing px-4 py-2.5">
          <span className="num text-[11px] text-racing">{selected.length} selected</span>
          <Button variant="destructive" size="sm" onClick={() => void archiveSelected()}>
            Archive selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      ) : null}

      {fleet.error ? (
        <p className="rounded-[14px] border border-oxblood bg-oxblood px-3 py-2 text-xs text-oxblood">
          {fleet.error}
        </p>
      ) : null}

      {fleet.loading && source.length === 0 ? (
        <section className="panel animate-rise rounded-[20px]">
          <div className="px-4 py-10 text-center text-sm text-ink-faint">Loading the register…</div>
        </section>
      ) : visible.length === 0 ? (
        <section className="panel animate-rise rounded-[20px]">
          <div className="px-4 py-10 text-center">
            <p className="font-sans text-[13px] font-semibold tracking-[-0.01em] text-ink">
              {source.length === 0
                ? showArchived
                  ? `${label} archive is empty`
                  : `No ${label} accounts yet`
                : carFilter
                  ? `No ${label} account holds #${carFilter.carCode} ${carFilter.carName}`
                  : "No match"}
            </p>
            <p className="mt-2 text-sm text-ink-faint">
              {source.length === 0
                ? showArchived
                  ? "Archived accounts keep every balance and can be restored at any time."
                  : `Add your first ${label} account with the button up top - set its game to ${label} in the form.`
                : carFilter
                  ? "Pick a different car, or clear the filter to see every account again."
                  : "Nothing matches this search or filter."}
            </p>
          </div>
        </section>
      ) : (
        <section className="panel animate-rise overflow-hidden rounded-[20px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border bg-background px-4 py-2.5">
            <span className="flex items-baseline gap-2.5">
              <span className="panel-title">{label}</span>
              <span className="num text-[10px] text-ink-faint">
                {visible.length} of {source.length} account{source.length === 1 ? "" : "s"}
                {showArchived ? " (archived)" : ""}
              </span>
            </span>
            <span className="num text-[10px] text-ink-faint">
              {formatNumber(cars)}/{formatNumber(capacity)} cars
              {slots > 0 ? ` · ${slots} coin slot${slots === 1 ? "" : "s"}` : ""}
              {carFilter ? ` · holding #${carFilter.carCode}` : ""}
            </span>
          </div>

          <AccountTable
            accounts={visible}
            busyId={null}
            trophies={fleet.trophies}
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
        </section>
      )}

      {carPickerOpen ? (
        <CarFilterModal
          open
          game={game}
          onClose={() => setCarPickerOpen(false)}
          onSelect={(code) => patchParams({ car: String(code) })}
        />
      ) : null}
    </div>
  );
}

export function GameRegisterPage({ game }: { game: GameType }) {
  return (
    <Suspense
      fallback={
        <div className="px-1 py-10 text-sm text-ink-faint">Loading the {GAME_LABELS[game]} register…</div>
      }
    >
      <GameRegister game={game} />
    </Suspense>
  );
}
