/**
 * VANTA GARAGE store database client.
 * Shares the existing Turso connection (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN)
 * but uses isolated `vanta_` tables — logical separation from the CPM2 fleet schema.
 */

import type { TursoHttpClient } from "./db-turso.ts";
import { VANTA_SCHEMA, VANTA_ACCOUNT_UNITS_DDL } from "./store-schema.ts";
import { splitSqlStatements } from "./sql.ts";

// globalThis caches survive across route bundles within one server process
// (module-level singletons do not in this Next version — each bundle re-ran
// the schema batch + migrations ≈ 8s of sequential Turso round-trips).
const g = globalThis as typeof globalThis & {
  __vantaStoreDb?: TursoHttpClient;
  __vantaStoreBoot?: Promise<TursoHttpClient>;
  __vantaStoreMigrated?: boolean;
};

export async function getStoreDb(): Promise<TursoHttpClient> {
  if (g.__vantaStoreDb) return g.__vantaStoreDb;

  // Share ONE boot promise process-wide: concurrent first-queries (a page
  // render fires products + categories + promotions in parallel) must not
  // each run the schema batch + migrations.
  if (!g.__vantaStoreBoot) {
    g.__vantaStoreBoot = (async () => {
      const { createTursoClient } = await import("./db-turso.ts");
      const store = await createTursoClient();

      // Apply the VANTA schema idempotently — CREATE TABLE IF NOT EXISTS
      // is a no-op when tables already exist.
      await store.batch(splitSqlStatements(VANTA_SCHEMA));

      g.__vantaStoreDb = store;

      // Idempotent migrations ONCE per process (they were previously re-run
      // for every route bundle's first cold hit — ~15 sequential round-trips).
      if (!g.__vantaStoreMigrated) {
        await runStoreMigrations(store);
        g.__vantaStoreMigrated = true;
      }

      return store;
    })();
    g.__vantaStoreBoot.catch(() => {
      // Allow a retry after a failed boot instead of caching the rejection.
      g.__vantaStoreBoot = undefined;
    });
  }
  return g.__vantaStoreBoot;
}

/** Run one-time schema migrations. Call once at deploy time, NOT on every cold start.
 *  Vercel serverless will hammer Turso if ALTER TABLE runs on every function invocation.
 */
