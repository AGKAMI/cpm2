"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, NumericInput, TextArea, TextInput } from "@/components/ui/Field";
import { GAMES, GAME_LABELS, GARAGE_RULES, LIMITS, formatNumber, type GameType } from "@/lib/constants";
import { garageCapacity } from "@/lib/garage";
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
  const [game, setGame] = useState<GameType>(account?.game ?? "cpm2");
  const [cash, setCash] = useState(account?.cash ?? 0);
  const [coins, setCoins] = useState(account?.coins ?? 0);
  const [cars, setCars] = useState(account?.cars ?? 0);
  const [baseSlots, setBaseSlots] = useState(account?.baseSlots ?? LIMITS.BASE_CAR_SLOTS);
  const [slots, setSlots] = useState(account?.slots ?? 0);
  const [newGarage, setNewGarage] = useState(account?.newGarage ?? false);
  const [coinsSpentOnCars, setCoinsSpentOnCars] = useState(account?.coinsSpentOnCars ?? 0);
  const [notes, setNotes] = useState(account?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const editing = account !== null;
  const slotless = !GARAGE_RULES[game].hasSlots;

  const capacity = garageCapacity(game, {
    baseSlots: slotless ? 0 : baseSlots,
    slots: slotless ? 0 : slots,
    newGarage: slotless ? false : newGarage,
  });
  const carsOverflow = cars > capacity;

  /** Move the caret to whatever went wrong first — never leave the user guessing. */
  function focusFirstError(issues: Record<string, string>) {
    const order = ["email", "password", "game", "cash", "coins", "cars", "baseSlots", "slots", "notes"];
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

    const payload: Record<string, unknown> = {
      email,
      game,
      cash,
      coins,
      cars,
      baseSlots: slotless ? 0 : baseSlots,
      slots: slotless ? 0 : slots,
      newGarage: slotless ? false : newGarage,
      coinsSpentOnCars,
      notes,
    };
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
      if (!slotless) {
        if (baseSlots < 0) next.baseSlots = "Base slots cannot be negative.";
        else if (baseSlots > LIMITS.MAX_BASE_CAR_SLOTS) {
          next.baseSlots = `Base slots cannot exceed ${LIMITS.MAX_BASE_CAR_SLOTS}.`;
        }
        if (slots < 0) next.slots = "Slots cannot be negative.";
        else if (slots > LIMITS.MAX_COIN_SLOTS) {
          next.slots = `Extra slots cannot exceed ${LIMITS.MAX_COIN_SLOTS} per account.`;
        } else if (account && slots > account.slots) {
          next.slots = `Extra slots can only be bought (${LIMITS.SLOT_COST_COINS} coins each) — use the “Unlock 21st slot” button.`;
        }
      }
      if (cars < 0) next.cars = "Cars cannot be negative.";
      else if (cars > capacity) {
        next.cars = slotless
          ? `Cars cannot exceed ${capacity} — CPM1 holds one of every model in the game.`
          : `Cars cannot exceed ${capacity} (${baseSlots} base + ${slots} coin slot(s)${
              newGarage ? ` + ${LIMITS.NEW_GARAGE_SLOTS} new-garage slots` : ""
            }).`;
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
          : slotless
            ? "Log an account you made — CPM1 holds every model, one of each, and has no car slots."
            : "Log an account you made — CPM2 garages hold 21 slots, the 21st for 100 coins, plus 15 with the new garage."
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

        <div className="flex flex-col gap-1.5">
          <p className="label-caps flex items-baseline justify-between gap-3">
            <span>Game</span>
            <span className="num tracking-normal normal-case text-ink-faint">
              {slotless ? "no car slots · one of each model" : "21 slots · 21st for 100 coins"}
            </span>
          </p>
          <div className="flex gap-2">
            {GAMES.map((option) => (
              <button
                key={option}
                id={option === "cpm1" ? "account-game" : undefined}
                type="button"
                onClick={() => setGame(option)}
                aria-pressed={game === option}
                className={`flex-1 cursor-pointer rounded-[14px] border px-3 py-2.5 text-left transition-colors ${
                  game === option
                    ? "border-racing/50 bg-racing/10"
                    : "border-ink/10 bg-ink/[0.03] hover:border-ink/25"
                }`}
              >
                <span className="block font-sans text-[12px] font-semibold text-ink">
                  {GAME_LABELS[option]}
                </span>
                <span className="num mt-0.5 block text-[10px] text-ink-faint">
                  {option === "cpm1" ? "every model, once each" : "20 free + 21st + new garage"}
                </span>
              </button>
            ))}
          </div>
          {errors.game ? (
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-oxblood">
              <svg viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5M12 16.2v.1" strokeLinecap="round" />
              </svg>
              {errors.game}
            </p>
          ) : null}
        </div>

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
            hint={
              carsOverflow
                ? `garage holds ${capacity}`
                : slotless
                  ? `${cars} of ${capacity} models owned`
                  : `${cars} of ${capacity} slots used`
            }
          >
            <NumericInput
              id="account-cars"
              value={cars}
              onChange={setCars}
              invalid={Boolean(errors.cars)}
              suffix="CARS"
            />
          </Field>

          {slotless ? (
            <div className="flex flex-col gap-1.5">
              <span className="label-caps">Car slots</span>
              <p className="rounded-[14px] border border-ink/10 bg-ink/[0.03] px-4 py-3 text-[11px] leading-snug text-ink-faint">
                CPM1 has no car slots. Every model in the game can be owned — but only one of each.
              </p>
            </div>
          ) : (
            <>
              <Field
                label="Base garage size"
                htmlFor="account-baseSlots"
                error={errors.baseSlots}
                hint={`free slots · default ${LIMITS.BASE_CAR_SLOTS}`}
              >
                <NumericInput
                  id="account-baseSlots"
                  value={baseSlots}
                  onChange={setBaseSlots}
                  max={LIMITS.MAX_BASE_CAR_SLOTS}
                  invalid={Boolean(errors.baseSlots)}
                  suffix="SLOTS"
                />
              </Field>

              <Field
                label="Coin-bought slot"
                htmlFor="account-slots"
                error={errors.slots}
                hint={
                  editing && account && slots > account.slots
                    ? "buy with the slot button"
                    : `the 21st · ${LIMITS.SLOT_COST_COINS} coins`
                }
              >
                <NumericInput
                  id="account-slots"
                  value={slots}
                  onChange={setSlots}
                  max={LIMITS.MAX_COIN_SLOTS}
                  invalid={Boolean(errors.slots)}
                  suffix="SLOTS"
                />
              </Field>
            </>
          )}

          {slotless ? null : (
            <div className="flex flex-col gap-1.5">
              <span className="label-caps flex items-baseline justify-between gap-3">
                <span>New garage</span>
                <span className="num tracking-normal normal-case text-ink-faint">
                  +{LIMITS.NEW_GARAGE_SLOTS} slots
                </span>
              </span>
              <button
                id="account-newGarage"
                type="button"
                onClick={() => setNewGarage((value) => !value)}
                aria-pressed={newGarage}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border px-4 py-3 text-left transition-colors ${
                  newGarage
                    ? "border-brass/50 bg-brass/10"
                    : "border-ink/10 bg-ink/[0.03] hover:border-ink/25"
                }`}
              >
                <span>
                  <span className="block font-sans text-[12px] font-semibold text-ink">
                    {newGarage ? "Owned" : "Not owned"}
                  </span>
                  <span className="num mt-0.5 block text-[10px] text-ink-faint">
                    {LIMITS.NEW_GARAGE_PRICE} · {LIMITS.NEW_GARAGE_SLOTS} extra slots
                  </span>
                </span>
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                    newGarage ? "border-brass/50 text-brass" : "border-ink/15 text-ink-faint"
                  }`}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                    {newGarage ? (
                      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    )}
                  </svg>
                </span>
              </button>
            </div>
          )}

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
          <p className="rounded-[14px] border border-oxblood/35 bg-oxblood/8 px-3 py-2 text-xs text-oxblood">
            {errors.form}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
