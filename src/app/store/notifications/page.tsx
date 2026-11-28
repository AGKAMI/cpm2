/** VANTA GARAGE — full notifications list.
 * /store/notifications
 * Customer: read every notification, mark one or all as read.
 * The header bell popover shows the latest few; this is the full page
 * behind its "View all" link.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { NotificationsSkeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/Button";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedProductId?: number;
  relatedOrderId?: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const customerId =
    typeof window !== "undefined"
      ? Number(localStorage.getItem("vanta_customer_id") || "0")
      : 0;

  const load = useCallback(async () => {
    if (!customerId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/store/customers/${customerId}/notifications/list`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const markAllRead = async () => {
    if (!customerId) return;
    try {
      const res = await fetch(
        `/api/store/customers/${customerId}/notifications/read-all`,
        { method: "PATCH", credentials: "include" },
      );
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        localStorage.setItem("vanta_notifications_unread", "0");
      }
    } catch {
      // Non-fatal — the list still renders
    }
  };

  const markOneRead = async (id: number) => {
    if (!customerId) return;
    try {
      const res = await fetch(
        `/api/store/customers/${customerId}/notifications/${id}/read`,
        { method: "PATCH", credentials: "include" },
      );
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
        const next = Math.max(0, Number(localStorage.getItem("vanta_notifications_unread") || "0") - 1);
        localStorage.setItem("vanta_notifications_unread", String(next));
      }
    } catch {
      // Non-fatal
    }
  };

  const unread = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="NT" title="Notifications" />
        <NotificationsSkeleton />
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <PageHeading folio="NT" title="Notifications" />

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground">
          {notifications.length} total · {unread} unread
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={markAllRead}
          disabled={unread === 0}
        >
          Mark all as read
        </Button>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {notifications.length === 0 ? (
        <section className="panel rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">No notifications yet.</p>
        </section>
      ) : (
        <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-raised">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markOneRead(n.id)}
              disabled={n.isRead}
              className={`text-left px-4 py-3 border-b border-border last:border-b-0 transition-colors ${
                n.isRead
                  ? "text-muted-foreground cursor-default"
                  : "text-foreground cursor-pointer hover:bg-surface-deep"
              }`}
            >
              <div className="flex justify-between items-start gap-3 mb-1">
                <span className="text-sm font-medium flex items-center gap-2">
                  {!n.isRead && (
                    <span className="inline-block w-2 h-2 rounded-full bg-gold shrink-0" />
                  )}
                  {n.title}
                </span>
                <span className="text-[10px] text-ink-faint shrink-0">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-ink-soft">{n.message}</p>
            </button>
          ))}
        </div>
      )}
    </StoreShell>
  );
}
