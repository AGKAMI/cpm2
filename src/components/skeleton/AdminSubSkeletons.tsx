"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

/**
 * Loading skeletons for the admin SUB-pages — each mirrors the real layout of
 * its page (same sections, same card shapes) so the loader reads as the page
 * arriving, not as a generic spinner. The main /store/admin has AdminSkeleton;
 * these cover the sections reachable from it.
 */

/** Wallet: adjust form card, balances card with search, ledger card. */
export function AdminWalletSkeleton() {
  return (
    <div className="space-y-4">
      {/* Adjust form */}
      <div className="panel rounded-xl border border-border p-6">
        <SkeletonBlock width="180px" height="14px" radius="0.25rem" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <SkeletonBlock width="90px" height="10px" radius="0.25rem" />
              <SkeletonBlock height="36px" radius="0.375rem" />
            </div>
          ))}
        </div>
        <SkeletonBlock width="150px" height="34px" radius="0.25rem" className="mt-4" />
      </div>
      {/* Balances + search */}
      <div className="panel rounded-xl border border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SkeletonBlock width="90px" height="14px" radius="0.25rem" />
          <SkeletonBlock width="220px" height="32px" radius="0.375rem" />
        </div>
        <div className="mt-3 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2">
              <div className="space-y-1">
                <SkeletonBlock width="140px" height="12px" radius="0.25rem" />
                <SkeletonBlock width="100px" height="9px" radius="0.25rem" />
              </div>
              <SkeletonBlock width="70px" height="14px" radius="0.25rem" />
            </div>
          ))}
        </div>
      </div>
      {/* Ledger */}
      <div className="panel rounded-xl border border-border p-6">
        <SkeletonBlock width="150px" height="14px" radius="0.25rem" />
        <div className="mt-3 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2">
              <div className="space-y-1">
                <SkeletonBlock width="160px" height="12px" radius="0.25rem" />
                <SkeletonBlock width="120px" height="9px" radius="0.25rem" />
              </div>
              <SkeletonBlock width="60px" height="14px" radius="0.25rem" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Promotions: heading row + promo cards with colour swatch + pill preview. */
export function AdminPromotionsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonBlock width="110px" height="16px" radius="0.25rem" />
        <SkeletonBlock width="130px" height="32px" radius="0.25rem" />
      </div>
      {[1, 2].map((i) => (
        <article key={i} className="panel rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <SkeletonBlock width="180px" height="18px" radius="0.25rem" />
            <div className="flex gap-2">
              <SkeletonBlock width="60px" height="28px" radius="0.25rem" />
              <SkeletonBlock width="70px" height="28px" radius="0.25rem" />
            </div>
          </div>
          <SkeletonBlock width="85%" height="11px" radius="0.25rem" className="mt-3" />
          <SkeletonBlock width="60%" height="11px" radius="0.25rem" className="mt-2" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="space-y-1">
                <SkeletonBlock width="60px" height="9px" radius="0.25rem" />
                <SkeletonBlock height="32px" radius="0.375rem" />
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/** Dashboard: stat cards grid + alerts list + quick actions row. */
export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="panel rounded-xl border border-border p-4 space-y-2">
            <SkeletonBlock width="70px" height="9px" radius="0.25rem" />
            <SkeletonBlock width="90px" height="22px" radius="0.375rem" />
          </div>
        ))}
      </div>
      <div className="panel rounded-xl border border-border p-4 space-y-3">
        <SkeletonBlock width="120px" height="14px" radius="0.25rem" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <SkeletonBlock width="180px" height="12px" radius="0.25rem" />
              <SkeletonBlock width="130px" height="9px" radius="0.25rem" />
            </div>
            <SkeletonBlock width="54px" height="20px" radius="9999px" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <SkeletonBlock key={i} width="150px" height="34px" radius="0.25rem" />
        ))}
      </div>
    </div>
  );
}

/** EFT review: ticket rows awaiting proof review. */
export function AdminEftSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonBlock width="160px" height="16px" radius="0.25rem" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="panel rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <SkeletonBlock width="150px" height="14px" radius="0.25rem" />
            <SkeletonBlock width="70px" height="20px" radius="9999px" />
          </div>
          <div className="mt-3 flex gap-3">
            <SkeletonBlock width="96px" height="72px" radius="0.5rem" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock width="80%" height="10px" radius="0.25rem" />
              <SkeletonBlock width="55%" height="10px" radius="0.25rem" />
              <SkeletonBlock width="40%" height="10px" radius="0.25rem" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Support tickets: row list with status pills. */
export function AdminSupportSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonBlock width="140px" height="16px" radius="0.25rem" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="panel rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <SkeletonBlock width="170px" height="13px" radius="0.25rem" />
            <SkeletonBlock width="60px" height="20px" radius="9999px" />
          </div>
          <SkeletonBlock width="90%" height="10px" radius="0.25rem" className="mt-3" />
          <SkeletonBlock width="45%" height="10px" radius="0.25rem" className="mt-2" />
        </div>
      ))}
    </div>
  );
}

/** Analytics: chart blocks over a stat strip. */
export function AdminAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="panel rounded-xl border border-border p-4 space-y-2">
            <SkeletonBlock width="80px" height="9px" radius="0.25rem" />
            <SkeletonBlock width="100px" height="20px" radius="0.375rem" />
          </div>
        ))}
      </div>
      <div className="panel rounded-xl border border-border p-4">
        <SkeletonBlock width="130px" height="14px" radius="0.25rem" />
        <SkeletonBlock height="160px" radius="0.5rem" className="mt-3" />
      </div>
    </div>
  );
}

/** Deliveries: scheduled delivery rows. */
export function AdminDeliveriesSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonBlock width="150px" height="16px" radius="0.25rem" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="panel rounded-xl border border-border p-4 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <SkeletonBlock width="160px" height="12px" radius="0.25rem" />
            <SkeletonBlock width="110px" height="9px" radius="0.25rem" />
          </div>
          <SkeletonBlock width="64px" height="20px" radius="9999px" />
        </div>
      ))}
    </div>
  );
}

/** Accounts manager: product picker + units table. */
export function AdminAccountsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="panel rounded-xl border border-border p-4 space-y-3">
        <SkeletonBlock width="130px" height="14px" radius="0.25rem" />
        <SkeletonBlock height="36px" radius="0.375rem" />
        <SkeletonBlock width="180px" height="32px" radius="0.25rem" />
      </div>
      <div className="panel rounded-xl border border-border p-4 space-y-3">
        <SkeletonBlock width="120px" height="14px" radius="0.25rem" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <SkeletonBlock width="150px" height="11px" radius="0.25rem" />
              <SkeletonBlock width="100px" height="9px" radius="0.25rem" />
            </div>
            <SkeletonBlock width="56px" height="20px" radius="9999px" />
          </div>
        ))}
      </div>
    </div>
  );
}