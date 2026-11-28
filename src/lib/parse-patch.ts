/**
 * Parse a PATCH/PUT body that must update ONLY the fields the caller sent.
 *
 * Zod's `.partial()` still applies each field's `.default()` when the key is
 * absent, so `{"isPublished":true}` on a product silently reset its stock to
 * 1, its promotion discount to 0, and every boolean to false. Parse with the
 * schema for validation, then drop keys that were not actually in the input.
 */
import type { z } from "zod";

export function parseProvidedFields<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  input: unknown,
): z.output<T> {
  const parsed = schema.partial().parse(input) as Record<string, unknown>;
  if (input === null || typeof input !== "object" || Array.isArray(input)) return parsed as z.output<T>;
  const raw = input as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) => Object.prototype.hasOwnProperty.call(raw, key)),
  ) as z.output<T>;
}
