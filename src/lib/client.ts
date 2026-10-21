import type {
  AccountSummary,
  ApiErrorBody,
  FleetEvent,
  FleetStats,
  ImportReport,
} from "./types.ts";

export class ApiRequestError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(message: string, status: number, code: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch {
    throw new ApiRequestError(
      "Cannot reach the local database service. Is the dev server still running?",
      0,
      "NETWORK_ERROR",
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const body = payload as ApiErrorBody | null;
    throw new ApiRequestError(
      body?.error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      body?.error?.code ?? "UNKNOWN_ERROR",
      body?.error?.fields,
    );
  }

  return payload as T;
}

export const api = {
  list: (options: { archived?: boolean } = {}) =>
    request<{ accounts: AccountSummary[]; stats: FleetStats }>(
      options.archived ? "/api/accounts?archived=true" : "/api/accounts",
    ),
  listAll: () => request<{ accounts: AccountSummary[]; stats: FleetStats }>("/api/accounts?archived=include"),
  events: () => request<{ events: FleetEvent[] }>("/api/events"),
  create: (payload: unknown) =>
    request<{ account: AccountSummary }>("/api/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: number, payload: unknown) =>
    request<{ account: AccountSummary }>(`/api/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  archive: (id: number) =>
    request<{ archived: { id: number; email: string } }>(`/api/accounts/${id}`, {
      method: "DELETE",
    }),
  restore: (id: number) =>
    request<{ account: AccountSummary }>(`/api/accounts/${id}/restore`, { method: "POST" }),
  importAccounts: (payload: unknown, format: "json" | "csv" = "json") =>
    request<{ import: ImportReport }>(`/api/accounts/import?format=${format}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  importCsv: (csv: string) =>
    request<{ import: ImportReport }>("/api/accounts/import?format=csv", {
      method: "POST",
      body: JSON.stringify({ csv }),
    }),
  buySlots: (id: number, count: number) =>
    request<{ account: AccountSummary }>(`/api/accounts/${id}/slots`, {
      method: "POST",
      body: JSON.stringify({ count }),
    }),
  reveal: (id: number) =>
    request<{ id: number; email: string; password: string }>(`/api/accounts/${id}/password`),
};
