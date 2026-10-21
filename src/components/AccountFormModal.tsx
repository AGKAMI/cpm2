"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, NumericInput, TextArea, TextInput } from "@/components/ui/Field";
import { LIMITS, carCapacity, formatNumber } from "@/lib/constants";
import { accountCreateSchema } from "@/lib/validation";
import { ApiRequestError } from "@/lib/client";
import type { AccountSummary } from "@/lib/types";

type AccountFormModalProps = {
  open: boolean;
  account: AccountSummary | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
};

type Issue = { path: PropertyKey[]; message: string };

function mapIssues(issues: Issue[]): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.join(".") : "form";
    if (!mapped[key]) mapped[key] = issue.message;
  }
  return mapped;
}

export function AccountFormModal({ open, account, onClose, onSubmit }: AccountFormModalProps) {
  const [email, setEmail] = useState(account?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cash, setCash] = useState(account?.cash ?? 0);
  const [coins, setCoins] = useState(account?.coins ?? 0);
  const [cars, setCars] = useState(account?.cars ?? 0);
  const [slots, setSlots] = useState(account?.slots ?? 0);
  const [coinsSpentOnCars, setCoinsSpentOnCars] = useState(account?.coinsSpentOnCars ?? 0);
  const [notes, setNotes] = useState(account?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const editing = account !== null;

  const capacity = carCapacity(slots);
  const carsOverflow = cars > capacity;

  /** Move the caret to whatever went wrong first — never leave the user guessing. */
  function focusFirstError(issues: Record<string, string>) {
    const order = ["email", "password", "cash", "coins", "cars", "slots", "notes"];
    const first = order.find((field) => issues[field]);
    if (!first) return;
    const field = document.getElementById(`account-${first}`);
    if (field instanceof HTMLElement) {
      field.focus();
      field.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});

    const payload: Record<string, unknown> = { email, cash, coins, cars, slots, coinsSpentOnCars, notes };
    if (password) payload.password = password;

    if (!editing) {
      const result = accountCreateSchema.safeParse(payload);
      if (!result.success) {
        const issues = mapIssues(result.error.issues as Issue[]);
        setErrors(issues);
        focusFirstError(issues);
        return;
      }
    } else {
      const next: Record<string, string> = {};
      const trimmedEmail = email.trim();
      if (!trimmedEmail) next.email = "Email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
        next.email = "Enter a valid email address.";
      }
      if (cash < 0) next.cash = "Cash cannot be negative.";
      else if (cash > LIMITS.MAX_CASH) next.cash = `Cash cannot exceed ${formatNumber(LIMITS.MAX_CASH)}.`;
      if (coins < 0) next.coins = "Coins cannot be negative.";
      else if (coins > LIMITS.MAX_COINS) {
        next.coins = `Coins cannot exceed ${formatNumber(LIMITS.MAX_COINS)}.`;
      }
      if (slots < 0) next.slots = "Slots cannot be negative.";
      else if (slots > LIMITS.MAX_PURCHASED_SLOTS) {
        next.slots = `Extra slots cannot exceed ${LIMITS.MAX_PURCHASED_SLOTS} per account.`;
      } else if (account && slots > account.slots) {
        next.slots = `Extra slots can only be bought (${LIMITS.SLOT_COST_COINS} coins each) — use the “Buy slot” button.`;
      }
      if (cars < 0) next.cars = "Cars cannot be negative.";
      else if (cars > capacity) {
        next.cars = `Cars cannot exceed ${capacity} with ${slots} extra slot(s).`;
      }
      if (password.length > LIMITS.MAX_PASSWORD_LENGTH) {
        next.password = `Password must be ${LIMITS.MAX_PASSWORD_LENGTH} characters or fewer.`;
      }
      if (Object.keys(next).length > 0) {
        setErrors(next);
        focusFirstError(next);
        return;
      }
    }

    setSaving(true);
    try {
      const done = await onSubmit(payload);
      if (done) onClose();
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setErrors(err.fields);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit account" : "Track new account"}
      subtitle={
        editing
          ? "Change balances, credentials or garage. Password stays as-is unless you replace it."
          : "Log an account you made so the fleet always knows who owns what."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="account-form" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add to fleet"}
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="account-email" error={errors.email}>
          <TextInput
            id="account-email"
            name="email"
            type="email"
            value={email}
            autoComplete="email"
            spellCheck={false}
            placeholder="driver@cpm2.gg"
            invalid={Boolean(errors.email)}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="account-password"
          error={errors.password}
          hint={editing ? "blank = keep current" : undefined}
        >
          <div className="relative">
            <TextInput
              id="account-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              autoComplete="new-password"
              placeholder={editing ? "••••••••" : "game password"}
              invalid={Boolean(errors.password)}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1.5 inline-flex min-h-[24px] items-center font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint transition hover:text-racing"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Cash"
            htmlFor="account-cash"
            error={errors.cash}
            hint={`max ${formatNumber(LIMITS.MAX_CASH)}`}
            meter={{ value: cash, max: LIMITS.MAX_CASH, tone: "racing" }}
          >
            <NumericInput
              id="account-cash"
              value={cash}
              onChange={setCash}
              max={LIMITS.MAX_CASH}
              invalid={Boolean(errors.cash)}
              suffix="CASH"
            />
          </Field>

          <Field
            label="Coins"
            htmlFor="account-coins"
            error={errors.coins}
            hint={`max ${formatNumber(LIMITS.MAX_COINS)}`}
            meter={{ value: coins, max: LIMITS.MAX_COINS, tone: "brass" }}
          >
            <NumericInput
              id="account-coins"
              value={coins}
              onChange={setCoins}
              max={LIMITS.MAX_COINS}
              invalid={Boolean(errors.coins)}
              suffix="COINS"
            />
          </Field>

          <Field
            label="Cars"
            htmlFor="account-cars"
            error={errors.cars}
            hint={carsOverflow ? `garage holds ${capacity}` : `${cars} of ${capacity} slots used`}
          >
            <NumericInput
              id="account-cars"
              value={cars}
              onChange={setCars}
              invalid={Boolean(errors.cars)}
              suffix="CARS"
            />
          </Field>

          <Field
            label="Coins spent on cars"
            htmlFor="account-coins-spent"
            error={errors.coinsSpentOnCars}
            hint="ledger only — keeps the fleet stats honest"
          >
            <NumericInput
              id="account-coins-spent"
              value={coinsSpentOnCars}
              onChange={setCoinsSpentOnCars}
              max={LIMITS.MAX_COINS}
              invalid={Boolean(errors.coinsSpentOnCars)}
              suffix="COINS"
            />
          </Field>

          <Field
            label="Extra car slots"
            htmlFor="account-slots"
            error={errors.slots}
            hint={
              editing && account && slots > account.slots
                ? "buy with the slot button"
                : `${LIMITS.MAX_PURCHASED_SLOTS} max · ${LIMITS.SLOT_COST_COINS} coins each`
            }
          >
            <NumericInput
              id="account-slots"
              value={slots}
              onChange={setSlots}
              max={LIMITS.MAX_PURCHASED_SLOTS}
              invalid={Boolean(errors.slots)}
              suffix="SLOTS"
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="account-notes" error={errors.notes} hint="optional">
          <TextArea
            id="account-notes"
            value={notes}
            onChange={setNotes}
            placeholder="Which device / region / what it is used for"
          />
        </Field>

        {errors.form ? (
          <p className="rounded-[8px] border border-oxblood/35 bg-oxblood/8 px-3 py-2 text-xs text-oxblood">
            {errors.form}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
