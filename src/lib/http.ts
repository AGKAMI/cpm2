import { ApiError } from "./api.ts";

/**
 * Request helpers that do not depend on Next.js, so they can be unit tested
 * outside of a running server.
 */

/** Reads and parses a JSON request body with a friendly failure mode. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

/** Parses a route param into a positive account id. */
export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "INVALID_ID", "Account id must be a positive whole number.");
  }
  return id;
}

/**
 * Parses a route param into a car code. NOT parseId: CPM2 legitimately has a
 * car #0, so a strict "positive integer" parse would reject a real catalog
 * entry. The catalog lookup itself is the final authority — anything not in
 * it returns car_unknown, so this only guards the shape of the input.
 */
export function parseCarCode(raw: string): number {
  const code = Number(raw);
  if (!Number.isInteger(code) || code < 0) {
    throw new ApiError(
      400,
      "INVALID_CAR_CODE",
      "Car code must be a whole number of zero or more.",
    );
  }
  return code;
}
