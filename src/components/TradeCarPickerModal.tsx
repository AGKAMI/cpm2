"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api, ApiRequestError } from "@/lib/client";
import { carsForGame, searchCars } from "@/lib/car-catalog";
import type { CarMatch, TradePrice } from "@/lib/types";

type Tab = "catalog" | "screenshot";

/** Short price text for the list rows — full labels live on the desk rows. */
function priceLabel(entry: TradePrice): string {
  if (entry.kind === "paid") return `R${entry.price.toLocaleString("en-US")}`;
  return `${entry.price.toLocaleString("en-US")} ${entry.kind === "coin" ? "coins" : "cash"}`;
}

/**
 * Car picker for the trade desk, two ways:
 * - Catalog — the same search the garage uses, scoped to CPM2.
 * - Screenshot — Gemini names the car from a game screenshot, we fuzzy-match
 *   that name against the catalog, and the user CONFIRMS the pick. Gemini
 *   misreads happen, so the match is never applied blindly.
 */
export function TradeCarPickerModal({
  open,
  onClose,
  onPick,
  prices,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (code: number) => void;
  prices: Map<number, TradePrice>;
}) {
  const [tab, setTab] = useState<Tab>("catalog");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [geminiName, setGeminiName] = useState<string | null>(null);
  const [matches, setMatches] = useState<CarMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  const catalogSize = useMemo(() => carsForGame("cpm2").length, []);
  const results = useMemo(() => searchCars(debounced, 40, "cpm2"), [debounced]);

  function resetScreenshot() {
    setPreview(null);
    setGeminiName(null);
    setMatches([]);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    setError(null);
    setGeminiName(null);
    setMatches([]);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Use a PNG, JPEG or WebP screenshot.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Screenshot is too large - keep it under 5MB.");
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      setPreview(dataUrl);
      setScanning(true);
      const result = await api.identifyCar({
        imageBase64: dataUrl.split(",")[1] ?? "",
        mimeType: file.type,
      });
      setGeminiName(result.carName);
      setMatches(result.matches);
      if (result.matches.length === 0) {
        setError(
          `Gemini read “${result.carName}” but no CPM2 catalog car matches it. Try the catalog search instead.`,
        );
      }
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "GEMINI_NOT_CONFIGURED") {
        setError(
          "Screenshot identification needs a free Gemini API key - add GEMINI_API_KEY to .env.local and restart. Catalog search works right now.",
        );
      } else {
        setError(err instanceof ApiRequestError ? err.message : "Could not analyse that screenshot.");
      }
    } finally {
      setScanning(false);
    }
  }

  function pick(code: number) {
    onPick(code);
    handleClose();
  }

  // Every exit routes through one reset — a fresh add deserves a fresh
  // search, so reopening never shows the previous car's query.
  function handleClose() {
    setQuery("");
    setDebounced("");
    resetScreenshot();
    onClose();
  }

  /**
   * Hand a Gemini miss off to the catalog tab. The raw read (e.g. "Volkswagen
   * Golf VR6") often matches nothing, so the pre-filled query is shortened
   * token by token until it actually returns catalog cars — the user then
   * browses what the catalog really has instead of confirming a guess.
   */
  function searchCatalogFor(name: string) {
    const tokens = name.trim().split(/\s+/).filter(Boolean);
    let best = tokens.slice(0, 2).join(" ") || name.trim();
    for (let count = tokens.length; count >= 1; count -= 1) {
      const candidate = tokens.slice(0, count).join(" ");
      if (searchCars(candidate, 1, "cpm2").length > 0) {
        best = candidate;
        break;
      }
    }
    setQuery(best);
    setDebounced(best);
    setTab("catalog");
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add a car to the deal"
      subtitle="Search the CPM2 catalog, or let Gemini read a screenshot - you confirm the match either way."
      width="max-w-2xl"
      footer={
        scanning
          ? null
          : (
              <Button variant="primary" onClick={handleClose} type="button">
                Done
              </Button>
            )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2" role="tablist" aria-label="Car picker mode">
          {(
            [
              { id: "catalog", label: "Catalog search" },
              { id: "screenshot", label: "Screenshot (Gemini)" },
            ] as const
          ).map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={`cursor-pointer rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                tab === entry.id
                  ? "border-racing bg-racing text-racing"
                  : "border-ink text-ink-faint hover:border-ink hover:text-ink"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === "catalog" ? (
          <>
            <div>
              <label htmlFor="trade-car-search" className="label-caps">
                Search the CPM2 catalog
              </label>
              <div className="relative mt-1.5">
                <svg
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16l4.5 4.5" strokeLinecap="round" />
                </svg>
                <input
                  id="trade-car-search"
                  name="trade-car-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="49, supra, gt…"
                  autoComplete="off"
                  spellCheck={false}
                  className="field-rule pl-10 text-[13px]"
                />
              </div>
              <p className="num mt-1.5 text-[10px] text-ink-faint">
                {results.length} of {catalogSize} CPM2 codes
              </p>
            </div>

            <ul className="-mx-2 flex max-h-[46vh] flex-col overflow-y-auto pr-1">
              {results.length === 0 ? (
                <li className="px-3 py-10 text-center text-sm text-ink-faint">
                  No car matches “{debounced.trim()}”.
                </li>
              ) : (
                results.map((entry) => (
                  <li key={entry.code}>
                    <button
                      type="button"
                      onClick={() => pick(entry.code)}
                      aria-label={`Add #${entry.code} ${entry.name} to the deal`}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] border border-border px-3 py-2.5 text-left hover:border-primary hover:text-primary-foreground"
                    >
                      <span className="num w-11 shrink-0 text-[12px] text-ink-faint">
                        #{entry.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{entry.name}</span>
                      {prices.get(entry.code) ? (
                        <span className="num shrink-0 text-[10px] text-ink-faint">
                          {priceLabel(prices.get(entry.code)!)}
                        </span>
                      ) : null}
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-racing"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />

            {!preview ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center gap-3 rounded-[16px] border border-dashed border-border px-6 py-10 hover:border-primary hover:text-primary-foreground"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7 text-ink-faint"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <rect x="3" y="6" width="18" height="13" rx="2.5" />
                  <circle cx="12" cy="12.5" r="3.2" />
                  <path d="M8.5 6l1.2-2h4.6L15.5 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[13px] text-ink">Choose a screenshot of the car</span>
                <span className="text-[11px] text-ink-faint">PNG, JPEG or WebP · up to 5MB</span>
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Screenshot sent to Gemini"
                    className="h-24 w-36 shrink-0 rounded-[12px] border border-ink object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    {scanning ? (
                      <p className="num text-[11px] text-racing">Gemini is reading the car…</p>
                    ) : geminiName ? (
                      <>
                        <p className="label-caps">Gemini read</p>
                        <p className="mt-0.5 text-[14px] font-semibold text-ink">{geminiName}</p>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={resetScreenshot}
                      className="mt-2 cursor-pointer text-[11px] text-ink-faint underline-offset-2 transition hover:text-ink hover:underline"
                    >
                      Choose a different screenshot
                    </button>
                  </div>
                </div>

                {error ? (
                  <p className="rounded-[14px] border border-oxblood bg-oxblood px-3 py-2 text-xs text-oxblood">
                    {error}
                  </p>
                ) : null}

                {/* Gemini read a car the catalog doesn't have - hand off to a
                    catalog search pre-filled with its make/model so the user
                    sees what the catalog really offers. */}
                {!scanning && geminiName && matches.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => searchCatalogFor(geminiName)}
                    className="cursor-pointer self-start rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground hover:border-primary hover:text-primary-foreground hover:border-primary"
                  >
                    Search the catalog for “{geminiName}”
                  </button>
                ) : null}

                {matches.length > 0 ? (
                  <div>
                    <p className="label-caps">Confirm the match</p>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                      {matches.map((match) => (
                        <li key={match.code}>
                          <button
                            type="button"
                            onClick={() => pick(match.code)}
                            className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] border border-border px-3 py-2.5 text-left hover:border-primary hover:text-primary-foreground"
                          >
                            <span className="num w-11 shrink-0 text-[12px] text-ink-faint">
                              #{match.code}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                              {match.name}
                            </span>
                            {prices.get(match.code) ? (
                              <span className="num shrink-0 text-[10px] text-ink-faint">
                                {priceLabel(prices.get(match.code)!)}
                              </span>
                            ) : null}
                            <span className="num shrink-0 rounded-full border border-ink px-2 py-0.5 text-[9px] text-ink-faint">
                              {Math.round(match.score * 100)}%
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
