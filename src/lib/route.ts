import { NextResponse } from "next/server";
import { errorPayload } from "./api.ts";

export { parseId, readJson } from "./http.ts";

/** JSON success helper. */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Maps any thrown value onto a JSON error response. */
export function fail(err: unknown): NextResponse {
  const { status, body } = errorPayload(err);
  return NextResponse.json(body, { status });
}
