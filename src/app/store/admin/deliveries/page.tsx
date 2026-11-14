/** VANTA GARAGE — admin delivery management.
 * /store/admin/deliveries
 * Admin: view all appointments, verify delivery evidence.
 */

"use client";



import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

type AdminAppointment = {
  id: string;
  orderId: string;
  customerId: number;
  customerName: string;
  productName: string;
  scheduledAt: string;
  status: string;
  deliveryEvidence: string | null;
  customerConfirmed: boolean;
};

export default function AdminDeliveriesPage() {
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAppointments() {
    try {
      setLoading(true);
      const res = await fetch("/api/store/admin/appointments", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load deliveries");
      const data = await res.json();
      setAppointments(data.appointments ?? data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deliveries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAppointments();
  }, []);

  async function verifyDelivery(appointmentId: string) {
    if (!window.confirm("Mark this delivery as verified?")) return;
    try {
      const res = await fetch(`/api/store/admin/orders/${appointmentId}/delivery-evidence`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to verify delivery");
      await loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify delivery.");
    }
  }

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="AD" title="Admin Deliveries" backHref="/store/admin/dashboard" />
        <p className="text-muted-foreground">Loading deliveries…</p>
      </StoreShell>
    );
  }

  if (error) {
    return (
      <StoreShell>
        <PageHeading folio="AD" title="Admin Deliveries" backHref="/store/admin/dashboard" />
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      </StoreShell>
    );
  }

  const pending = appointments.filter(
    (a) => a.status === "scheduled"
  );
  const completed = appointments.filter(
    (a) => a.status !== "scheduled"
  );

  return (
    <StoreShell>
      <PageHeading folio="AD" title="Admin Deliveries" backHref="/store/admin/dashboard" />

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Pending Deliveries</h3>
          <span className="text-xs font-bold text-destructive">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <p className="text-muted-foreground">No pending deliveries.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <AdminDeliveryCard key={a.id} appointment={a} onVerify={verifyDelivery} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Completed</h3>
          <span className="text-xs text-muted-foreground">{completed.length}</span>
        </div>
        {completed.length === 0 ? (
          <p className="text-muted-foreground">No completed deliveries.</p>
        ) : (
          <div className="space-y-3">
            {completed.map((a) => (
              <AdminDeliveryCard key={a.id} appointment={a} />
            ))}
          </div>
        )}
      </section>
    </StoreShell>
  );
}

function AdminDeliveryCard({
  appointment,
  onVerify,
}: {
  appointment: AdminAppointment;
  onVerify?: (id: string) => void;
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
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {appointment.status.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm text-muted-foreground">
          {appointment.productName} — Customer #{appointment.customerId}
        </p>
        <span className="text-xs text-ink-faint">
          {new Date(appointment.scheduledAt).toLocaleString()}
        </span>
      </div>
      {appointment.deliveryEvidence && (
        <div className="mb-3 p-3 rounded-lg bg-surface-deep border border-border/50">
          <p className="text-xs font-semibold text-foreground mb-1">
            Delivery Evidence Uploaded
          </p>
        </div>
      )}
      {!isCompleted && onVerify && (
        <Button variant="outline" size="sm" onClick={() => onVerify(appointment.id)}>
          Verify Delivery
        </Button>
      )}
    </article>
  );
}
