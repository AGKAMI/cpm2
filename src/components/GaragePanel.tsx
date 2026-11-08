"use client";

import { useEffect, useState } from "react";
import { useShell } from "@/components/AppShell";
import { CapacityGauge } from "@/components/CapacityGauge";
import { CarPickerModal } from "@/components/CarPickerModal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toaster";
import { api, ApiRequestError } from "@/lib/client";
import type { AccountSummary, CarRecord, GarageSummary } from "@/lib/types";

type GaragePanelProps = {
  account: AccountSummary;
  readOnly?: boolean;
  onChanged?: () => void;
};

export function GaragePanel({ account, readOnly = false, onChanged }: GaragePanelProps) {
  const shell = useShell();
  const toast = useToast();
  const [garage, setGarage] = useState<GarageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .garage(account.id)
      .then((result) => {
        if (cancelled) return;
        setGarage(result.garage);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err.message : "Could not load the garage.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account.id, reloadKey]);

  async function remove(car: CarRecord) {
    const ok = await shell.confirm({
      title: "Remove this car?",
      message: `#${car.carCode} ${car.carName} leaves ${account.email}'s garage. The rest of the ledger is untouched.`,
      confirmLabel: "Remove",
    });
    if (!ok) return;

    setRemovingId(car.id);
    try {
      const result = await api.removeCar(account.id, car.id);
      setGarage(result.garage);
      toast.success("Car removed", `#${car.carCode} ${result.carName} left the garage.`);
      onChanged?.();
    } catch (err) {
      toast.error(
        "Could not remove the car",
        err instanceof ApiRequestError ? err.message : "Unexpected error.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="panel rounded-[20px] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">Garage inventory</h2>
          <p className="num mt-1 text-[10px] text-ink-faint">
            {account.game === "cpm1"
              ? "catalog cars logged to this account · one of each model"
              : "catalog cars logged to this account · separate from the cars count"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {garage ? (
            <CapacityGauge
              cars={garage.count}
              capacity={garage.capacity}
              baseSlots={account.baseSlots}
              game={account.game}
              compact
            />
          ) : null}
          {!readOnly ? (
            <Button
              variant="primary"
              size="sm"
              type="button"
              disabled={garage === null}
              onClick={() => setPickerOpen(true)}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Add car
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="num py-6 text-center text-[11px] text-ink-faint">Loading garage…</p>
      ) : error ? (
        <div className="flex flex-col items-start gap-3 py-4">
          <p className="text-[12px] text-oxblood">{error}</p>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              setLoading(true);
              setReloadKey((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : garage && garage.cars.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-ink px-4 py-8 text-center">
          <p className="text-[13px] text-ink">No cars logged</p>
          <p className="mt-1 text-[12px] text-ink-faint">
            Search the catalog to add your first.
          </p>
        </div>
      ) : garage ? (
        <ul className="flex flex-col">
          {garage.cars.map((car) => (
            <li
              key={car.id}
              className="flex items-start gap-3 border-t border-ink py-2.5 first:border-0 first:pt-0"
            >
              <span className="num w-11 shrink-0 pt-0.5 text-[12px] text-ink-faint">
                #{car.carCode}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-ink">{car.carName}</p>
                {car.notes ? (
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">{car.notes}</p>
                ) : null}
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => void remove(car)}
                  disabled={removingId !== null}
                  aria-label={`Remove #${car.carCode} ${car.carName} from the garage`}
                  className="square-btn mt-0.5 h-7 w-7 shrink-0 hover:border-racing hover:bg-racing hover:text-primary-foreground"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12M10 11v5M14 11v5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {garage && pickerOpen ? (
        <CarPickerModal
          open
          accountId={account.id}
          accountEmail={account.email}
          garage={garage}
          onClose={() => setPickerOpen(false)}
          onGarage={(next) => {
            setGarage(next);
            onChanged?.();
          }}
        />
      ) : null}
    </section>
  );
}
