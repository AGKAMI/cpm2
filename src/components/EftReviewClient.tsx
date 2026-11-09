"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { vantaApi, formatPrice, type VantaOrder } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput } from "@/components/ui/Field";

type OrderWithProduct = VantaOrder & { productName?: string; productPrice?: number };

export function EftReviewClient() {
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "verified" | "all">("pending");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Evidence modal state
  const [evidenceModal, setEvidenceModal] = useState(false);
  const [evidenceOrderId, setEvidenceOrderId] = useState<string | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { orders: os } = await vantaApi.adminOrders();
        const enriched = os.map((o) => ({
          ...o,
          productName: o.inGameName ? `Vehicle #${o.productId}` : `Vehicle #${o.productId}`,
          productPrice: o.amountCents,
        }));
        setOrders(enriched);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = orders.filter((o) => {
    if (tab === "pending") return o.paymentState === "pending";
    if (tab === "verified") return o.paymentState === "verified";
    return true;
  });

  const isBusy = (id: string) => busyIds.has(id);

  const handleVerify = async (order: VantaOrder) => {
    setBusyIds((prev) => new Set([...prev, order.id]));
    try {
      await vantaApi.verifyPayment(order.id);
      setOrders((curr) =>
        curr.map((o) =>
          o.id === order.id
            ? { ...o, paymentState: "verified", orderState: "payment_confirmed" }
            : o,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  const openReject = (orderId: string) => {
    setRejectOrderId(orderId);
    setRejectReason("");
    setRejectModal(true);
  };

  const closeReject = () => {
    setRejectModal(false);
    setRejectOrderId(null);
    setRejectReason("");
  };

  const handleRejectSubmit = async () => {
    if (!rejectOrderId) return;
    setBusyIds((prev) => new Set([...prev, rejectOrderId]));
    try {
      await vantaApi.rejectPayment(rejectOrderId, rejectReason || undefined);
      setOrders((curr) =>
        curr.map((o) =>
          o.id === rejectOrderId
            ? { ...o, paymentState: "rejected", orderState: "cancelled" }
            : o,
        ),
      );
      closeReject();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(rejectOrderId ?? "");
        return next;
      });
    }
  };

  const openEvidence = (orderId: string) => {
    setEvidenceOrderId(orderId);
    setEvidenceUrl("");
    setEvidenceModal(true);
  };

  const closeEvidence = () => {
    setEvidenceModal(false);
    setEvidenceOrderId(null);
    setEvidenceUrl("");
  };

  const handleEvidenceSubmit = async () => {
    if (!evidenceOrderId) return;
    if (!evidenceUrl.trim()) return;
    setBusyIds((prev) => new Set([...prev, evidenceOrderId]));
    try {
      await vantaApi.setDeliveryEvidence(evidenceOrderId, evidenceUrl.trim());
      setOrders((curr) =>
        curr.map((o) =>
          o.id === evidenceOrderId
            ? { ...o, orderState: "delivery_scheduled", appointmentId: "set" }
            : o,
        ),
      );
      closeEvidence();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evidence upload failed.");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(evidenceOrderId ?? "");
        return next;
      });
    }
  };

  if (loading)
    return (
      <StoreShell>
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel rounded-xl border border-border p-4">
              <div className="h-2 w-24 rounded-sm bg-background mb-3 animate-pulse" />
              <div className="h-3 w-32 rounded-sm bg-background animate-pulse" />
            </div>
          ))}
        </div>
      </StoreShell>
    );

  const pendingCount = orders.filter((o) => o.paymentState === "pending" && o.paymentMethod === "eft").length;

  return (
    <StoreShell>
      <PageHeading folio="05" title="EFT Review" meta={`${pendingCount} awaiting proof`} backHref="/store/admin" />

      {error && (
        <div className="p-4 rounded-md border border-destructive bg-destructive/10 text-xs text-destructive mb-4">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 px-4 mb-4 border-b border-border">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 text-xs font-bold rounded-md ${
            tab === "pending"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-ink-soft hover:bg-surface-deep"
          }`}
        >
          Awaiting proof ({pendingCount})
        </button>
        <button
          onClick={() => setTab("verified")}
          className={`px-4 py-2 text-xs font-bold rounded-md ${
            tab === "verified"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-ink-soft hover:bg-surface-deep"
          }`}
        >
          Verified
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-4 py-2 text-xs font-bold rounded-md ${
            tab === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-ink-soft hover:bg-surface-deep"
          }`}
        >
          All
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-ink-soft">
          <p className="text-sm">No orders match this filter.</p>
          {tab === "pending" && (
            <p className="text-[10px] mt-1">All EFT payments are up to date.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 px-4">
          {filtered.map((order) => (
            <EftOrderCard
              key={order.id}
              order={order}
              isBusy={isBusy(order.id)}
              onVerify={() => handleVerify(order)}
              onReject={() => openReject(order.id)}
              onEvidence={() => openEvidence(order.id)}
            />
          ))}
        </div>
      )}
      
      {/* Reject payment modal */}
      {rejectModal && (
        <>
          <Modal
            open={rejectModal}
            onClose={closeReject}
            title="Reject Payment"
            subtitle="Enter an optional reason for rejecting this EFT payment."
            width="max-w-md"
          >
            <Field label="Reason (optional)">
              <TextInput
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Proof of payment not received"
                className="flex-1"
              />
            </Field>
          </Modal>
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={closeReject} size="sm">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={busyIds.has(rejectOrderId ?? "")}
              size="sm"
            >
              Reject Payment
            </Button>
          </footer>
        </>
      )}

      {/* Delivery evidence modal */}
      {evidenceModal && (
        <>
          <Modal
            open={evidenceModal}
            onClose={closeEvidence}
            title="Add Delivery Evidence"
            subtitle="Paste a photo or screenshot link showing delivery was completed."
            width="max-w-md"
          >
            <Field label="Delivery evidence URL">
              <TextInput
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
            </Field>
          </Modal>
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={closeEvidence} size="sm">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleEvidenceSubmit}
              disabled={busyIds.has(evidenceOrderId ?? "") || !evidenceUrl.trim()}
              size="sm"
            >
              Save Evidence
            </Button>
          </footer>
        </>
      )}
    </StoreShell>
  );
}

