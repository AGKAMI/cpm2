"use client";

/**
 * VANTA GARAGE — animated order progress.
 *
 * Maps the REAL order lifecycle (vanta_orders.order_state) to steps and
 * animates the fill + active step so the bar visibly advances when the
 * state changes (polling in the parent keeps it live).
 */

export const ORDER_LIFECYCLE = [
  { key: "checkout_initiated", label: "Order placed", hint: "We have your order" },
  { key: "awaiting_payment", label: "Payment pending", hint: "EFT proof or card confirmation" },
  { key: "payment_verification", label: "Verifying payment", hint: "Confirming your payment" },
  { key: "payment_confirmed", label: "Payment confirmed", hint: "Payment received" },
  { key: "processing", label: "Preparing", hint: "Build in the garage" },
  { key: "delivery_scheduled", label: "Delivery scheduled", hint: "Appointment set" },
  { key: "awaiting_delivery", label: "Awaiting delivery", hint: "Ready for you" },
  { key: "delivery_in_progress", label: "Delivering", hint: "On the way to your garage" },
  { key: "delivery_verified", label: "Delivered", hint: "Vehicle in your garage" },
  { key: "completed", label: "Completed", hint: "Order fulfilled" },
] as const;

const TERMINAL: Record<string, { label: string; tone: "red" | "amber" }> = {
  cancelled: { label: "Cancelled", tone: "red" },
  refund_pending: { label: "Refund pending", tone: "amber" },
  refunded: { label: "Refunded", tone: "amber" },
  disputed: { label: "Disputed", tone: "red" },
};

/** Step index for an order — falls back to the payment state when the
 *  order state is not on the happy path (pending → awaiting payment). */
export function orderStepIndex(orderState: string, paymentState: string): number {
  const terminal = TERMINAL[orderState];
  if (terminal) return -1;
  const direct = ORDER_LIFECYCLE.findIndex((s) => s.key === orderState);
  if (direct >= 0) return direct;
  if (paymentState === "verified") return ORDER_LIFECYCLE.findIndex((s) => s.key === "payment_confirmed");
  if (paymentState === "pending") return ORDER_LIFECYCLE.findIndex((s) => s.key === "awaiting_payment");
  return 0;
}

export function orderTerminal(orderState: string) {
  return TERMINAL[orderState] ?? null;
}

/** Full animated bar for the order detail page. */
export function OrderProgress({
  orderState,
  paymentState,
}: {
  orderState: string;
  paymentState: string;
}) {
  const terminal = orderTerminal(orderState);
  const index = orderStepIndex(orderState, paymentState);
  const total = ORDER_LIFECYCLE.length;
  const pct = terminal ? 100 : (index / (total - 1)) * 100;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {terminal ? terminal.label : ORDER_LIFECYCLE[Math.max(index, 0)].label}
        </span>
        <span className="num text-[10px] text-muted-foreground">
          {terminal ? "—" : `Step ${index + 1} of ${total}`}
        </span>
      </div>

      {/* Track + animated fill */}
      <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${
            terminal
              ? terminal.tone === "red"
                ? "bg-destructive"
                : "bg-warn"
              : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        >
          {!terminal && (
            <span className="absolute inset-0 overflow-hidden rounded-full" aria-hidden="true">
              <span className="absolute inset-y-0 -left-1/3 w-1/3 animate-progress-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </span>
          )}
        </div>
      </div>

      {/* Step dots */}
      <div className="relative mt-2 flex justify-between">
        {ORDER_LIFECYCLE.map((step, i) => {
          const done = !terminal && i < index;
          const active = !terminal && i === index;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1" title={step.hint}>
              <span
                className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                  done
                    ? "bg-primary"
                    : active
                      ? "bg-primary animate-pulse-ring"
                      : terminal
                        ? terminal.tone === "red"
                          ? "bg-destructive/40"
                          : "bg-warn/40"
                        : "bg-muted"
                }`}
              />
              <span
                className={`hidden sm:block text-[8px] uppercase tracking-[0.08em] ${
                  active ? "text-foreground font-bold" : "text-muted-foreground"
                }`}
              >
                {step.label.split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>

      {!terminal && (
        <p className="mt-2 text-[10px] text-muted-foreground">{ORDER_LIFECYCLE[Math.max(index, 0)].hint}</p>
      )}
    </div>
  );
}

/** Slim variant for the orders list rows. */
export function OrderProgressSlim({
  orderState,
  paymentState,
}: {
  orderState: string;
  paymentState: string;
}) {
  const terminal = orderTerminal(orderState);
  const index = orderStepIndex(orderState, paymentState);
  const total = ORDER_LIFECYCLE.length;
  const pct = terminal ? 100 : (index / (total - 1)) * 100;

  return (
    <div className="w-full">
      <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${
            terminal ? (terminal.tone === "red" ? "bg-destructive" : "bg-warn") : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        <span>{terminal ? terminal.label : ORDER_LIFECYCLE[Math.max(index, 0)].label}</span>
        <span className="num">{terminal ? "" : `${index + 1}/${total}`}</span>
      </div>
    </div>
  );
}
