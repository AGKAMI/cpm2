"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { GARAGE_RULES, LIMITS, formatNumber } from "@/lib/constants";
import { garageCapacity } from "@/lib/garage";
import type { AccountSummary } from "@/lib/types";

type SlotModalProps = {
  open: boolean;
  account: AccountSummary | null;
  onClose: () => void;
  onReview: (count: number) => void;
};

/**
 * The CPM2 coin slot: one slot — the 21st — for 100 coins.
 *
 * CPM1 has no slots at all, so the modal refuses to open for a CPM1 account.
 * The 15 extra slots are NOT sold here: they come with the purchasable second
 * garage (R299.99), which is toggled in the account form.
 */
export function SlotModal({ open, account, onClose, onReview }: SlotModalProps) {
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);

  if (!account) return null;
  if (!GARAGE_RULES[account.game].hasSlots) return null;

  const slotsLeft = Math.max(0, LIMITS.MAX_COIN_SLOTS - account.slots);
  const affordable = Math.floor(account.coins / LIMITS.SLOT_COST_COINS);
  const max = Math.max(0, Math.min(slotsLeft, affordable));
  const cost = count * LIMITS.SLOT_COST_COINS;
  const newCapacity = garageCapacity(account.game, {
    baseSlots: account.baseSlots,
    slots: account.slots + count,
    newGarage: account.newGarage,
  });

  const blocker =
    slotsLeft === 0
      ? `This account already owns the coin slot — the 21st is unlocked.`
      : affordable === 0
        ? `Needs ${LIMITS.SLOT_COST_COINS} coins — this account has ${formatNumber(account.coins)}.`
        : "";

  async function confirm() {
    setBusy(true);
    try {
      onReview(count);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Unlock the 21st slot"
      subtitle="The stock CPM2 garage holds 20 slots. The 21st is the one the game sells for coins."
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" onClick={confirm} disabled={busy || max === 0} type="button">
            {busy ? "Working…" : "Review purchase"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat
            label="Coin slots"
            value={`${account.slots}/${LIMITS.MAX_COIN_SLOTS}`}
            tone="text-racing"
          />
          <Stat label="Balance" value={formatNumber(account.coins)} tone="text-racing" />
          <Stat label="Garage" value={`${account.cars}/${account.capacity}`} tone="text-blueprint" />
        </div>

        <div className="panel-tight flex items-center justify-between gap-4 rounded-[16px] px-4 py-3">
          <div>
            <p className="label-caps">How many slots?</p>
            <p className="mt-1 text-[11px] text-ink-faint">
              {LIMITS.SLOT_COST_COINS} coins each · up to {max} affordable
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCount((value) => Math.max(1, value - 1))}
              disabled={count <= 1}
              aria-label="Fewer slots"
              className="square-btn h-9 w-9 text-[15px] text-ink"
            >
              −
            </button>
            <span className="num w-10 text-center text-xl font-bold text-ink">{count}</span>
            <button
              type="button"
              onClick={() => setCount((value) => Math.min(max, value + 1))}
              disabled={count >= max}
              aria-label="More slots"
              className="square-btn h-9 w-9 text-[15px] text-ink"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-[14px] border border-ink bg-ink px-4 py-3">
          <span className="label-caps">New garage size</span>
          <span className="num text-sm text-racing">
            {account.cars}/{newCapacity} slots
          </span>
        </div>

        <div className="flex items-center justify-between rounded-[14px] border border-ink bg-ink px-4 py-3">
          <span className="label-caps">Total cost</span>
          <span className="num text-sm text-racing">{formatNumber(cost)} coins</span>
        </div>

        <p className="rounded-[14px] border border-brass bg-brass px-3 py-2 text-[11px] leading-snug text-ink-soft">
          The {LIMITS.NEW_GARAGE_PRICE} new garage is bought in the game, not with coins — it adds{" "}
          {LIMITS.NEW_GARAGE_SLOTS} slots at once. Tick it in the account form.
        </p>

        {blocker ? (
          <p className="rounded-[14px] border border-oxblood bg-oxblood px-3 py-2 text-xs text-oxblood">
            {blocker}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="panel-tight rounded-[14px] px-3 py-2.5">
      <p className="label-caps">{label}</p>
      <p className={`num mt-1 text-[15px] font-bold ${tone}`}>{value}</p>
    </div>
  );
}
