import type {
  AccountSummary,
  ApiErrorBody,
  CarRecord,
  CarOwners,
  FleetEvent,
  FleetStats,
  GarageSummary,
  ImportReport,
  TrophyRecord,
  TrophySummary,
} from "./types.ts";
import type { GameType } from "./constants.ts";

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

/**
 * The raw initData string, when the console runs as a Telegram Mini App
 * (src/proxy.ts verifies its signature server-side). A browser outside
 * Telegram has none, and the API treats that as the trusted local context it
 * already is. Deliberately NOT imported from lib/telegram.ts — that file sits
 * behind the zod-dependant server layer and must never reach this bundle.
 */
const TELEGRAM_INIT_DATA_HEADER = "X-Telegram-Init-Data";

function telegramInitData(): string {
  const webApp = window.Telegram?.WebApp;
  return typeof webApp?.initData === "string" ? webApp.initData : "";
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const initData = telegramInitData();
  if (initData) headers.set(TELEGRAM_INIT_DATA_HEADER, initData);

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
  trophies: (id: number) =>
    request<{ trophies: TrophyRecord[]; summary: TrophySummary }>(`/api/accounts/${id}/trophies`),
  setTrophies: (id: number, payload: { class: string; gold: number; silver: number; bronze: number }) =>
    request<{ trophy: TrophyRecord; summary: TrophySummary }>(`/api/accounts/${id}/trophies`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  fleetTrophies: () =>
    request<{
      accounts: TrophySummary[];
      totals: { gold: number; silver: number; bronze: number; total: number };
    }>("/api/trophies"),
  garage: (id: number) =>
    request<{ garage: GarageSummary }>(`/api/accounts/${id}/garage`),
  addCar: (id: number, payload: { carCode: number; notes?: string }) =>
    request<{ car: CarRecord; garage: GarageSummary }>(`/api/accounts/${id}/garage`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  removeCar: (id: number, carId: number) =>
    request<{ removed: number; carName: string; garage: GarageSummary }>(
      `/api/accounts/${id}/garage?carId=${carId}`,
      { method: "DELETE" },
    ),
  garages: () => request<{ garages: GarageSummary[] }>("/api/garages"),
  carOwners: (game: GameType, carCode: number) =>
    request<{ owners: CarOwners }>(`/api/cars/${game}/${carCode}/owners`),
};
