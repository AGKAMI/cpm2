"use client";

import { useMemo, useState } from "react";
import { useFleet } from "@/components/FleetProvider";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PageHeading } from "@/components/PageHeading";
import type { FleetEventType } from "@/lib/types";

const FILTERS: { key: FleetEventType | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "created", label: "Added" },
  { key: "updated", label: "Edited" },
  { key: "slots_purchased", label: "Slots bought" },
  { key: "slots_removed", label: "Slots removed" },
  { key: "archived", label: "Archived" },
  { key: "password_revealed", label: "Reveals" },
  { key: "export_performed", label: "Exports" },
];

export default function ActivityPage() {
  const fleet = useFleet();
  const [filter, setFilter] = useState<FleetEventType | "all">("all");
  const [needle, setNeedle] = useState("");

  const events = useMemo(() => {
    const search = needle.trim().toLowerCase();
    return fleet.events.filter((event) => {
      if (filter !== "all" && event.type !== filter) return false;
      if (!search) return true;
      return (
        event.email.toLowerCase().includes(search) || event.summary.toLowerCase().includes(search)
      );
    });
  }, [fleet.events, filter, needle]);

  const counts = useMemo(() => {
    const map = new Map<FleetEventType, number>();
    for (const event of fleet.events) {
      map.set(event.type, (map.get(event.type) ?? 0) + 1);
    }
    return map;
  }, [fleet.events]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading folio="F-03" title="Activity log" meta="permanent · the paper trail" />
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="min-w-[200px] flex-1">
          <span className="label-caps">Search the log</span>
          <div className="relative mt-1">
            <input
              value={needle}
              onChange={(event) => setNeedle(event.target.value)}
              placeholder="email or summary"
              aria-label="Search the activity log"
              className="field-rule num text-[13px]"
            />
          </div>
        </div>
        <div>
          <span className="label-caps">Entry type</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-full border px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  filter === item.key
                    ? "border-racing bg-racing text-paper"
                    : "border-ink/15 bg-paper-raised text-ink-soft hover:border-racing/50 hover:text-racing"
                }`}
              >
                {item.label}
                {item.key !== "all" && counts.get(item.key) ? (
                  <span className="num ml-1.5 opacity-60">{counts.get(item.key)}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="label-caps">
          {events.length} of {fleet.events.length} entries
        </span>
        <span className="num text-[10px] text-ink-faint">the log is permanent — it is the paper trail</span>
      </div>

      {events.length === 0 ? (
        <div className="panel rounded-[14px] px-6 py-16 text-center">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
            Nothing logged
          </p>
          <p className="mt-2 text-sm text-ink-faint">No entry matches this filter.</p>
        </div>
      ) : (
        <ActivityFeed events={events} />
      )}
    </div>
  );
}
