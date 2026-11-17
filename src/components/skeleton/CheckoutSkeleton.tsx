"use strict";

import { SkeletonBlock } from "./SkeletonBlock";

/**
 * Checkout page skeleton — relays the loaded checkout form:
 * selected vehicle, contact details, EFT upload, order summary.
 */
export function CheckoutSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SkeletonBlock width="80px" height="20px" radius="0.25rem" />
        <SkeletonBlock width="120px" height="32px" radius="0.25rem" />
      </div>

      {/* Selected vehicle */}
      <section className="panel rounded-xl border border-border p-4 mb-6">
        <SkeletonBlock width="100%" height="150px" radius="12px" />
        <SkeletonBlock width="220px" height="20px" radius="0.25rem" className="mt-3" />
        <SkeletonBlock width="260px" height="14px" radius="0.25rem" className="mt-1" />
        <SkeletonBlock width="140px" height="18px" radius="0.25rem" className="mt-2" />
      </section>

      {/* Contact details */}
      <section className="panel rounded-xl border border-border p-6">
        <SkeletonBlock width="160px" height="18px" radius="0.25rem" />
        <SkeletonBlock width="320px" height="36px" radius="0.25rem" className="mt-3" />
        <SkeletonBlock width="260px" height="36px" radius="0.25rem" className="mt-2" />
      </section>

      {/* Payment method */}
      <section className="panel rounded-xl border border-border p-6">
        <SkeletonBlock width="140px" height="18px" radius="0.25rem" />
        <div className="flex flex-col gap-3 mt-3">
          {[
            { label: "EFT Bank Transfer", desc: "Pay via bank transfer. Upload proof after payment." },
            { label: "PayFast", desc: "Instant online payment." },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-md border border-border">
              <SkeletonBlock width="32px" height="32px" radius="0.5rem" />
              <div className="flex-1 space-y-1">
                <SkeletonBlock width="180px" height="14px" radius="2px" />
                <SkeletonBlock width="220px" height="12px" radius="0.25rem" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EFT proof upload */}
      <section className="panel rounded-xl border border-border p-6">
        <SkeletonBlock width="200px" height="18px" radius="0.25rem" />
        <SkeletonBlock width="100%" height="120px" radius="0.75rem" className="mt-3" />
        <SkeletonBlock width="160px" height="14px" radius="0.25rem" className="mt-3" />
      </section>

      {/* EFT bank details */}
      <section className="panel rounded-xl border border-border p-6">
        <SkeletonBlock width="200px" height="18px" radius="0.25rem" />
        <div className="space-y-3 mt-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-md bg-background border border-border"
            >
              <SkeletonBlock width="80px" height="14px" radius="0.25rem" />
              <SkeletonBlock width="140px" height="14px" radius="0.25rem" />
            </div>
          ))}
        </div>
      </section>

      {/* Order summary */}
      <section className="panel rounded-xl border border-border p-6">
        <SkeletonBlock width="120px" height="18px" radius="0.25rem" />
        <div className="space-y-3">
          <div className="flex justify-between">
            <SkeletonBlock width="90px" height="12px" radius="0.25rem" />
            <SkeletonBlock width="140px" height="14px" radius="0.25rem" />
          </div>
          <div className="flex justify-between">
            <SkeletonBlock width="90px" height="12px" radius="0.25rem" />
            <SkeletonBlock width="120px" height="14px" radius="0.25rem" />
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <SkeletonBlock width="100px" height="16px" radius="0.25rem" />
            <SkeletonBlock width="160px" height="20px" radius="0.25rem" />
          </div>
        </div>
      </section>

      <SkeletonBlock width="full" height="44px" radius="0.75rem" className="mt-4" />
    </div>
  );
}
