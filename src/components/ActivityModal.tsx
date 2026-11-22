"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/store/client";
import { Modal } from "@/components/ui/Modal";

export type ActivityItem = {
  customerName: string;
  productName: string;
  productId: number;
  amountCents: number;
  currency: string;
  createdAt: string;
};

/** Relative time like "2h ago", "45m ago", "1d ago". */
function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

interface ActivityModalProps {
  open: boolean;
  onClose: () => void;
  item: ActivityItem | null;
  activities: ActivityItem[];
}

export function ActivityModal({ open, onClose, item, activities }: ActivityModalProps) {
  const [fresh, setFresh] = useState<ActivityItem[]>(activities);

  // Refresh the activity list when the modal opens so it shows the latest.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/store/activity", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { activities: ActivityItem[] };
        if (!cancelled) setFresh(data.activities ?? []);
      } catch {
        // Keep existing data.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Today's Activity"
      subtitle={`${fresh.length} purchase${fresh.length !== 1 ? "s" : ""} today`}
      width="max-w-md"
    >
      <div className="space-y-3">
        {fresh.map((a) => (
          <Link
            key={a.customerName + a.createdAt}
            href={`/store/products/${a.productId}`}
            className="group flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-secondary transition-colors"
          >
            <div className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="6" width="16" height="12" rx="2" />
                <circle cx="5.5" cy="10.5" r="1.5" />
                <circle cx="18.5" cy="10.5" r="1.5" />
                <path d="M2 18h20" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <h3 className="font-semibold text-foreground truncate">
                  {a.productName}
                </h3>
                <span className="text-xs text-brand-gold font-semibold">
                  {formatPrice(a.amountCents, a.currency)}
                </span>
              </div>
              <p className="text-[11px] text-ink-soft truncate">
                {a.customerName} • {relativeTime(a.createdAt)} ago
              </p>
            </div>
          </Link>
        ))}
      </div>
    </Modal>
  );
}
