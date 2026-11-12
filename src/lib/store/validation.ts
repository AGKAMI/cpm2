/** VANTA GARAGE — client-side input validation for admin forms.
 *
 * Zod schemas for product, category, and promotion admin forms.
 * Provides regex checks for email, URL, hex color, and required-parameter
 * validation before any data hits the API.
 */

import { z } from "zod";

/** Email regex — same pattern used across the fleet ledger side. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valid URL (http/https). */
const URL_PATTERN = /^https?:\/\/.+/;

/** Valid hex color (#rrggbb or #rgb). */
const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Valid slug: lowercase, digits, hyphens only, min 2 chars. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** ── Product form ──────────────────────────────────────────────────── */

export const productFormSchema = z.object({
  cpm2CarCode: z
    .string({ error: "Car code is required." })
    .trim()
    .min(1, { error: "Pick a car from the CPM2 catalog." })
    .refine((v) => /^\d+$/.test(v), { error: "Car code must be a number." }),
  name: z
    .string({ error: "Name is required." })
    .trim()
    .min(2, { error: "Name must be at least 2 characters." })
    .max(100, { error: "Name must be 100 characters or fewer." }),
  description: z
    .string()
    .trim()
    .max(500, { error: "Description must be 500 characters or fewer." })
    .optional(),
  basePriceCents: z
    .string({ error: "Price is required." })
    .trim()
    .min(1, { error: "Enter a price." })
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
      error: "Enter a valid price (e.g. 60.00).",
    })
    .refine((v) => parseFloat(v) > 0, { error: "Price must be greater than 0." }),
  currency: z
    .string({ error: "Currency is required." })
    .trim()
    .min(1, { error: "Select a currency." }),
  stockQuantity: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), { error: "Stock must be a whole number." })
    .refine((v) => !v || parseInt(v, 10) >= 0, { error: "Stock cannot be negative." }),
  imageUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) =>
        !v ||
        URL_PATTERN.test(v) ||
        v.startsWith("/") ||
        v.startsWith("data:"),
      { error: "Image URL must start with http://, https://, /, or data:." },
    ),
  categoryId: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), { error: "Category must be a valid ID." }),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;

/** ── Category form ─────────────────────────────────────────────────── */

export const categoryFormSchema = z.object({
  name: z
    .string({ error: "Category name is required." })
    .trim()
    .min(2, { error: "Name must be at least 2 characters." })
    .max(60, { error: "Name must be 60 characters or fewer." }),
  slug: z
    .string({ error: "Slug is required." })
    .trim()
    .min(2, { error: "Slug must be at least 2 characters." })
    .refine((v) => SLUG_PATTERN.test(v), {
      error: "Slug must be lowercase, digits and hyphens only (e.g. sports-cars).",
    }),
  description: z.string().trim().max(200, { error: "Max 200 characters." }).optional(),
  sortOrder: z
    .string({ error: "Sort order is required." })
    .trim()
    .min(1, { error: "Enter a sort order." })
    .refine((v) => /^\d+$/.test(v), { error: "Sort order must be a whole number." })
    .refine((v) => parseInt(v, 10) >= 0, { error: "Sort order cannot be negative." }),
});

export type CategoryFormInput = z.infer<typeof categoryFormSchema>;

/** ── Promotion form ────────────────────────────────────────────────── */

export const promotionFormSchema = z.object({
  title: z
    .string({ error: "Promotion title is required." })
    .trim()
    .min(2, { error: "Title must be at least 2 characters." })
    .max(80, { error: "Title must be 80 characters or fewer." }),
  subtitle: z.string().trim().max(100, { error: "Max 100 characters." }).optional(),
  description: z.string().trim().max(300, { error: "Max 300 characters." }).optional(),
  discountPercent: z
    .string({ error: "Discount is required." })
    .trim()
    .min(1, { error: "Enter a discount percentage." })
    .refine((v) => /^\d+$/.test(v), { error: "Discount must be a whole number." })
    .refine((v) => {
      const n = parseInt(v, 10);
      return n >= 0 && n <= 100;
    }, { error: "Discount must be between 0 and 100." }),
  discountCode: z
    .string()
    .trim()
    .max(30, { error: "Max 30 characters." })
    .refine((v) => !v || /^[A-Z0-9]+$/.test(v), {
      error: "Discount code must be uppercase letters and digits only (e.g. VANTA10).",
    })
    .optional(),
  ctaText: z
    .string({ error: "CTA text is required." })
    .trim()
    .min(2, { error: "CTA text must be at least 2 characters." })
    .max(40, { error: "CTA text must be 40 characters or fewer." }),
  ctaLink: z
    .string({ error: "CTA link is required." })
    .trim()
    .min(1, { error: "Enter a link." })
    .refine((v) => v.startsWith("/") || URL_PATTERN.test(v), {
      error: "Link must start with / or http(s)://.",
    }),
  backgroundColor: z
    .string({ error: "Background color is required." })
    .trim()
    .refine((v) => HEX_COLOR_PATTERN.test(v), {
      error: "Enter a valid hex color.",
    }),
  accentColor: z
    .string({ error: "Accent color is required." })
    .trim()
    .refine((v) => HEX_COLOR_PATTERN.test(v), {
      error: "Enter a valid hex color (e.g. #d4af4f).",
    }),
  imageUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) =>
        !v ||
        URL_PATTERN.test(v) ||
        v.startsWith("/") ||
        v.startsWith("data:"),
      { error: "Image URL must start with http://, https://, /, or data:." },
    ),
  isActive: z.boolean({
    error: "Active flag is required.",
  }).default(true),
  sortOrder: z
    .string({ error: "Sort order is required." })
    .trim()
    .min(1, { error: "Enter a sort order." })
    .refine((v) => /^\d+$/.test(v), { error: "Sort order must be a whole number." })
    .refine((v) => parseInt(v, 10) >= 0, { error: "Sort order cannot be negative." }),
});

export type PromotionFormInput = z.infer<typeof promotionFormSchema>;

/** ── Email validation (reusable, same pattern as fleet ledger) ─────── */

export const emailFieldSchema = z
  .string({ error: "Email is required." })
  .trim()
  .min(3, { error: "Email is required." })
  .refine((v) => EMAIL_PATTERN.test(v), { error: "Enter a valid email address." });

export type EmailFieldInput = z.infer<typeof emailFieldSchema>;

/** ── Result type ───────────────────────────────────────────────────── */

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

export function validateProductForm(raw: unknown): ValidationResult<ProductFormInput> {
  const parsed = productFormSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path[0] as string;
    errors[path] = issue.message;
  }
  return { ok: false, errors };
}

export function validateCategoryForm(raw: unknown): ValidationResult<CategoryFormInput> {
  const parsed = categoryFormSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path[0] as string;
    errors[path] = issue.message;
  }
  return { ok: false, errors };
}

export function validatePromotionForm(raw: unknown): ValidationResult<PromotionFormInput> {
  const parsed = promotionFormSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path[0] as string;
    errors[path] = issue.message;
  }
  return { ok: false, errors };
}

export function validateEmailField(raw: unknown): ValidationResult<EmailFieldInput> {
  const parsed = emailFieldSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path[0] as string;
    errors[path] = issue.message;
  }
  return { ok: false, errors };
}