function EftOrderCard({
  order,
  isBusy,
  onVerify,
  onReject,
  onEvidence,
}: {
  order: OrderWithProduct;
  isBusy: boolean;
  onVerify: () => void;
  onReject: () => void;
  onEvidence: () => void;
}) {
  const isEft = order.paymentMethod === "eft";
  const awaiting = order.paymentState === "pending" && isEft;
  const verified = order.paymentState === "verified";
  const rejected = order.paymentState === "rejected";
  const hasEvidence = Boolean(order.appointmentId);

  const stateVariant =
    awaiting ? "border-primary text-primary" : rejected ? "border-destructive text-destructive" : "border-border text-muted-foreground";

  return (
    <article className="group relative rounded-xl border border-border p-4 hover:border-primary">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="num text-xs text-muted-foreground">#{order.id.slice(-8)}</span>
        <span
          className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border ${stateVariant}`}
        >
          {order.paymentMethod.toUpperCase()} · {order.paymentState.replace("_", " ")}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="num text-sm font-medium text-foreground">{formatPrice(order.amountCents, order.currency)}</span>
        <span className="num text-xs text-muted-foreground">#{order.productId}</span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] mb-3">
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Player</span>
        <span className="num text-foreground">{order.playerId}</span>
        <span className="text-muted-foreground" aria-hidden="true">/</span>
        <span className="text-foreground">{order.inGameName}</span>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {awaiting && (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={onVerify}
              disabled={isBusy}
              className="w-full"
            >
              {isBusy ? "Verifying…" : "Verify payment"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              disabled={isBusy}
              className="w-full"
            >
              {isBusy ? "…" : "Reject"}
            </Button>
          </>
        )}
        {verified && !hasEvidence && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEvidence}
            disabled={isBusy}
            className="w-full col-span-2"
          >
            {isBusy ? "Uploading…" : "Add delivery evidence"}
          </Button>
        )}
        {verified && hasEvidence && (
          <span className="col-span-2 flex items-center justify-center gap-1 text-[10px] text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            Delivery evidence uploaded
          </span>
        )}
        {rejected && (
          <span className="col-span-2 flex items-center justify-center gap-1 text-[10px] text-destructive">
            Payment rejected — stock released
          </span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <Link
          href={`/store/orders/${order.id}`}
          className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-primary hover:underline cursor-pointer"
        >
          View order
        </Link>
        <span aria-hidden="true" className="num text-[11px] text-muted-foreground">
          &rarr;
        </span>
      </div>
    </article>
  );
}
