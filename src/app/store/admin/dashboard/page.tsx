/** VANTA GARAGE — admin dashboard (operational nerve center).
 * /store/admin/dashboard
 * Admin-gated: stat cards, critical alerts, quick actions.
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { vantaApi, formatPrice } from "@/lib/store/client";

type DashboardStats = {
  totalOrders: number;
  totalRevenueCents: number;
  pendingOrders: number;
  verifiedOrders: number;
  rejectedPayments: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
};

type DashboardAlert = {
  id: string;
  type: string;
  severity: "high" | "medium";
  title: string;
  description: string;
  entityId: string;
  createdAt: string;
};

type QuickAction = {
  href: string;
  label: string;
  icon: string;
  variant: "primary" | "outline" | "ghost";
};

const QUICK_ACTIONS: QuickAction[] = [
  { href: "/store/admin", label: "Manage Products", icon: "grid", variant: "primary" },
  { href: "/store/admin/admins", label: "Manage Admins", icon: "admin", variant: "outline" },
  { href: "/store/owner", label: "Owner Settings", icon: "owner", variant: "outline" },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<DashboardAlert | null>(null);

  useEffect(() => {
    loadStats();
    loadAlerts();
  }, []);

  async function loadStats() {
    try {
      const res = await vantaApi.adminDashboardStats();
      setStats(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAlerts() {
    try {
      const res = await vantaApi.adminDashboardAlerts();
      setAlerts(res.alerts ?? []);
    } catch {
      // Alerts are non-fatal — stats page still works without them
    }
  }

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="AD" title="Admin Dashboard" />
        <p className="text-muted-foreground">Loading dashboard…</p>
      </StoreShell>
    );
  }

  const highSeverity = alerts.filter((a) => a.severity === "high");
  const mediumSeverity = alerts.filter((a) => a.severity === "medium");

  return (
    <StoreShell>
      <PageHeading folio="AD" title="Admin Dashboard" backHref="/store/admin" meta={stats ? formatPrice(stats.totalRevenueCents) : undefined} />

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Stat cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            label="Total Orders"
            value={String(stats.totalOrders)}
            sublabel="All orders placed"
            icon="list"
          />
          <StatCard
            label="Revenue"
            value={formatPrice(stats.totalRevenueCents)}
            sublabel="Verified payments"
            icon="home"
          />
          <StatCard
            label="Pending Orders"
            value={String(stats.pendingOrders)}
            sublabel="Awaiting payment"
            icon="grid"
            variant="warning"
          />
          <StatCard
            label="Products Live"
            value={String(stats.totalProducts)}
            sublabel="Published to storefront"
            icon="person"
          />
        </div>
      )}

      {/* Alerts section */}
      {alerts.length > 0 && (
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Critical Alerts</h3>
            <span className={`text-xs font-bold ${highSeverity.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {alerts.length} active
            </span>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 8).map((alert) => (
              <AlertRow key={alert.id} alert={alert} onSelect={setSelectedAlert} />
            ))}
            {alerts.length > 8 && (
              <p className="text-xs text-muted-foreground text-center">
                +{alerts.length - 8} more alerts
              </p>
            )}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button
                variant={action.variant}
                className="w-full flex flex-col items-center gap-2 px-4 py-4"
                size="sm"
              >
                <span
                  className="flex items-center justify-center w-6 h-6 shrink-0"
                  dangerouslySetInnerHTML={{ __html: ICONS[action.icon] }}
                />
                <span className="text-[10px] uppercase tracking-[0.15em]">{action.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </section>

      {/* Status indicators */}
      {stats && (
        <section className="grid gap-4 sm:grid-cols-2 mb-8">
          <StatusCard
            label="Rejected Payments"
            value={String(stats.rejectedPayments)}
            severity={stats.rejectedPayments > 0 ? "high" : "ok"}
            description="EFT payments rejected — review proof"
          />
          <StatusCard
            label="Low Stock"
            value={String(stats.lowStockProducts)}
            severity={stats.lowStockProducts > 0 ? "medium" : "ok"}
            description="Products with ≤2 units remaining"
          />
          <StatusCard
            label="Out of Stock"
            value={String(stats.outOfStockProducts)}
            severity={stats.outOfStockProducts > 0 ? "high" : "ok"}
            description="Products unavailable for purchase"
          />
        </section>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedAlert ? selectedAlert.title : ""}
      >
        {selectedAlert && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">{selectedAlert.description}</p>
            <p className="text-xs text-muted-foreground">
              Entity: {selectedAlert.entityId} · {new Date(selectedAlert.createdAt || Date.now()).toLocaleString()}
            </p>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Dismiss
              </Button>
              {selectedAlert.type === "payment_rejected" && (
                <Link href={`/store/admin/orders/${selectedAlert.entityId}`}>
                  <Button variant="primary">Review Order</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </Modal>
    </StoreShell>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon,
  variant = "default",
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: string;
  variant?: "default" | "warning";
}) {
  return (
    <article className="panel rounded-xl border border-border p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground">{sublabel}</p>
        </div>
        <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-surface-deep">
          <span
            className="w-4 h-4 shrink-0"
            dangerouslySetInnerHTML={{ __html: ICONS[icon] }}
          />
        </span>
      </div>
    </article>
  );
}

function AlertRow({
  alert,
  onSelect,
}: {
  alert: DashboardAlert;
  onSelect: (a: DashboardAlert) => void;
}) {
  const isHigh = alert.severity === "high";
  return (
    <article
      className="panel rounded-lg border border-border p-3 cursor-pointer hover:bg-surface-deep transition-colors"
      onClick={() => onSelect(alert)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold rounded px-2 py-0.5 ${
              isHigh
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-primary/10 text-primary border border-primary/20"
            }`}
          >
            {alert.type.replace(/_/g, " ").toUpperCase()}
          </span>
          {isHigh && (
            <span className="text-[9px] text-destructive font-bold">HIGH</span>
          )}
        </div>
        <span className="text-[10px] text-ink-faint">{new Date(alert.createdAt || Date.now()).toLocaleDateString()}</span>
      </div>
      <p className="text-sm text-foreground">{alert.title}</p>
      <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
    </article>
  );
}

function StatusCard({
  label,
  value,
  severity,
  description,
}: {
  label: string;
  value: string;
  severity: "high" | "medium" | "ok";
  description: string;
}) {
  const color =
    severity === "high"
      ? "text-destructive border border-destructive/20"
      : severity === "medium"
        ? "text-ink-faint border border-border"
        : "text-primary border border-primary/20";
  return (
    <article className={`panel rounded-xl border p-6 ${color}`}>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
        <span className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-surface-deep ${
          severity === "high" ? "text-destructive" : severity === "medium" ? "text-ink-faint" : "text-primary"
        }`}>
          {severity === "high" ? "!" : severity === "medium" ? "-" : "✓"}
        </span>
      </div>
    </article>
  );
}

const ICONS: Record<string, string> = {
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" ry="1"/><rect x="14" y="3" width="7" height="7" rx="1" ry="1"/><rect x="14" y="14" width="7" height="7" rx="1" ry="1"/><rect x="3" y="14" width="7" height="7" rx="1" ry="1"/></svg>`,
  admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  owner: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15l1 2L16 6l2 1.4V19c0 .55-.45 1-1 1h-5z"/></svg>`,
  person: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"><circle cx="12" cy="7" r="4"/></path></svg>`,
};
