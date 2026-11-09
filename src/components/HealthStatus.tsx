"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeartToggle } from "@/components/HeartToggle";

/**
 * Health status UI — reads /api/store/health when Nemotron's endpoint is live.
 * Degrades gracefully to a simulated "live" state until then.
 */
export function HealthStatus() {
  const [status, setStatus] = useState<"live" | "degraded" | "offline">("live");
  const [dbStatus, setDbStatus] = useState<"connected" | "disconnected" | "unknown">("unknown");
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/store/health", { cache: "no-store" })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setStatus(data.status === "ok" ? "live" : "degraded");
        setDbStatus(data.database === "ok" ? "connected" : "disconnected");
        setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("offline");
        setDbStatus("disconnected");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusColor =
    status === "live" ? "text-gold border-gold" : status === "degraded" ? "text-destructive border-destructive" : "text-ink-soft border-border";
  const dbColor =
    dbStatus === "connected" ? "text-gold border-gold" : dbStatus === "disconnected" ? "text-destructive border-destructive" : "text-ink-soft border-border";

  return (
    <section className="panel rounded-xl border border-border p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">System Health</h3>
          <p className="text-sm font-medium text-foreground">{status === "live" ? "All systems operational" : status === "degraded" ? "Degraded performance" : "System offline"}</p>
        </div>
        <span
          className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dbColor}`} />
          <span className="text-ink-soft">Database</span>
          <span className="ml-auto text-xs font-medium">{dbStatus === "connected" ? "Connected" : dbStatus === "disconnected" ? "Disconnected" : "Unknown"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-border" />
          <span className="text-ink-soft">API</span>
          <span className="ml-auto text-xs font-medium">{status === "live" ? "Online" : status === "degraded" ? "Degraded" : "Offline"}</span>
        </div>
        {lastChecked && (
          <div className="col-span-2 flex items-center gap-2 text-[10px] text-muted-foreground mt-2">
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>Last checked {lastChecked}</span>
          </div>
        )}
      </div>
    </section>
  );
}
