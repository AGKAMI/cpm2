"use strict";

import { SkeletonBlock, SkeletonLines, SkeletonPanel, SkeletonRows, SkeletonStats } from "./SkeletonBlock";

/**
 * Per-route skeletons for pages that don't have a bespoke skeleton component.
 * Each one mirrors the real page's layout blocks (same wrappers, grids and
 * spacing) so nothing shifts when the real content swaps in. Headings are
 * rendered by the loading.tsx files with the real PageHeading where the page
 * has a static title, so the title never pops in either.
 */

/** Game hub (/store/cpm1, /store/cpm2): title block, section tiles, category shelves. */
export function GameHubSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24" aria-busy="true">
      <div className="py-6">
        <SkeletonBlock width="70px" height="11px" radius="4px" />
        <SkeletonBlock width="min(300px, 80%)" height="30px" radius="6px" className="mt-3" />
        <SkeletonBlock width="min(420px, 90%)" height="13px" radius="4px" className="mt-2" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary px-4 py-5">
            <SkeletonBlock width="26px" height="26px" radius="6px" />
            <SkeletonBlock width="55%" height="15px" radius="4px" />
            <SkeletonBlock width="85%" height="11px" radius="4px" />
          </div>
        ))}
      </div>
      <div className="mt-6">
        <SkeletonBlock width="130px" height="11px" radius="4px" className="mb-3" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} width="100%" height="46px" radius="12px" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Game section listing: category chips + product grid (2 / 3 / 4 columns). */
export function SectionListSkeleton() {
  return (
    <div aria-busy="true">
      <SkeletonBlock width="min(340px, 80%)" height="28px" radius="6px" className="mb-2" />
      <SkeletonBlock width="min(460px, 90%)" height="13px" radius="4px" className="mb-4" />
      <div className="mb-4 flex flex-wrap gap-2">
        {[64, 84, 72, 96, 58].map((w, i) => (
          <SkeletonBlock key={i} width={`${w}px`} height="28px" radius="9999px" />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <li key={i} className="flex h-full flex-col overflow-hidden rounded-xl border border-border">
            <SkeletonBlock width="100%" height="110px" radius="0px" shimmer={false} />
            <div className="flex flex-1 flex-col gap-1 p-2.5">
              <SkeletonBlock width="80%" height="13px" radius="4px" />
              <SkeletonBlock width="50%" height="11px" radius="4px" />
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading listings…</span>
    </div>
  );
}

/** App selection (/): two app doorway cards. */
export function AppSelectionSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-10 sm:grid-cols-2" aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-3xl border border-border bg-secondary p-6 space-y-3">
          <SkeletonBlock width="48px" height="48px" radius="12px" />
          <SkeletonBlock width="65%" height="22px" radius="6px" />
          <SkeletonLines lines={2} />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Fleet ledger pages: heading + two-column account cards. */
export function FleetSkeleton() {
  return (
    <div aria-busy="true">
      <SkeletonStats count={2} />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="panel rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-center gap-3">
              <SkeletonBlock width="44px" height="44px" radius="full" className="shrink-0" />
              <SkeletonBlock width="55%" height="17px" radius="4px" />
            </div>
            <SkeletonLines lines={3} />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Centred auth card (login / auth / admin-login). */
export function AuthSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10" aria-busy="true">
      <div className="panel rounded-2xl border border-border p-6 space-y-4">
        <SkeletonBlock width="56px" height="56px" radius="full" className="mx-auto" />
        <SkeletonBlock width="60%" height="22px" radius="6px" className="mx-auto" />
        <SkeletonBlock width="80%" height="13px" radius="4px" className="mx-auto" />
        <SkeletonBlock width="100%" height="44px" radius="8px" />
        <SkeletonBlock width="100%" height="44px" radius="8px" />
        <SkeletonBlock width="100%" height="46px" radius="8px" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Long-form text page (legal docs): title + ruled paragraphs. */
export function LegalSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8" aria-busy="true">
      <SkeletonBlock width="min(360px, 80%)" height="32px" radius="6px" />
      <SkeletonBlock width="120px" height="12px" radius="4px" className="mt-2" />
      <div className="rule-double mt-4" />
      <SkeletonLines lines={6} className="mt-6" />
      <SkeletonLines lines={5} className="mt-6" />
      <SkeletonLines lines={4} className="mt-6" />
      <span className="sr-only">Loading document…</span>
    </div>
  );
}

/** Notifications: a stack of notification rows. */
export function NotificationsSkeleton() {
  return (
    <div aria-busy="true">
      <SkeletonRows rows={6} height="64px" />
      <span className="sr-only">Loading notifications…</span>
    </div>
  );
}

/** Support / appointments: intro panel + ticket/appointment rows. */
export function PanelListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true">
      <SkeletonPanel lines={3} className="mb-8" />
      <SkeletonRows rows={rows} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Owner dashboard: stat cards + management panels. */
export function OwnerSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="panel rounded-xl border border-border p-4 space-y-2">
            <SkeletonBlock width="55%" height="11px" radius="4px" />
            <SkeletonBlock width="40%" height="24px" radius="6px" />
          </div>
        ))}
      </div>
      <SkeletonPanel lines={3} className="mb-8" />
      <SkeletonRows rows={3} />
      <span className="sr-only">Loading owner dashboard…</span>
    </div>
  );
}

/** Single order detail: summary panel + item rows + status timeline. */
export function OrderDetailSkeleton() {
  return (
    <div aria-busy="true">
      <SkeletonPanel lines={4} className="mb-6" />
      <SkeletonRows rows={3} />
      <SkeletonBlock width="100%" height="120px" radius="12px" className="mt-6" />
      <span className="sr-only">Loading order…</span>
    </div>
  );
}

/** Confirmation page (checkout thank-you): centred success card. */
export function ThankYouSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10" aria-busy="true">
      <div className="panel rounded-2xl border border-border p-6 space-y-4 text-center">
        <SkeletonBlock width="64px" height="64px" radius="full" className="mx-auto" />
        <SkeletonBlock width="65%" height="24px" radius="6px" className="mx-auto" />
        <SkeletonLines lines={3} />
        <SkeletonBlock width="100%" height="46px" radius="8px" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Trade pages: heading + offer cards. */
export function TradeSkeleton() {
  return (
    <div aria-busy="true">
      <SkeletonStats count={2} />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonPanel key={i} lines={3} />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Generic fallback: heading + panel. Used only where no closer twin exists. */
export function PageSkeleton() {
  return (
    <div aria-busy="true">
      <SkeletonPanel lines={4} className="mb-6" />
      <SkeletonLines lines={5} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
