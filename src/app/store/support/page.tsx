/** VANTA GARAGE — customer support tickets.
 * /store/support
 * Customer: open ticket, attach evidence, view status.
 */

"use client";



import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { PanelListSkeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, TextArea } from "@/components/ui/Field";
import { telegramInitData } from "@/lib/store/client";

type Ticket = {
  id: string;
  ticketNumber: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

type TicketCategory = {
  value: string;
  label: string;
};

const TICKET_CATEGORIES: TicketCategory[] = [
  { value: "payment", label: "Payment" },
  { value: "delivery", label: "Delivery" },
  { value: "order", label: "Order" },
  { value: "account", label: "Account" },
  { value: "vehicle", label: "Vehicle" },
];

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    loadTickets();
  }, []);

  // Every other store call sends the Telegram initData; a raw fetch() without
  // it is anonymous inside the mini app, which returned 401 for signed-in
  // users ("Log in with Telegram" while they were already in Telegram).
  function authHeaders(): HeadersInit {
    const headers: Record<string, string> = {};
    const initData = telegramInitData();
    if (initData) headers["X-Telegram-Init-Data"] = initData;
    return headers;
  }

  async function loadTickets() {
    try {
      setLoading(true);
      const res = await fetch("/api/store/support/tickets", {
        credentials: "include",
        headers: authHeaders(),
      });
      // A guest (no linked customer) has no tickets yet — that is an empty
      // list, not a failure. Only surface real errors.
      if (res.status === 401) {
        setTickets([]);
        setError(null);
        return;
      }
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

  async function openTicket(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!category || !description.trim()) {
      setError("Please select a category and describe your issue.");
      return;
    }
    setOpening(true);
    try {
      const res = await fetch("/api/store/support/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ category, description }),
      });
      if (res.status === 401) {
        // Tell the truth about WHY: a Telegram session needs the mini app's
        // initData (a stale header or a signed-out browser lands here), not a
        // demand to "log in with Telegram" for someone already inside it.
        throw new Error(
          "Your session could not be verified. Reopen the store from Telegram, or sign in again.",
        );
      }
      if (!res.ok) throw new Error("Failed to create ticket");
      const data = await res.json();
      setMsg(`Ticket ${data.ticket?.ticketNumber} opened.`);
      setCategory("");
      setDescription("");
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open ticket.");
    } finally {
      setOpening(false);
    }
  }

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="SP" title="Support" backHref="/store" />
        <PanelListSkeleton />
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <PageHeading folio="SP" title="Support" backHref="/store" />

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {msg && (
        <p className="mb-4 rounded-md border border-primary bg-primary px-3 py-2 text-xs text-primary">
          {msg}
        </p>
      )}

      {/* Open ticket form */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-foreground mb-4">New Support Ticket</h3>
        <form onSubmit={openTicket} className="space-y-3">
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex-1 border border-border bg-surface-deep rounded px-3 py-2 text-sm focus:outline-none focus:border-gold"
            >
              <option value="">Select category</option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description" hint="What happened? Order ID, dates, etc.">
            <TextArea
              value={description}
              onChange={(value: string) => setDescription(value)}
              rows={4}
            />
          </Field>
          <Button type="submit" variant="primary" disabled={opening || !category || !description.trim()}>
            {opening ? "Opening…" : "Open Ticket"}
          </Button>
        </form>
      </section>

      {/* My tickets */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">My Tickets</h3>
        {tickets.length === 0 ? (
          <p className="text-muted-foreground">No tickets yet. Open one above.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <article key={t.id} className="panel rounded-xl border border-border p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    #{t.ticketNumber}
                  </span>
                  <span
                    className={`text-[9px] font-bold rounded px-2 py-0.5 ${
                      t.status === "resolved"
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-ink-faint/10 text-ink-faint border border-ink-faint/20"
                    }`}
                  >
                    {t.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-foreground mb-1">{t.category.charAt(0).toUpperCase() + t.category.slice(1)}</p>
                <p className="text-xs text-muted-foreground mb-2">{t.description}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString()}{t.resolvedAt ? ` · Resolved ${new Date(t.resolvedAt).toLocaleDateString()}` : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </StoreShell>
  );
}
