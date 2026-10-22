"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LIMITS, carCapacity, formatNumber } from "@/lib/constants";
import type { AccountSummary } from "@/lib/types";

type ExportConfirmProps = {
  open: boolean;
  accountCount: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (format: "csv" | "json") => void;
};

/** Explicit gate before the plaintext credential export is allowed to run. */
export function ExportConfirmModal({
  open,
  accountCount,
  busy = false,
  onCancel,
  onConfirm,
}: ExportConfirmProps) {
  const [picked, setPicked] = useState<"csv" | "json">("csv");

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
          <Button variant="primary" onClick={() => onConfirm(picked)} disabled={busy} type="button">
            {busy ? "Exporting…" : `Export ${picked.toUpperCase()}`}
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2 text-sm text-ink-soft">
        <li className="flex items-start gap-2">
          <span className="log-mark mt-1.5 bg-racing" />
          {accountCount} account{accountCount === 1 ? "" : "s"} will be written to a download.
        </li>
        <li className="flex items-start gap-2">
          <span className="log-mark mt-1.5 bg-oxblood" />
          Passwords are decrypted and stored in plain text inside the file.
        </li>
        <li className="flex items-start gap-2">
          <span className="log-mark mt-1.5 bg-blueprint" />
          The export is recorded in the activity log.
        </li>
      </ul>

      <div className="mt-5 border-t border-ink/10 pt-4">
        <span className="label-caps">File format</span>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setPicked("csv")}
            aria-pressed={picked === "csv"}
            className={`flex-1 cursor-pointer rounded-[14px] border px-3 py-2.5 text-left transition-colors ${
              picked === "csv"
                ? "border-racing/50 bg-racing/10"
                : "border-ink/10 bg-ink/[0.03] hover:border-ink/25"
            }`}
          >
            <span className="block font-sans text-[12px] font-semibold text-ink">
              CSV
            </span>
            <span className="num mt-0.5 block text-[10px] text-ink-faint">opens in any spreadsheet</span>
          </button>
          <button
            type="button"
            onClick={() => setPicked("json")}
            aria-pressed={picked === "json"}
            className={`flex-1 cursor-pointer rounded-[14px] border px-3 py-2.5 text-left transition-colors ${
              picked === "json"
                ? "border-racing/50 bg-racing/10"
                : "border-ink/10 bg-ink/[0.03] hover:border-ink/25"
            }`}
          >
            <span className="block font-sans text-[12px] font-semibold text-ink">
              JSON
            </span>
            <span className="num mt-0.5 block text-[10px] text-ink-faint">full backup, re-importable</span>
          </button>
        </div>
      </div>
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
        <p className="num text-sm text-ink">{account.email}</p>

        <dl className="panel-tight grid grid-cols-2 gap-3 rounded-[14px] px-4 py-3">
          <Row label="Slots" value={`${account.slots} → ${newSlots}`} tone="text-racing" />
          <Row label="Cost" value={`${formatNumber(cost)} coins`} tone="text-racing" />
          <Row label="Balance after" value={formatNumber(balanceAfter)} tone="text-racing" />
          <Row label="Garage size" value={`${account.cars}/${newCapacity}`} tone="text-blueprint" />
        </dl>

        {balanceAfter < 0 ? (
          <p className="rounded-[14px] border border-oxblood/35 bg-oxblood/8 px-3 py-2 text-xs text-oxblood">
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
