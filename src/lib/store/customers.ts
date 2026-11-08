/**
 * VANTA GARAGE — customer service.
 * Customers are internal records; platform identities (telegram/whatsapp)
 * link a customer to one or more messaging platforms.
 */

import { getStoreDb } from "../store-db.ts";
import type { Customer, PlatformIdentity, Platform } from "../store-types.ts";

function rowToCustomer(row: Record<string, unknown>): Customer {
  return {
    id: Number(row.id),
    inGameName: String(row.in_game_name ?? ""),
    playerId: String(row.player_id ?? ""),
    currencyPref: String(row.currency_pref ?? "ZAR"),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function rowToPlatformIdentity(row: Record<string, unknown>): PlatformIdentity {
  return {
    id: Number(row.id),
    customerId: Number(row.customer_id),
    platform: row.platform as Platform,
    platformUserId: String(row.platform_user_id),
    platformUsername: String(row.platform_username ?? ""),
    linkedAt: String(row.linked_at ?? ""),
  };
}

export async function createCustomer(input: {
  inGameName: string;
  playerId: string;
  currencyPref?: string;
}): Promise<Customer> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_customers (in_game_name, player_id, currency_pref, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [input.inGameName.trim(), input.playerId.trim(), input.currencyPref ?? "ZAR", now, now],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Customer insert returned no id");
  return rowToCustomer({ id, in_game_name: input.inGameName.trim(), player_id: input.playerId.trim(), currency_pref: input.currencyPref ?? "ZAR", created_at: now, updated_at: now });
}

export async function getCustomer(id: number): Promise<Customer | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_customers WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToCustomer(result.rows[0]);
}

export async function getCustomerByPlayerId(playerId: string): Promise<Customer | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_customers WHERE player_id = ? LIMIT 1`,
    args: [playerId],
  });
  if (result.rows.length === 0) return null;
  return rowToCustomer(result.rows[0]);
}

export async function getCustomerByPlatformIdentity(platform: Platform, platformUserId: string): Promise<{ customer: Customer; identity: PlatformIdentity } | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT pi.*, c.* FROM vanta_platform_identities pi
          JOIN vanta_customers c ON c.id = pi.customer_id
          WHERE pi.platform = ? AND pi.platform_user_id = ?`,
    args: [platform, platformUserId],
  });
  if (result.rows.length === 0) return null;
  const identity = rowToPlatformIdentity(result.rows[0]);
  const customer = rowToCustomer({
    id: Number(result.rows[0].customer_id),
    in_game_name: String(result.rows[0].in_game_name ?? ""),
    player_id: String(result.rows[0].player_id ?? ""),
    currency_pref: String(result.rows[0].currency_pref ?? "ZAR"),
    created_at: String(result.rows[0].created_at ?? ""),
    updated_at: String(result.rows[0].updated_at ?? ""),
  });
  return { customer, identity };
}

export async function linkPlatformIdentity(customerId: number, platform: Platform, platformUserId: string, platformUsername: string = ""): Promise<PlatformIdentity> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  // Remove any existing binding for this platform user (one customer per platform id)
  await db.execute({
    sql: `DELETE FROM vanta_platform_identities WHERE platform = ? AND platform_user_id = ?`,
    args: [platform, platformUserId],
  });
  const result = await db.execute({
    sql: `INSERT INTO vanta_platform_identities (customer_id, platform, platform_user_id, platform_username, linked_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [customerId, platform, platformUserId, platformUsername, now],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Platform identity insert returned no id");
  return rowToPlatformIdentity({ id, customer_id: customerId, platform, platform_user_id: platformUserId, platform_username: platformUsername, linked_at: now });
}

export async function listCustomers(): Promise<Customer[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_customers ORDER BY created_at DESC`,
    args: [],
  });
  return result.rows.map(rowToCustomer);
}