export async function runStoreMigrations(storeArg?: TursoHttpClient): Promise<void> {
  const store = storeArg ?? (await getStoreDb());

  // Migration: add cpm2_car_code to existing vanta_products tables
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_products ADD COLUMN cpm2_car_code INTEGER`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add design-option columns (yes/no toggles, replace perf specs)
  for (const col of ['air_suspension', 'unlocked_bodykits']) {
    try {
      await store.execute({
        sql: `ALTER TABLE vanta_products ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`,
        args: [],
      });
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Migration: add spec columns (legacy — kept for old rows, no longer edited)
  for (const col of ['spec_hp', 'spec_top_speed', 'spec_zero_hundred', 'spec_drive']) {
    try {
      await store.execute({
        sql: `ALTER TABLE vanta_products ADD COLUMN ${col} ${col === 'spec_zero_hundred' || col === 'spec_drive' ? 'TEXT' : 'INTEGER'}`,
        args: [],
      });
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Migration: add email column to vanta_customers (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_customers ADD COLUMN email TEXT NOT NULL DEFAULT ''`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add tag columns (is_new, is_sale) for corner badges
  for (const col of ['is_new', 'is_sale']) {
    try {
      await store.execute({
        sql: `ALTER TABLE vanta_products ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`,
        args: [],
      });
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Migration: per-product discount percentage (0-90)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_products ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add quantity column to vanta_orders (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_orders ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add notifications_enabled column to vanta_customers (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_customers ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add nickname column to vanta_admins (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_admins ADD COLUMN nickname TEXT NOT NULL DEFAULT ''`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add initial_stock to vanta_products — the stock baseline set at
  // creation (or last restock). Drives ratio-based stock color tiers.
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_products ADD COLUMN initial_stock INTEGER NOT NULL DEFAULT 0`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }
  // Backfill: legacy rows get their baseline = current stock so the ratio
  // math has a reference point (idempotent — only touches rows still at 0).
  try {
    await store.execute({
      sql: `UPDATE vanta_products SET initial_stock = stock_quantity WHERE initial_stock = 0`,
      args: [],
    });
  } catch {
    // Backfill already applied — safe to ignore
  }

  // Migration: payment_method gains 'wallet' (store credit). SQLite cannot
  // ALTER a CHECK constraint, so the table is rebuilt: create the wider
  // table, copy, drop, rename. Guarded on the live constraint text so it
  // runs exactly once no matter how many serverless instances boot.
  const orderConstraint = await store.execute({
    sql: `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'vanta_orders'`,
    args: [],
  });
  const ddl = String(orderConstraint.rows[0]?.sql ?? "");
  if (ddl && !ddl.includes("'wallet'")) {
    // The stored DDL quotes identifiers the way SQLite normalises them
    // ("vanta_orders"), so the rename must tolerate quoting and IF NOT EXISTS.
    const widened = ddl
      .replace(
        "CHECK (payment_method IN ('payfast', 'eft', 'stars'))",
        "CHECK (payment_method IN ('payfast', 'eft', 'stars', 'wallet'))",
      )
      .replace(
        /^CREATE TABLE\s+(IF NOT EXISTS\s+)?["'`]?vanta_orders["'`]?\s*/,
        "CREATE TABLE vanta_orders_wallet_migration ",
      );
    if (!widened.startsWith("CREATE TABLE vanta_orders_wallet_migration ")) {
      throw new Error(
        "Wallet migration could not rebuild vanta_orders: unexpected CREATE TABLE prefix",
      );
    }
    await store.execute({
      sql: `DROP TABLE IF EXISTS vanta_orders_wallet_migration`,
      args: [],
    });
    await store.execute({ sql: `${widened};`, args: [] });
    await store.execute({
      sql: `INSERT INTO vanta_orders_wallet_migration SELECT * FROM vanta_orders`,
      args: [],
    });
    await store.execute({ sql: `DROP TABLE vanta_orders`, args: [] });
    await store.execute({
      sql: `ALTER TABLE vanta_orders_wallet_migration RENAME TO vanta_orders`,
      args: [],
    });
    // The rebuild keeps the columns (and the UNIQUE autoindexes) but not the
    // hand-written indexes — recreate the lookup ones.
    for (const idx of [
      `CREATE INDEX IF NOT EXISTS idx_vanta_orders_customer ON vanta_orders (customer_id)`,
      `CREATE INDEX IF NOT EXISTS idx_vanta_orders_payment_state ON vanta_orders (payment_state)`,
      `CREATE INDEX IF NOT EXISTS idx_vanta_orders_created ON vanta_orders (created_at DESC)`,
    ]) {
      await store.execute({ sql: idx, args: [] });
    }
  }

  // Migration: one stock truth. Products without an inventory row get one
  // seeded from their own stock_quantity (display and checkout previously
  // read different tables — a card could show sold-out while the checkout
  // reserved a unit, or vice versa), and the product column is collapsed to
  // the available number the card now displays. Idempotent.
  await store.execute({
    sql: `INSERT INTO vanta_inventory (product_id, stock_quantity, reserved_quantity, version, updated_at)
          SELECT id, stock_quantity, 0, 1, ?
          FROM vanta_products
          WHERE id NOT IN (SELECT product_id FROM vanta_inventory)`,
    args: [new Date().toISOString()],
  });
  await store.execute({
    sql: `UPDATE vanta_products
          SET stock_quantity = (
                SELECT i.stock_quantity - i.reserved_quantity
                FROM vanta_inventory i WHERE i.product_id = vanta_products.id
              ),
              updated_at = ?
          WHERE id IN (SELECT product_id FROM vanta_inventory)`,
    args: [new Date().toISOString()],
  });

  // Migration: add eft_proof_url to vanta_orders (for EFT payment proof uploads)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_orders ADD COLUMN eft_proof_url TEXT`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }


  // Order product-name snapshot. The column was accidentally declared on
  // vanta_customers in an earlier schema, so a fresh database could not insert
  // an order at all. Old deployments need the additive migration too.
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_orders ADD COLUMN product_name TEXT`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: product taxonomy — `kind` (car | account) and `game` (cpm1 | cpm2).
  //
  // `kind` separates vehicles from credential accounts so the two never share a
  // card layout. `game` is what makes a CPM code unambiguous, because CPM1 #2 is
  // a Perodua Myvi and CPM2 #2 is a Scirocco III — the same integer.
  //
  // SQLite cannot add a CHECK constraint via ALTER TABLE, so the CHECK lives
  // only in store-schema.ts's CREATE TABLE (applied to a fresh database). The
  // migrated column is constraint-free; app code validates the value instead.
  // Existing rows are all CPM2 vehicles, so both defaults are correct and no
  // backfill is needed.
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_products ADD COLUMN kind TEXT NOT NULL DEFAULT 'car'`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  try {
    await store.execute({
      sql: `ALTER TABLE vanta_products ADD COLUMN game TEXT NOT NULL DEFAULT 'cpm2'`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: vanta_categories.game. Categories were global, so CPM1's tree
  // (Flags/Security/Police/Premium/Mods/Accounts) would have shown to CPM2
  // shoppers as six empty results. SQLite cannot ALTER in a CHECK, so the
  // constraint lives only in the CREATE TABLE for fresh databases; app code
  // validates the value. Existing rows are all CPM2 categories, so the default
  // is correct and no backfill is needed.
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_categories ADD COLUMN game TEXT NOT NULL DEFAULT 'cpm2'`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migrations: product-attached promotions. The schema's CREATE TABLE has
  // these columns for fresh databases, but the LIVE Turso table predates them.
  // Without these ALTERs every promotion write (INSERT includes game,
  // product_id and pill_color explicitly) fails with "no such column" on the
  // deployed store, so the new admin fields would be silently unusable.
  // SQLite cannot ALTER in a CHECK/FK, so values are validated by the API.
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_promotions ADD COLUMN game TEXT`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_promotions ADD COLUMN product_id INTEGER`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_promotions ADD COLUMN pill_color TEXT NOT NULL DEFAULT '#d4af4f'`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: vanta_account_units.email_hash. The email is AES-256-GCM
  // encrypted with a random IV, so the same address never encrypts to the same
  // string twice — dedupe cannot match on the ciphertext. This hash is what
  // UNIQUE() and the import loop compare.
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_account_units ADD COLUMN email_hash TEXT NOT NULL DEFAULT ''`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: vanta_account_units dedupe constraint (email -> email_hash).
  //
  // The table shipped with UNIQUE(email, product_id). email is AES-256-GCM
  // encrypted with a random IV, so the same address never encrypts to the same
  // string twice — that constraint could never match, and re-importing the same
  // .txt block duplicated every unit (proved: one 3-unit block imported twice =
  // 6 rows). SQLite cannot ALTER a constraint, so the table is rebuilt from
  // VANTA_ACCOUNT_UNITS_DDL, which is now the single source of truth.
  //
  // Rebuilds ONLY an empty table: a table with rows cannot be rebuilt, because
  // email_hash cannot be recomputed from the ciphertext and rebuilding would
  // orphan those units. That case is reported loudly for manual handling
  // instead of silently leaving broken dedupe in place.
  try {
    const ddl = await store.execute({
      sql: `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'vanta_account_units'`,
      args: [],
    });
    const createSql = String(ddl.rows[0]?.sql ?? "");
    const cols = await store.execute({
      sql: `SELECT name FROM pragma_table_info('vanta_account_units')`,
      args: [],
    });
    const hasHash = (cols.rows as Array<{ name: string }>).some((c) => c.name === "email_hash");
    const keyedOnEmail = /UNIQUE\s*\(\s*email\s*,/.test(createSql);

    if (keyedOnEmail && hasHash) {
      const count = await store.execute({
        sql: `SELECT COUNT(*) n FROM vanta_account_units`,
        args: [],
      });
      if (Number((count.rows[0] as { n: number }).n) === 0) {
        // No units to lose: drop and let the DDL recreate it correctly.
        await store.execute({ sql: `DROP TABLE vanta_account_units`, args: [] });
        await store.execute({ sql: VANTA_ACCOUNT_UNITS_DDL, args: [] });
      } else {
        console.warn(
          "[vanta] vanta_account_units still keys UNIQUE on the encrypted email — " +
            "re-imports will duplicate. It holds rows whose email_hash cannot be " +
            "recomputed from the ciphertext, so it was NOT rebuilt automatically."
        );
      }
    }
  } catch (err) {
    console.warn("[vanta] account_units constraint migration skipped:", err);
  }

  // Drop the index that keyed on the encrypted email (rebuilt keyed on the hash
  // by the DDL above); left in place it would let a duplicate ciphertext through.
  try {
    await store.execute({
      sql: `DROP INDEX IF EXISTS idx_vanta_account_units_email`,
      args: [],
    });
  } catch {
    // Index never existed — safe to ignore
  }

  // The login routes used to create this table lazily with a case-sensitive
  // unique index. A fresh schema now owns the table; rebuild the index so
  // Alice@x.test and alice@x.test cannot become two accounts.
  try {
    await store.execute({ sql: `DROP INDEX IF EXISTS idx_vanta_customer_credentials_email`, args: [] });
    await store.execute({
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_vanta_customer_credentials_email
            ON vanta_customer_credentials (email COLLATE NOCASE)`,
      args: [],
    });
  } catch {
    // Table may not exist yet on an older deployment — schema creation handles it.
  }

  // One inventory row per product. Without this, two concurrent first-time
  // checkouts could each insert a row, splitting/losing stock and breaking the
  // settlement trigger's "exactly one row" assumption. Consolidate any legacy
  // duplicates into the oldest row before adding the constraint.
  try {
    await store.execute({
      sql: `UPDATE vanta_inventory AS keep
            SET stock_quantity = stock_quantity + COALESCE((
                  SELECT SUM(stock_quantity) FROM vanta_inventory dup
                  WHERE dup.product_id = keep.product_id AND dup.id > keep.id
                ), 0),
                reserved_quantity = reserved_quantity + COALESCE((
                  SELECT SUM(reserved_quantity) FROM vanta_inventory dup
                  WHERE dup.product_id = keep.product_id AND dup.id > keep.id
                ), 0)
            WHERE keep.id = (SELECT MIN(id) FROM vanta_inventory WHERE product_id = keep.product_id)`,
      args: [],
    });
    await store.execute({
      sql: `DELETE FROM vanta_inventory
            WHERE id NOT IN (SELECT MIN(id) FROM vanta_inventory GROUP BY product_id)`,
      args: [],
    });
    await store.execute({
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_vanta_inventory_product_unique
            ON vanta_inventory (product_id)`,
      args: [],
    });
  } catch {
    // Older tables without the expected columns are left to manual review;
    // the app's own reads still work with whatever rows exist.
  }

  // Reconcile the catalogue display stock with the inventory ledger once at
  // boot. Older deployments had sales decrementing only vanta_inventory, so
  // product cards could advertise units that were already gone. The new
  // triggers keep the two in sync from this point on.
  try {
    await store.execute({
      sql: `UPDATE vanta_products
            SET stock_quantity = (
                  SELECT i.stock_quantity FROM vanta_inventory i
                  WHERE i.product_id = vanta_products.id
                )
            WHERE EXISTS (SELECT 1 FROM vanta_inventory i WHERE i.product_id = vanta_products.id)`,
      args: [],
    });
  } catch {
    // Inventory table missing on a legacy deployment — schema creation adds it.
  }

  // Migration: add image_url to vanta_categories (category images).
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_categories ADD COLUMN image_url TEXT NOT NULL DEFAULT ''`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: vanta_appointments.updated_at. Two writers (delivery-evidence
  // updates and the customer confirm route) set it, but the original DDL
  // never declared it — every second evidence upload and every customer
  // delivery confirmation died with "no such column".
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_appointments ADD COLUMN updated_at TEXT`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add last_seen to vanta_admins (admin online/offline presence).
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_admins ADD COLUMN last_seen TEXT NOT NULL DEFAULT ''`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Seed the CPM2 car-name lookup from the canonical catalog. The old
  // hand-copied SQL batches had 124 bare-comma placeholder rows and silently
  // failed on a fresh database, leaving the lookup empty for most codes.
  try {
    const { CAR_CATALOG } = await import("./car-catalog.ts");
    const statements = CAR_CATALOG.filter((car) => car.game === "cpm2").map(
      (car) =>
        `INSERT OR IGNORE INTO vanta_cpm2_cars (code, name) VALUES (${car.code}, '${car.name.replace(/'/g, "''")}');`,
    );
    if (statements.length > 0) await store.batch(statements);
  } catch (err) {
    console.warn("[vanta] CPM2 car catalog seed skipped:", err);
  }

  // Payment settlement and stock deduction must be ONE database operation.
  // A trigger fires inside the same UPDATE that flips payment_state to
  // verified, so a stock shortfall aborts the whole statement and the order
  // stays payable/retryable. Doing the deduction in application code left a
  // window where the order was verified but inventory was untouched.
  await store.execute({
    sql: `CREATE TRIGGER IF NOT EXISTS vanta_payment_deducts_stock
      AFTER UPDATE OF payment_state ON vanta_orders
      WHEN NEW.payment_state = 'verified' AND OLD.payment_state <> 'verified'
      BEGIN
        SELECT CASE
          WHEN EXISTS (SELECT 1 FROM vanta_inventory WHERE product_id = NEW.product_id)
               AND NOT EXISTS (
                 SELECT 1 FROM vanta_inventory
                  WHERE product_id = NEW.product_id
                    AND reserved_quantity >= NEW.quantity
                    AND stock_quantity >= NEW.quantity
               )
          THEN RAISE(ABORT, 'insufficient stock to confirm payment')
        END;
        UPDATE vanta_inventory
           SET stock_quantity = stock_quantity - NEW.quantity,
               reserved_quantity = reserved_quantity - NEW.quantity,
               version = version + 1,
               updated_at = NEW.updated_at
         WHERE product_id = NEW.product_id
           AND reserved_quantity >= NEW.quantity
           AND stock_quantity >= NEW.quantity;
      END`,
    args: [],
  });
}

export async function closeStoreDb(): Promise<void> {
  const g = globalThis as typeof globalThis & {
    __vantaStoreDb?: TursoHttpClient;
    __vantaStoreBoot?: Promise<TursoHttpClient>;
  };
  g.__vantaStoreDb = undefined;
  g.__vantaStoreBoot = undefined;
}
