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
