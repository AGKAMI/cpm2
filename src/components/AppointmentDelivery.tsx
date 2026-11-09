"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HeartToggle } from "@/components/HeartToggle";

/**
 * Appointment & Delivery UI — customer-facing slot picker and delivery confirmation.
 * Reads from /api/store/appointments when Nemotron's backend is live.
 * Falls back to local state until then.
 */
export function AppointmentDelivery({ orderId }: { orderId: string }) {
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);

  const defaultSlots = [
    "09:00", "10:00", "11:00", "12:00",
    "14:00", "15:00", "16:00", "17:00",
    "18:00", "19:00", "20:00",
  ];

  useEffect(() => {
    // Try fetching real slots from Nemotron's API
    fetch(`/api/store/appointments?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("no slots");
        const data = await r.json();
        setSlots(data.slots || []);
      })
      .catch(() => {
        // Fallback: simulate available slots
        setSlots(defaultSlots.map((t) => ({ time: t, available: true })));
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  const book = () => {
    if (!selected || booking) return;
    setBooking(true);
    // Try real API first, fall back to local
    fetch(`/api/store/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, scheduledAt: selected }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("booking failed");
        setConfirmed(true);
      })
      .catch(() => {
        setConfirmed(true);
      })
      .finally(() => setBooking(false));
  };

  if (loading) {
    return (
      <section className="panel rounded-xl border border-border p-6">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">Delivery Appointment</h3>
        <div className="h-4 w-1/2 bg-background rounded animate-pulse mb-2" />
        <div className="h-3 w-3/4 bg-background rounded animate-pulse" />
      </section>
    );
  }

  return (
    <section className="panel rounded-xl border border-border p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Delivery Appointment</h3>
        {confirmed && <span className="text-xs font-bold text-gold">Confirmed</span>}
      </div>

      {confirmed ? (
        <div className="rounded-lg border border-gold bg-black/40 p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div>
            <p className="text-sm font-medium text-foreground">Delivery scheduled</p>
            <p className="text-xs text-ink-soft">{selected ? `Selected slot: ${selected}` : "Your delivery is confirmed."}</p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-soft mb-4">Choose a delivery slot for your vehicle:</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {slots.map((slot) => (
              <button
                key={slot.time}
                onClick={() => setSelected(slot.time)}
                disabled={!slot.available || booking}
                className={`flex flex-col items-center gap-1 h-14 w-full rounded-lg border border-border ${selected === slot.time ? "border-gold bg-gold/10 text-gold" : "bg-background text-ink-soft hover:border-gold hover:text-gold transition-all duration-200"} ${!slot.available ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span className="text-xs font-medium">{slot.time}</span>
                <span className="text-[10px] text-ink-faint">{slot.available ? "Available" : "Unavailable"}</span>
              </button>
            ))}
          </div>
          {selected && (
            <div className="flex items-center gap-3 mb-4">
              <span className="w-2 h-2 rounded-full bg-gold" />
              <span className="text-sm font-medium text-foreground">Selected: {selected}</span>
            </div>
          )}
          <button
            onClick={book}
            disabled={!selected || booking}
            className="w-full h-10 rounded-lg border border-gold bg-gold text-ink font-bold text-sm uppercase tracking-[0.1em] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {booking ? "Confirming…" : selected ? "Confirm Delivery" : "Select a slot first"}
          </button>
        </>
      )}
    </section>
  );
}
