/** VANTA GARAGE — admin support tickets.
 * /store/admin/support
 * Admin: view all tickets, assign staff, respond, resolve.
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

type Ticket = {
  id: string;
  ticketNumber: string;
  customerId: number;
  category: string;
  description: string;
  status: string;
  assignedStaffId: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      setLoading(true);
      const res = await fetch("/api/store/admin/support/tickets");
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = await res.json();
      setTickets(data.tickets ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }

  async function assignTicket(ticketId: string, staffId: string) {
    try {
      const res = await fetch(`/api/store/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedStaffId: staffId }),
      });
      if (!res.ok) throw new Error("Failed to assign ticket");
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign ticket.");
    }
  }

  async function resolveTicket(ticketId: string) {
    if (!window.confirm("Mark this ticket as resolved?")) return;
    try {
      const res = await fetch(`/api/store/admin/support/tickets/${ticketId}/resolve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to resolve ticket");
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve ticket.");
    }
  }

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="AS" title="Admin Support" backHref="/store/admin" />
        <p className="text-muted-foreground">Loading tickets…</p>
      </StoreShell>
    );
  }

  const openTickets = tickets.filter((t) => t.status !== "resolved");
  const resolvedTickets = tickets.filter((t) => t.status === "resolved");

  return (
    <StoreShell>
      <PageHeading folio="AS" title="Admin Support" backHref="/store/admin" />

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Open tickets */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Open Tickets</h3>
          <span className="text-xs font-bold text-destructive">
            {openTickets.length}
          </span>
        </div>
        {openTickets.length === 0 ? (
          <p className="text-muted-foreground">No open tickets.</p>
        ) : (
          <div className="space-y-3">
            {openTickets.map((t) => (
              <AdminTicketRow
                key={t.id}
                ticket={t}
                onAssign={assignTicket}
                onResolve={resolveTicket}
              />
            ))}
          </div>
        )}
      </section>

      {/* Resolved tickets */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Resolved</h3>
          <span className="text-xs text-muted-foreground">{resolvedTickets.length}</span>
        </div>
        {resolvedTickets.length === 0 ? (
          <p className="text-muted-foreground">No resolved tickets.</p>
        ) : (
          <div className="space-y-3">
            {resolvedTickets.map((t) => (
              <AdminTicketRow key={t.id} ticket={t} />
            ))}
          </div>
        )}
      </section>
    </StoreShell>
  );
}

function AdminTicketRow({
  ticket,
  onAssign,
  onResolve,
}: {
  ticket: Ticket;
  onAssign?: (id: string, staffId: string) => void;
  onResolve?: (id: string) => void;
}) {
  return (
    <article className="panel rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-mono text-muted-foreground">
          #{ticket.ticketNumber}
        </span>
        <span
          className={`text-[9px] font-bold rounded px-2 py-0.5 ${
              ticket.status === "resolved"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-ink-faint/10 text-ink-faint border border-ink-faint/20"
            }`}
        >
          {ticket.status.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm text-muted-foreground">
          Customer #{ticket.customerId} · {ticket.category}
        </p>
        <span className="text-xs text-ink-faint">
          {new Date(ticket.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="text-xs text-foreground mb-3">{ticket.description}</p>
      {onAssign && onResolve && (
        <div className="flex gap-2">
          <select
            defaultValue={ticket.assignedStaffId ?? ""}
            className="border border-border bg-surface-deep rounded px-2 py-1 text-[10px] focus:outline-none focus:border-gold"
            onChange={(e) =>
              onAssign(ticket.id, e.target.value || "")
            }
          >
            <option value="">Unassigned</option>
            <option value="admin_1">Admin 1</option>
            <option value="admin_2">Admin 2</option>
            <option value="owner">Owner</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => onResolve(ticket.id)}>
            Resolve
          </Button>
        </div>
      )}
    </article>
  );
}
