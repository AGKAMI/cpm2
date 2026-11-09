"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Notification bell with unread count badge.
 * Pure UI — no backend dependency. Reads/writes unread count to localStorage
 * so it persists across refreshes until Nemotron's notifications API is wired up.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem("vanta_notifications_unread");
    if (stored) {
      setUnread(parseInt(stored, 10) || 0);
    }
  }, []);

  const markRead = useCallback(() => {
    setUnread(0);
    localStorage.setItem("vanta_notifications_unread", "0");
  }, []);

  const increment = useCallback((n = 1) => {
    const next = unread + n;
    setUnread(next);
    localStorage.setItem("vanta_notifications_unread", String(next));
  }, [unread]);

  return (
    <button
      type="button"
      onClick={markRead}
      className="relative w-10 h-10 rounded-full border border-border bg-background flex items-center justify-center text-ink-soft hover:border-gold hover:text-gold transition-colors"
      aria-label="Notifications"
      aria-expanded={unread > 0}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    </button>
  );
}
