import { z } from "zod";
import {
  GAMES,
  LIMITS,
  MAX_CARS,
  MAX_TROPHIES_PER_CLASS,
  TROPHY_CLASSES,
} from "./constants.ts";
import { garageCapacity } from "./garage.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Which title a record belongs to. Required wherever a car code appears,
 * because a code alone does not identify a car across the two games.
 */
export const gameSchema = z.enum([...GAMES], {
  error: `Game must be one of ${GAMES.join(", ")}.`,
});

export const emailSchema = z
  .string({ error: "Email is required." })
  .trim()
  .min(3, { error: "Email is required." })
  .max(LIMITS.MAX_EMAIL_LENGTH, {
    error: `Email must be ${LIMITS.MAX_EMAIL_LENGTH} characters or fewer.`,
  })
  .refine((value) => EMAIL_PATTERN.test(value), { error: "Enter a valid email address." });

export const passwordSchema = z
  .string({ error: "Password is required." })
  .min(LIMITS.MIN_PASSWORD_LENGTH, { error: "Password is required." })
  .max(LIMITS.MAX_PASSWORD_LENGTH, {
    error: `Password must be ${LIMITS.MAX_PASSWORD_LENGTH} characters or fewer.`,
  })
  .refine((value) => value.trim().length > 0, { error: "Password cannot be blank." });

export const cashSchema = z
  .int({ error: "Cash must be a whole number." })
  .min(0, { error: "Cash cannot be negative." })
  .max(LIMITS.MAX_CASH, { error: `Cash cannot exceed ${LIMITS.MAX_CASH.toLocaleString("en-US")}.` });

export const coinsSchema = z
  .int({ error: "Coins must be a whole number." })
  .min(0, { error: "Coins cannot be negative." })
  .max(LIMITS.MAX_COINS, { error: `Coins cannot exceed ${LIMITS.MAX_COINS.toLocaleString("en-US")}.` });

export const carsSchema = z
  .int({ error: "Cars must be a whole number." })
  .min(0, { error: "Cars cannot be negative." })
  .max(MAX_CARS, { error: `Cars cannot exceed ${MAX_CARS}.` });

export const baseSlotsSchema = z
  .int({ error: "Base slots must be a whole number." })
  .min(0, { error: "Base slots cannot be negative." })
  .max(LIMITS.MAX_BASE_CAR_SLOTS, {
    error: `Base slots cannot exceed ${LIMITS.MAX_BASE_CAR_SLOTS}.`,
  });

export const slotsSchema = z
  .int({ error: "Slots must be a whole number." })
  .min(0, { error: "Slots cannot be negative." })
  .max(LIMITS.MAX_COIN_SLOTS, {
    error: `Extra slots cannot exceed ${LIMITS.MAX_COIN_SLOTS} per account.`,
  });

export const newGarageSchema = z.boolean({
  error: "The new garage flag must be true or false.",
});

export const coinsSpentOnCarsSchema = z
  .int({ error: "Coins spent on cars must be a whole number." })
  .min(0, { error: "Coins spent on cars cannot be negative." })
  .max(LIMITS.MAX_COINS, {
    error: `Coins spent on cars cannot exceed ${LIMITS.MAX_COINS.toLocaleString("en-US")} per account.`,
  });

export const notesSchema = z
  .string()
  .max(LIMITS.MAX_NOTES_LENGTH, {
    error: `Notes must be ${LIMITS.MAX_NOTES_LENGTH} characters or fewer.`,
  })
  .default("");

/** Payload accepted when creating a brand new account. */
export const accountCreateSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    // Defaults to CPM2 so every pre-existing caller keeps its behaviour; a
    // CPM1 account must state game explicitly.
    game: gameSchema.default("cpm2"),
    cash: cashSchema.default(0),
    coins: coinsSchema.default(0),
    cars: carsSchema.default(0),
    baseSlots: baseSlotsSchema.default(LIMITS.BASE_CAR_SLOTS),
    slots: slotsSchema.default(0),
    newGarage: newGarageSchema.default(false),
    coinsSpentOnCars: coinsSpentOnCarsSchema.optional().default(0),
    notes: notesSchema,
  })
  .superRefine((data, ctx) => {
    // CPM1 has no slots at all — the garage is the whole catalog, one of each
    // model. CPM2 is slot-based, with the second garage adding 15 slots.
    const capacity =
      data.game === "cpm1"
        ? garageCapacity("cpm1", { baseSlots: 0, slots: 0, newGarage: false })
        : garageCapacity("cpm2", {
            baseSlots: data.baseSlots,
            slots: data.slots,
            newGarage: data.newGarage,
          });
    if (data.cars > capacity) {
      ctx.addIssue({
        code: "custom",
        path: ["cars"],
        message:
          data.game === "cpm1"
            ? `Cars cannot exceed ${capacity} — CPM1 holds one of every model in the game.`
            : `Cars cannot exceed ${capacity} (${data.baseSlots} base + ${data.slots} coin slot(s)${
                data.newGarage ? ` + ${LIMITS.NEW_GARAGE_SLOTS} new-garage slots` : ""
              }).`,
      });
    }
  });

