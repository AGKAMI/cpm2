"use client";

import type { FleetEvent, FleetEventType } from "@/lib/types";
import { absoluteTime, relativeTime } from "@/lib/format";
import { formatNumber } from "@/lib/constants";

const TYPES: Record<FleetEventType, { label: string; mark: string; text: string }> = {
  created: { label: "New", mark: "bg-aether-accent", text: "text-aether-accent" },
  updated: { label: "Edit", mark: "bg-mix(in srgb, var(--aether-accent) 30%, transparent)", text: "text-aether-accent" },
  slots_removed: { label: "Slots-", mark: "bg-aether-accent/70", text: "text-aether-accent" },
  slots_purchased: { label: "Slots", mark: "bg-aether-accent", text: "text-aether-accent" },
  garage_upgraded: { label: "Garage", mark: "bg-aether-accent", text: "text-aether-accent" },
  archived: { label: "Archived", mark: "bg-aether-accent", text: "text-aether-accent" },
  deleted: { label: "Gone", mark: "bg-aether-accent", text: "text-aether-accent" },
  export_performed: { label: "Export", mark: "bg-mix(in srgb, var(--aether-accent) 30%, transparent)", text: "text-aether-accent" },
  password_revealed: { label: "Reveal", mark: "bg-aether-accent", text: "text-aether-accent" },
  trophies_updated: { label: "Trophy", mark: "bg-aether-accent", text: "text-aether-accent" },
  car_added: { label: "Garage", mark: "bg-aether-accent", text: "text-aether-accent" },
  car_removed: { label: "Garage", mark: "bg-aether-accent", text: "text-aether-accent" },
};

export function ActivityFeed({ events }: { events: FleetEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="panel rounded-[20px] px-6 py-16 text-center">
        <p className="font-sans text-[13px] font-semibold tracking-[-0.01em] text-aether-text">No activity yet</p>
        <p className="mt-2 text-sm text-aether-text-faint">
          Every account you add, edit or delete shows up here as a permanent log.
        </p>
      </div>
    );
  }

  return (
    <ol className="panel overflow-hidden rounded-[20px]">
      {events.map((event, index) => {
        const meta = TYPES[event.type] ?? TYPES.updated;
        return (
          <li
            key={event.id}
            className={`animate-rise flex gap-4 px-4 py-3.5 ${index > 0 ? "border-t border-mix(in srgb, var(--aether-text) 10%, transparent)" : ""}`}
            style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
          >
            <span className={`log-mark mt-1.5 ${meta.mark}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`font-sans text-[9px] font-semibold uppercase tracking-[0.18em] ${meta.text}`}>
                  {meta.label}
                </span>
                <span className="num truncate text-[12px] text-aether-text">{event.email}</span>
                <span className="num text-[10px] text-aether-text-faint" title={absoluteTime(event.createdAt)}>
                  {relativeTime(event.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-aether-text-soft">{event.summary}</p>
              {Object.keys(event.changes).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(event.changes).map(([field, change]) => (
                    <span
                      key={field}
                      className="num rounded-full border border-mix(in srgb, var(--aether-text) 12%, transparent) bg-mix(in srgb, var(--aether-text) 5%, transparent) px-1.5 py-0.5 text-[10px] text-aether-text-soft backdrop-blur-md"
                    >
                      <span className="text-aether-text-faint">{field}</span>{" "}
                      <span className="text-aether-text">{renderValue(change.from)}</span>{" "}
                      <span className="text-aether-accent">→</span>{" "}
                      <span className="text-aether-text">{renderValue(change.to)}</span>
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
