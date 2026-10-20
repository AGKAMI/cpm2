"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LIMITS, carCapacity, formatNumber } from "@/lib/constants";
import type { AccountSummary } from "@/lib/types";

type ExportConfirmProps = {
  open: boolean;
  format: "csv" | "json" | null;
  accountCount: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Explicit gate before the plaintext credential export is allowed to run. */
export function ExportConfirmModal({
  open,
  format,
  accountCount,
  busy = false,
  onCancel,
  onConfirm,
}: ExportConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Export the whole fleet?"
      subtitle="This file contains every email and every decrypted password."
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy} type="button">
            {busy ? "Exporting…" : `Export ${(format ?? "csv").toUpperCase()}`}
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2 text-sm text-ash-300">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-glow" />
          {accountCount} account{accountCount === 1 ? "" : "s"} will be written to a download.
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-glow" />
          Passwords are decrypted and stored in plain text inside the file.
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-glow" />
          The export is recorded in the activity log.
        </li>
      </ul>
    </Modal>
  );
}

type SlotPurchaseConfirmProps = {
  open: boolean;
  account: AccountSummary | null;
  count: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Coin-spending confirmation — every slot purchase passes through here. */
export function SlotPurchaseConfirmModal({
  open,
  account,
  count,
  busy = false,
  onCancel,
  onConfirm,
}: SlotPurchaseConfirmProps) {
  if (!account) return null;

  const cost = count * LIMITS.SLOT_COST_COINS;
  const newSlots = account.slots + count;
  const newCapacity = carCapacity(newSlots);
  const balanceAfter = account.coins - cost;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Confirm slot purchase"
      subtitle="Coins are deducted from the account balance the moment you confirm."
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy} type="button">
            {busy
              ? "Buying…"
              : `Buy ${count} slot${count === 1 ? "" : "s"} · ${formatNumber(cost)} coins`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="num text-sm text-ash-200">{account.email}</p>

        <dl className="panel-tight grid grid-cols-2 gap-3 rounded-xl px-4 py-3">
          <Row label="Slots" value={`${account.slots} → ${newSlots}`} tone="text-amber-glow" />
          <Row label="Cost" value={`${formatNumber(cost)} coins`} tone="text-amber-glow" />
          <Row label="Balance after" value={formatNumber(balanceAfter)} tone="text-amber-glow" />
          <Row label="Garage size" value={`${account.cars}/${newCapacity}`} tone="text-cyan-glow" />
        </dl>

        {balanceAfter < 0 ? (
          <p className="rounded-lg border border-red-glow/30 bg-red-glow/10 px-3 py-2 text-xs text-red-glow">
            This account only has {formatNumber(account.coins)} coins — not enough for {count} slot(s).
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className={`num mt-1 text-sm ${tone}`}>{value}</dd>
    </div>
  );
}
