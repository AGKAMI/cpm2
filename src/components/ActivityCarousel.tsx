"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityModal } from "./ActivityModal";

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

export function ActivityCarousel() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ActivityItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect prefers-reduced-motion.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Fetch today's activity from the API.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/store/activity", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { activities: ActivityItem[] };
        if (!cancelled) setActivities(data.activities ?? []);
      } catch {
        // Non-fatal — carousel stays empty.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openItem = (item: ActivityItem) => {
    setActiveItem(item);
    setModalOpen(true);
  };

  const arrowSvg = (dir: "prev" | "next") => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === "prev" ? (
        <path d="m15 19-7-7 7-7" />
      ) : (
        <path d="m9 5 7 7-7 7" />
      )}
    </svg>
  );

  if (loading || activities.length === 0) return null;

  return (
    <>
      {/* Activity bar attached to header (header handles stickiness) */}
      <div className="z-20 mt-[-1px] bg-background">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
          {/* Left/right gradient fades — permanent */}
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background via-transparent to-transparent pointer-events-none z-10" />
          <div
            className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background via-transparent to-transparent pointer-events-none z-10"
          />

          <div
            ref={scrollRef}
            className="flex items-baseline gap-4 px-24 py-4 overflow-x-hidden whitespace-nowrap"
          >
            {/* Prev arrow */}
            <button
              type="button"
              onClick={() => {
                const el = scrollRef.current;
                if (!el) return;
                el.scrollBy({ left: -260, behavior: "smooth" });
              }}
              aria-label="Scroll activity left"
              className="shrink-0 z-20 w-10 h-10 rounded-full border border-brand-gold bg-background flex items-center justify-center text-brand-gold hover:bg-brand-gold hover:text-background transition-colors"
            >
              {arrowSvg("prev")}
            </button>

            {/* Activity items — scrolling line */}
            <div className="flex items-baseline gap-1 text-xs">
              {activities.map((item, idx) => (
                <button
                  key={item.customerName + item.createdAt}
                  type="button"
                  onClick={() => openItem(item)}
                  role="button"
                  aria-label={`${item.customerName} bought ${item.productName}`}
                  className="flex items-baseline gap-1 cursor-pointer select-none whitespace-nowrap hover:underline hover:text-brand-gold transition-colors"
                >
                  <span className="text-xs font-bold tracking-tight text-foreground">
                    {item.customerName}
                  </span>
                  <span className="text-ink-soft"> bought </span>
                  <span className="font-semibold text-foreground">
                    {item.productName}
                  </span>
                  <span className="text-brand-gold font-semibold">
                    {" R " + (item.amountCents / 100).toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-ink-soft ml-0.5">
                    {relativeTime(item.createdAt)}
                  </span>
                  {idx < activities.length - 1 && (
                    <span className="text-brand-gold font-bold mx-1">
                      •
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Next arrow */}
            <button
              type="button"
              onClick={() => {
                const el = scrollRef.current;
                if (!el) return;
                el.scrollBy({ left: 260, behavior: "smooth" });
              }}
              aria-label="Scroll activity right"
              className="shrink-0 z-20 w-10 h-10 rounded-full border border-brand-gold bg-background flex items-center justify-center text-brand-gold hover:bg-brand-gold hover:text-background transition-colors"
            >
              {arrowSvg("next")}
            </button>
          </div>
        </div>
      </div>

      <ActivityModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={activeItem}
        activities={activities}
      />
    </>
  );
}
