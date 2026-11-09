import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export type ErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

/**
 * Maps any thrown value onto an HTTP status + JSON body.
 * Never leaks stack traces to the client.
 */
export function errorPayload(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } },
    };
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.length ? issue.path.join(".") : "form";
      if (!fields[key]) fields[key] = issue.message;
    }
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_FAILED",
          message: "Some fields need fixing.",
          fields,
        },
      },
    };
  }

  console.error("[cpm2] unexpected error:", err);
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Server error — try again." } },
  };
}
