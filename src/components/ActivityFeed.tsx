"use client";

import type { FleetEvent, FleetEventType } from "@/lib/types";
import { absoluteTime, relativeTime } from "@/lib/format";
import { formatNumber } from "@/lib/constants";

const TYPES: Record<FleetEventType, { label: string; mark: string; text: string }> = {
  created: { label: "New", mark: "bg-racing", text: "text-racing" },
  updated: { label: "Edit", mark: "bg-blueprint", text: "text-blueprint" },
  slots_removed: { label: "Slots-", mark: "bg-brass/70", text: "text-brass" },
  slots_purchased: { label: "Slots", mark: "bg-brass", text: "text-brass" },
  archived: { label: "Archived", mark: "bg-oxblood", text: "text-oxblood" },
  deleted: { label: "Gone", mark: "bg-oxblood", text: "text-oxblood" },
  export_performed: { label: "Export", mark: "bg-blueprint", text: "text-blueprint" },
  password_revealed: { label: "Reveal", mark: "bg-brass", text: "text-brass" },
  trophies_updated: { label: "Trophy", mark: "bg-brass", text: "text-brass" },
};

export function ActivityFeed({ events }: { events: FleetEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="panel rounded-[14px] px-6 py-16 text-center">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">No activity yet</p>
        <p className="mt-2 text-sm text-ink-faint">
          Every account you add, edit or delete shows up here as a permanent log.
        </p>
      </div>
    );
  }

  return (
    <ol className="panel overflow-hidden rounded-[14px]">
      {events.map((event, index) => {
        const meta = TYPES[event.type] ?? TYPES.updated;
        return (
          <li
            key={event.id}
            className={`animate-rise flex gap-4 px-4 py-3.5 ${index > 0 ? "border-t border-ink/10" : ""}`}
            style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
          >
            <span className={`log-mark mt-1.5 ${meta.mark}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`font-sans text-[9px] font-semibold uppercase tracking-[0.18em] ${meta.text}`}>
                  {meta.label}
                </span>
                <span className="num truncate text-[12px] text-ink">{event.email}</span>
                <span className="num text-[10px] text-ink-faint" title={absoluteTime(event.createdAt)}>
                  {relativeTime(event.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-ink-soft">{event.summary}</p>
              {Object.keys(event.changes).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(event.changes).map(([field, change]) => (
                    <span
                      key={field}
                      className="num rounded-full border border-ink/12 bg-paper-sunken px-1.5 py-0.5 text-[10px] text-ink-soft"
                    >
                      <span className="text-ink-faint">{field}</span>{" "}
                      <span className="text-ink">{renderValue(change.from)}</span>{" "}
                      <span className="text-brass">→</span>{" "}
                      <span className="text-ink">{renderValue(change.to)}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function renderValue(value: unknown): string {
  if (typeof value === "number") return formatNumber(value);
  if (value === null || value === undefined) return "—";
  return String(value);
}
