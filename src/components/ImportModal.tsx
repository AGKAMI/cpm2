"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LIMITS } from "@/lib/constants";
import type { ImportReport } from "@/lib/types";

type ImportModalProps = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onImport: (csv: string) => Promise<ImportReport>;
};

function reportLines(report: ImportReport): string[] {
  const lines: string[] = [];
  if (report.created) lines.push(`${report.created} account${report.created === 1 ? "" : "s"} added`);
  if (report.skipped) lines.push(`${report.skipped} skipped (already tracked)`);
  if (report.failed) lines.push(`${report.failed} failed validation`);
  return lines;
}

/** Paste-a-CSV import: restore a fleet from an exported backup in one shot. */
export function ImportModal({ open, busy, onClose, onImport }: ImportModalProps) {
  const [csv, setCsv] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCsv("");
    setReport(null);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function run() {
    setError(null);
    try {
      const result = await onImport(csv);
      setReport(result);
      setCsv("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  const rowCount = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("@")).length;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import accounts"
      subtitle="Paste the fleet CSV export (or any CSV with email, password, cash, coins, cars, slots, notes columns)."
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={close} type="button">
            {report ? "Done" : "Cancel"}
          </Button>
          <Button
            variant="primary"
            onClick={run}
            disabled={busy || rowCount === 0}
            type="button"
          >
            {busy ? "Importing…" : `Import ${rowCount || ""} row${rowCount === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {report ? (
          <div className="flex flex-col gap-2">
            <p className="label-caps">Import complete</p>
            <ul className="flex flex-col gap-1.5 text-sm text-ash-200">
              {reportLines(report).map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint-glow" />
                  {line}
                </li>
              ))}
            </ul>
            {report.results.some((row) => row.status !== "created") ? (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-white/8 bg-carbon-950/40 p-2">
                {report.results
                  .filter((row) => row.status !== "created")
                  .map((row) => (
                    <p key={`${row.row}-${row.email}`} className="truncate text-[11px] text-ash-500">
                      row {row.row} · {row.email ?? "?"} · {row.status}
                      {row.message && row.status === "failed" ? ` — ${row.message}` : ""}
                    </p>
                  ))}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <textarea
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              spellCheck={false}
              placeholder={`email,password,cash,coins,cars,slots,notes\naccount@mail.com,secret123,50000,2000,4,1,main`}
              className="h-44 w-full resize-none rounded-xl border border-white/10 bg-carbon-950/60 p-3 font-mono text-[12px] text-ash-200 outline-none transition placeholder:text-ash-600 focus:border-amber-glow/50"
            />
            <p className="text-[11px] text-ash-500">
              Duplicates are skipped, bad rows are reported — nothing is half-imported. Hard caps
              ({LIMITS.MAX_CASH.toLocaleString("en-US")} cash · {LIMITS.MAX_COINS.toLocaleString("en-US")} coins ·
              {" "}{LIMITS.BASE_CAR_SLOTS}+{LIMITS.MAX_PURCHASED_SLOTS} slots) are enforced per row.
            </p>
            {error ? (
              <p className="rounded-lg border border-red-glow/30 bg-red-glow/10 px-3 py-2 text-xs text-red-glow">
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