/** Payload accepted when editing an existing account (every field optional). */
export const accountPatchSchema = z
  .object({
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    game: gameSchema.optional(),
    cash: cashSchema.optional(),
    coins: coinsSchema.optional(),
    cars: carsSchema.optional(),
    baseSlots: baseSlotsSchema.optional(),
    slots: slotsSchema.optional(),
    newGarage: newGarageSchema.optional(),
    coinsSpentOnCars: coinsSpentOnCarsSchema.optional(),
    notes: z.string().max(LIMITS.MAX_NOTES_LENGTH).optional(),
  })
  .superRefine((data, ctx) => {
    if (!Object.values(data).some((value) => value !== undefined)) {
      ctx.addIssue({ code: "custom", path: ["form"], message: "Nothing to update." });
    }
  });

export const slotPurchaseSchema = z
  .object({
    count: z
      .int({ error: "Slot count must be a whole number." })
      .min(1, { error: "Buy at least one slot." })
      .max(LIMITS.MAX_COIN_SLOTS, {
        error: `You can buy at most ${LIMITS.MAX_COIN_SLOTS} slot at a time.`,
      })
      .default(1),
  })
  .default({ count: 1 });

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountPatchInput = z.infer<typeof accountPatchSchema>;
export type SlotPurchaseInput = z.infer<typeof slotPurchaseSchema>;

/** Trophy counts for one drag racing class of one account. */
export const trophyUpdateSchema = z.object({
  class: z.enum([...TROPHY_CLASSES], {
    error: `Class must be one of ${TROPHY_CLASSES.join(", ")}.`,
  }),
  gold: z
    .int({ error: "Gold count must be a whole number." })
    .min(0, { error: "Gold count cannot be negative." })
    .max(MAX_TROPHIES_PER_CLASS, { error: `At most ${MAX_TROPHIES_PER_CLASS} trophies per class.` })
    .default(0),
  silver: z
    .int({ error: "Silver count must be a whole number." })
    .min(0, { error: "Silver count cannot be negative." })
    .max(MAX_TROPHIES_PER_CLASS, { error: `At most ${MAX_TROPHIES_PER_CLASS} trophies per class.` })
    .default(0),
  bronze: z
    .int({ error: "Bronze count must be a whole number." })
    .min(0, { error: "Bronze count cannot be negative." })
    .max(MAX_TROPHIES_PER_CLASS, { error: `At most ${MAX_TROPHIES_PER_CLASS} trophies per class.` })
    .default(0),
});

export type TrophyUpdateInput = z.infer<typeof trophyUpdateSchema>;

/**
 * Assign (or update the notes of) one catalog car in one account's garage.
 *
 * `game` is optional here but NOT ambiguous: when omitted the account's own
 * game is used, and a value that disagrees with the account is rejected. The
 * caller can never silently land a car in the wrong catalog.
 */
export const carAssignSchema = z.object({
  carCode: z
    .int({ error: "Car code must be a whole number." })
    .min(0, { error: "Car code cannot be negative." })
    .max(9999, { error: "Car code is out of range." }),
  game: gameSchema.optional(),
  notes: z.string().max(200, { error: "Notes must be 200 characters or fewer." }).default(""),
});

export type CarAssignInput = z.infer<typeof carAssignSchema>;

/** How a car is bought in CPM2 — paid (Rands), coin, or the cash shop. */
export const tradeKindSchema = z.enum(["paid", "coin", "cash"], {
  error: "Kind must be paid, coin or cash.",
});

/** The real-money conversion rates behind every trade valuation. */
export const tradeRatesSchema = z.object({
  randPerCoin: z
    .number({ error: "The coins rate is required." })
    .min(0, { error: "The coins rate cannot be negative." })
    .max(100_000, { error: "The coins rate looks wrong — check the pack price." }),
  randPerCash: z
    .number({ error: "The cash rate is required." })
    .min(0, { error: "The cash rate cannot be negative." })
    .max(100_000, { error: "The cash rate looks wrong — check the pack price." }),
});

export type TradeRatesInput = z.infer<typeof tradeRatesSchema>;

/** Upserting one car's entry in the price book. */
export const tradePriceSetSchema = z.object({
  game: gameSchema,
  code: z
    .int({ error: "Car code must be a whole number." })
    .min(0, { error: "Car code cannot be negative." })
    .max(9999, { error: "Car code is out of range." }),
  kind: tradeKindSchema,
  price: z
    .number({ error: "Price is required." })
    .min(0, { error: "Price cannot be negative." })
    .max(50_000_000, { error: "Price cannot exceed R50,000,000." }),
});

export type TradePriceSetInput = z.infer<typeof tradePriceSetSchema>;

// ----------------------------------------------------------------- user auth

/** New player registration. */
export const userRegisterSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    telegramUserId: z.coerce.number().int().positive().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type UserRegisterInput = z.infer<typeof userRegisterSchema>;

/** Player login. */
export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Password is required." }).min(1, {
    error: "Password is required.",
  }),
});

export type UserLoginInput = z.infer<typeof userLoginSchema>;

/** Telegram binding payload. */
export const userTelegramBindSchema = z.object({
  telegramUserId: z.coerce.number().int().positive(),
  initData: z.string(),
});

export type UserTelegramBindInput = z.infer<typeof userTelegramBindSchema>;

/** A screenshot handed to Gemini for car identification (≤ ~5MB binary). */
export const tradeIdentifySchema = z.object({
  imageBase64: z
    .string({ error: "A screenshot is required." })
    .min(50, { error: "That image looks empty." })
    .max(7_000_000, { error: "Screenshot is too large — keep it under 5MB." }),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"], {
    error: "Screenshot must be a PNG, JPEG or WebP image.",
  }),
});

export type TradeIdentifyInput = z.infer<typeof tradeIdentifySchema>;
