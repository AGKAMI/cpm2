"use client";

import type { FleetEvent, FleetEventType } from "@/lib/types";
import { absoluteTime, relativeTime } from "@/lib/format";
import { formatNumber } from "@/lib/constants";

const TYPES: Record<FleetEventType, { label: string; dot: string; text: string }> = {
  created: { label: "NEW", dot: "bg-mint-glow", text: "text-mint-glow" },
  updated: { label: "EDIT", dot: "bg-cyan-glow", text: "text-cyan-glow" },
  slots_removed: { label: "SLOTS-", dot: "bg-amber-glow/60", text: "text-amber-glow/70" },
  slots_purchased: { label: "SLOTS", dot: "bg-amber-glow", text: "text-amber-glow" },
  archived: { label: "ARCHIVED", dot: "bg-red-glow", text: "text-red-glow" },
  deleted: { label: "GONE", dot: "bg-red-glow", text: "text-red-glow" },
  export_performed: { label: "EXPORT", dot: "bg-cyan-glow", text: "text-cyan-glow" },
  password_revealed: { label: "REVEAL", dot: "bg-amber-glow", text: "text-amber-glow" },
};

export function ActivityFeed({ events }: { events: FleetEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="panel rounded-xl px-6 py-16 text-center">
        <p className="font-display text-xs uppercase tracking-[0.25em] text-ash-500">No activity yet</p>
        <p className="mt-2 text-sm text-ash-600">
          Every account you add, edit or delete shows up here as a permanent log.
        </p>
      </div>
    );
  }

  return (
    <ol className="panel overflow-hidden rounded-xl">
      {events.map((event, index) => {
        const meta = TYPES[event.type] ?? TYPES.updated;
        return (
          <li
            key={event.id}
            className={`animate-rise flex gap-4 px-4 py-3.5 ${index > 0 ? "border-t border-white/5" : ""}`}
            style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`font-display text-[10px] tracking-[0.2em] ${meta.text}`}>{meta.label}</span>
                <span className="num truncate text-[13px] text-ash-100">{event.email}</span>
                <span className="text-[11px] text-ash-600" title={absoluteTime(event.createdAt)}>
                  {relativeTime(event.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-ash-500">{event.summary}</p>
              {Object.keys(event.changes).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(event.changes).map(([field, change]) => (
                    <span
                      key={field}
                      className="rounded border border-white/8 bg-carbon-950/50 px-2 py-0.5 font-mono text-[10px] text-ash-500"
                    >
                      <span className="text-ash-600">{field}</span>{" "}
                      <span className="text-ash-400">{renderValue(change.from)}</span>{" "}
                      <span className="text-amber-glow">→</span>{" "}
                      <span className="text-ash-200">{renderValue(change.to)}</span>
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
