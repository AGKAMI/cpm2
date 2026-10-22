import { z } from "zod";
import {
  LIMITS,
  MAX_CARS,
  MAX_TROPHIES_PER_CLASS,
  TROPHY_CLASSES,
  carCapacity,
} from "./constants.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  .max(LIMITS.MAX_PURCHASED_SLOTS, {
    error: `Extra slots cannot exceed ${LIMITS.MAX_PURCHASED_SLOTS} per account.`,
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
    cash: cashSchema.default(0),
    coins: coinsSchema.default(0),
    cars: carsSchema.default(0),
    baseSlots: baseSlotsSchema.default(LIMITS.BASE_CAR_SLOTS),
    slots: slotsSchema.default(0),
    coinsSpentOnCars: coinsSpentOnCarsSchema.optional().default(0),
    notes: notesSchema,
  })
  .superRefine((data, ctx) => {
    const capacity = carCapacity(data.baseSlots, data.slots);
    if (data.cars > capacity) {
      ctx.addIssue({
        code: "custom",
        path: ["cars"],
        message: `Cars cannot exceed ${capacity} (${data.baseSlots} base + ${data.slots} extra slot(s)).`,
      });
    }
  });

/** Payload accepted when editing an existing account (every field optional). */
export const accountPatchSchema = z
  .object({
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    cash: cashSchema.optional(),
    coins: coinsSchema.optional(),
    cars: carsSchema.optional(),
    baseSlots: baseSlotsSchema.optional(),
    slots: slotsSchema.optional(),
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
      .max(LIMITS.MAX_PURCHASED_SLOTS, {
        error: `You can buy at most ${LIMITS.MAX_PURCHASED_SLOTS} slots at a time.`,
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

/** Assign (or update the notes of) one catalog car in one account's garage. */
export const carAssignSchema = z.object({
  carCode: z
    .int({ error: "Car code must be a whole number." })
    .min(0, { error: "Car code cannot be negative." })
    .max(9999, { error: "Car code is out of range." }),
  notes: z.string().max(200, { error: "Notes must be 200 characters or fewer." }).default(""),
});

export type CarAssignInput = z.infer<typeof carAssignSchema>;
