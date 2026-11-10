/** VANTA GARAGE — customer appointments & delivery tracking.
 * /store/appointments
 * Customer: view upcoming and past delivery appointments.
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

type Appointment = {
  id: string;
  orderId: string;
  productName: string;
  scheduledAt: string;
  status: string;
  deliveryEvidence: string | null;
  customerConfirmed: boolean;
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAppointments();
  }, []);

  async function loadAppointments() {
    try {
      setLoading(true);
      const res = await fetch("/api/store/appointments", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load appointments");
      const data = await res.json();
      setAppointments(data.appointments ?? data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load appointments.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelivery(appointmentId: string) {
    if (!window.confirm("Confirm you received the vehicle?")) return;
    try {
      const res = await fetch(`/api/store/appointments/${appointmentId}/confirm`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to confirm delivery");
      await loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm delivery.");
    }
  }

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="AP" title="Appointments" backHref="/store/dashboard" />
        <p className="text-muted-foreground">Loading appointments…</p>
      </StoreShell>
    );
  }

  if (error) {
    return (
      <StoreShell>
        <PageHeading folio="AP" title="Appointments" backHref="/store/dashboard" />
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      </StoreShell>
    );
  }

  const upcoming = appointments.filter(
    (a) => a.status !== "completed" && a.status !== "missed"
  );
  const completed = appointments.filter(
    (a) => a.status === "completed"
  );

  return (
    <StoreShell>
      <PageHeading folio="AP" title="Appointments" backHref="/store/dashboard" />

      <section className="mb-8">
        <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground">No upcoming deliveries.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} appointment={a} onConfirm={confirmDelivery} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">Completed</h3>
        {completed.length === 0 ? (
          <p className="text-muted-foreground">No completed deliveries.</p>
        ) : (
          <div className="space-y-3">
            {completed.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </div>
        )}
      </section>
    </StoreShell>
  );
}

function AppointmentCard({
  appointment,
  onConfirm,
}: {
  appointment: Appointment;
  onConfirm?: (id: string) => void;
}) {
  const isCompleted = appointment.status === "completed";
  return (
    <article className="panel rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-mono text-muted-foreground">
          Order #{appointment.orderId}
        </span>
        <span
          className={`text-[9px] font-bold rounded px-2 py-0.5 ${
            isCompleted
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-ink-faint/10 text-ink-faint border border-ink-faint/20"
          }`}
        >
          {appointment.status.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm text-muted-foreground">{appointment.productName}</p>
        <span className="text-xs text-ink-faint">
          {new Date(appointment.scheduledAt).toLocaleString()}
        </span>
      </div>
      {!isCompleted && appointment.deliveryEvidence && (
        <div className="mb-3 p-3 rounded-lg bg-surface-deep border border-border/50">
          <p className="text-xs font-semibold text-foreground mb-1">
            Delivery Evidence
          </p>
          <p className="text-xs text-muted-foreground">
            Evidence uploaded by admin — confirm receipt below.
          </p>
        </div>
      )}
      {!isCompleted && onConfirm && appointment.deliveryEvidence && (
        <Button variant="outline" size="sm" onClick={() => onConfirm(appointment.id)}>
          Confirm Receipt
        </Button>
      )}
    </article>
  );
}
