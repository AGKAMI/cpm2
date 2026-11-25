/**
 * Store home — a HUB, not a shop window.
 *
 * Per spec: no products render here. The customer picks a game first, then a
 * sub-catalogue, and only then sees listings. This page carries the identity
 * block (greeting + balance), the game picker, and the discovery shelves
 * (promotions / notifications / new arrivals).
 *
 * Product listing lives behind:
 *   /store/cpm2 -> accounts | cars
 *   /store/cpm1 -> accounts | cars | services
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VantaProduct, VantaCategory } from "@/lib/store/client";
import { WalletHeader } from "@/components/WalletHeader";
import { Modal } from "@/components/ui/Modal";

/** The hub is NOT a shop window, so it does not take StoreHomeData -- it needs
 *  the raw catalogue to derive its discovery shelves plus the promotions feed. */
export type StoreHubData = {
  products: VantaProduct[];
  categories: VantaCategory[];
};

function greeting(): string {
  // SAST is UTC+2; the host clock is the authority, this only buckets the hour.
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function GameTile({
  href,
  onClick,
  label,
  active,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const base = `flex flex-col items-center justify-center gap-3 rounded-2xl border px-3 py-6 text-center transition-colors ${
    active
      ? "border-primary bg-primary/10 text-foreground"
      : "border-border bg-secondary text-foreground hover:border-primary/60"
  } ${className ?? ""}`;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={base}
        aria-label={label}
      >
        <span className="text-ink-soft">{children}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{label}</span>
      </button>
    );
  }
  return (
    <Link
      href={href!}
      className={base}
    >
      <span className="text-ink-soft">{children}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{label}</span>
    </Link>
  );
}

/** SVG inline so no emoji-as-control (USER.md: UI icons are never emoji). */
function IconGamepad() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" strokeLinecap="round" />
      <rect x="2" y="6" width="20" height="12" rx="5" />
    </svg>
  );
}

function IconHeadset() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" strokeLinecap="round" />
      <rect x="2" y="13" width="4" height="6" rx="2" />
      <rect x="18" y="13" width="4" height="6" rx="2" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2" y="6" width="20" height="13" rx="3" />
      <path d="M2 10h20" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M18 15V10a6 6 0 1 0-12 0v5l-2 3h16l-2-3Z" strokeLinecap="round" />
      <path d="M10 21h4" strokeLinecap="round" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="18" cy="20" r="1.6" />
      <path d="M2 3h3l3 12h11l2-8H6" strokeLinecap="round" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14 0 18-3-4-3-14.5 0-18Z" />
    </svg>
  );
}

/** A labelled shelf row. Content is passed in so the home page stays a hub. */
function Shelf({ title, actionHref, actionLabel, children }: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-foreground">{title}</h2>
        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft hover:text-foreground"
          >
            {actionLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Support contact options — open in a dialog when the customer taps Support
 *  from the hub: submit a ticket in-app, or reach the owner on Telegram /
 *  WhatsApp. No username is known for the owner, so Telegram deep-links by
 *  user id (tg://user?id=7036681178). */
function SupportOptions({
  open,
  onClose,
  onSubmitTicket,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitTicket: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Contact support"
      subtitle="Choose how you'd like to reach us."
      width="max-w-md"
    >
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            onClose();
            onSubmitTicket();
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left text-foreground transition-colors hover:bg-secondary"
        >
          <svg
            className="shrink-0 h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <div className="font-semibold">Submit a ticket</div>
            <div className="text-xs text-muted-foreground">
              Open a support ticket in the app
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            window.location.href = "tg://user?id=7036681178";
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left text-foreground transition-colors hover:bg-secondary"
        >
          <img
            src="/brands/telegram.svg"
            alt=""
            width="24"
            height="24"
            className="shrink-0 h-5 w-5 rounded-md"
            aria-hidden="true"
          />
          <div>
            <div className="font-semibold">Contact owner on Telegram</div>
            <div className="text-xs text-muted-foreground">
              Open a chat with the store owner
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            window.location.href = "https://wa.me/27840820712";
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left text-foreground transition-colors hover:bg-secondary"
        >
          <img
            src="/brands/whatsapp.svg"
            alt=""
            width="24"
            height="24"
            className="shrink-0 h-5 w-5"
            aria-hidden="true"
          />
          <div>
            <div className="font-semibold">Contact owner on WhatsApp</div>
            <div className="text-xs text-muted-foreground">
              Message the store owner directly
            </div>
          </div>
        </button>
      </div>
    </Modal>
  );
}

export function StoreHub({ products, categories: _categories }: StoreHubData) {
  // Derived shelves, not a second product grid: these are the "new additions"
  // and "promotions" strips, capped so they never read as a shop window.
  const arrivals = products.filter((p) => p.isNew).slice(0, 4);
  const onSale = products.filter((p) => p.isSale).slice(0, 4);
  const router = useRouter();
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 pb-24">
      {/* ---------- identity ---------- */}

      {/* ---------- wallet-style header (reference layout) ---------- */}
      <WalletHeader />

      {/* ---------- game picker ---------- */}
      <nav aria-label="Browse" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <GameTile href="/store/cpm2" label="CPM 2">
          <IconGamepad />
        </GameTile>
        <GameTile href="/store/cpm1" label="CPM 1">
          <IconGamepad />
        </GameTile>
        <GameTile label="Support" onClick={() => setSupportOpen(true)} className="col-span-2 sm:col-span-1">
          <IconHeadset />
        </GameTile>
      </nav>

      {/* ---------- discovery shelves (NOT products) ---------- */}
      {onSale.length > 0 && (
        <Shelf
          title="Promotions"
          actionHref="/store/cpm2/cars"
          actionLabel="Manage"
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {onSale.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/store/products/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary px-4 py-3 text-xs text-foreground hover:border-primary/60"
                >
                  <span className="truncate font-bold">{p.name}</span>
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-ok">
                    -{p.discountPercent}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Shelf>
      )}

      {arrivals.length > 0 && (
        <Shelf title="New additions" actionHref="/store/cpm2/cars" actionLabel="Browse">
          <ul className="grid gap-3 sm:grid-cols-2">
            {arrivals.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/store/products/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary px-4 py-3 text-xs text-foreground hover:border-primary/60"
                >
                  <span className="truncate font-bold">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-ink-soft">
                    R {(p.basePriceCents / 100).toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Shelf>
      )}
    </main>
    <SupportOptions
      open={supportOpen}
      onClose={() => setSupportOpen(false)}
      onSubmitTicket={() => router.push("/store/support")}
    />
    </>
  );
}