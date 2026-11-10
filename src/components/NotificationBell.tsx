"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * VANTA GARAGE — Notification bell with real backend.
 * Fetches unread count from /api/store/customers/[id]/notifications/list
 * Marks all as read on click via /api/store/customers/[id]/notifications/read-all
 * Falls back to localStorage only if the API is unreachable.
 */

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

export function NotificationBell() {
  const [unread, setUnread] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const customerId =
    typeof window !== "undefined"
      ? Number(localStorage.getItem("vanta_customer_id") || "0")
      : 0;

  const fetchNotifications = useCallback(async () => {
    if (!customerId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/store/customers/${customerId}/notifications/list`,
        { credentials: "include", cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnread(data.unreadCount || 0);
      } else {
        const stored = localStorage.getItem("vanta_notifications_unread");
        setUnread(stored ? parseInt(stored, 10) || 0 : 0);
      }
    } catch {
      const stored = localStorage.getItem("vanta_notifications_unread");
      setUnread(stored ? parseInt(stored, 10) || 0 : 0);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = useCallback(async () => {
    if (!customerId) return;
    try {
      const res = await fetch(
        `/api/store/customers/${customerId}/notifications/read-all`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );
      if (res.ok) {
        setUnread(0);
        setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
        localStorage.setItem("vanta_notifications_unread", "0");
      }
    } catch {
      setUnread(0);
      localStorage.setItem("vanta_notifications_unread", "0");
    }
  }, [customerId, notifications]);

  const markOneRead = useCallback(
    async (id: number) => {
      if (!customerId) return;
      try {
        await fetch(
          `/api/store/customers/${customerId}/notifications/${id}/read`,
          {
            method: "PATCH",
            credentials: "include",
          },
        );
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
        setUnread((prev) => Math.max(0, prev - 1));
        localStorage.setItem(
          "vanta_notifications_unread",
          String(Math.max(0, unread - 1)),
        );
      } catch {
        // Non-fatal
      }
    },
    [customerId, unread],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 rounded-full border border-border bg-background flex items-center justify-center text-ink-soft hover:border-gold hover:text-gold transition-colors disabled:opacity-50"
        aria-label="Notifications"
        aria-expanded={open}
        disabled={loading}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -right-1 -top-1 w-4 h-4 rounded-full bg-destructive border-2 border-background text-[9px] font-bold flex items-center justify-center text-background"
            aria-label={`${unread} unread`}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
        {loading && (
          <span className="absolute -top-2 -right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-lg border border-border bg-background shadow-lg z-50 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            <button
              onClick={markAllRead}
              className="text-[10px] text-gold font-medium hover:underline"
              disabled={unread === 0}
            >
              Mark all as read
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-4 text-center text-xs text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-border cursor-pointer hover:bg-surface-deep transition-colors ${n.isRead ? "text-muted-foreground" : "text-foreground"}`}
                  onClick={() => markOneRead(n.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-[10px] text-ink-faint">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft">{n.message}</p>
                  {!n.isRead && (
                    <span className="inline-block mt-1 w-2 h-2 rounded-full bg-gold" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
