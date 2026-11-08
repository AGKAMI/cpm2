/**
 * VANTA GARAGE store schema — isolated from the CPM2 fleet schema.
 * All tables prefixed with `vanta_`. Applied idempotently on boot.
 */

export const VANTA_SCHEMA = `
CREATE TABLE IF NOT EXISTS vanta_customers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  in_game_name   TEXT    NOT NULL DEFAULT '',
  player_id      TEXT    NOT NULL DEFAULT '',
  currency_pref  TEXT    NOT NULL DEFAULT 'ZAR',
  email          TEXT    NOT NULL DEFAULT '',
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_platform_identities (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id    INTEGER NOT NULL REFERENCES vanta_customers(id) ON DELETE CASCADE,
  platform       TEXT    NOT NULL CHECK (platform IN ('telegram', 'whatsapp')),
  platform_user_id TEXT   NOT NULL,
  platform_username TEXT  NOT NULL DEFAULT '',
  linked_at      TEXT    NOT NULL,
  UNIQUE (platform, platform_user_id)
);

CREATE TABLE IF NOT EXISTS vanta_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  slug        TEXT    NOT NULL UNIQUE,
  description TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_products (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id        INTEGER REFERENCES vanta_categories(id),
  cpm2_car_code      INTEGER,                    -- links to CPM2 catalog car (from car-catalog.ts)
  name               TEXT    NOT NULL,
  description        TEXT    NOT NULL DEFAULT '',
  base_price_cents   INTEGER NOT NULL DEFAULT 0,
  currency           TEXT    NOT NULL DEFAULT 'ZAR',
  stock_quantity     INTEGER NOT NULL DEFAULT 0,
  availability_state TEXT    NOT NULL DEFAULT 'available' CHECK (availability_state IN ('available', 'limited', 'sold_out', 'unavailable')),
  exclusivity        TEXT    NOT NULL DEFAULT 'standard' CHECK (exclusivity IN ('standard', 'limited_edition', 'one_of_one')),
  is_featured        INTEGER NOT NULL DEFAULT 0,
  is_published       INTEGER NOT NULL DEFAULT 0,
  version            INTEGER NOT NULL DEFAULT 1,
  air_suspension     INTEGER NOT NULL DEFAULT 0,  -- Air suspension installation included in the design
  unlocked_bodykits  INTEGER NOT NULL DEFAULT 0,  -- Design unlocks bodykits
  spec_hp            INTEGER,
  spec_top_speed     INTEGER,
  spec_zero_hundred  TEXT,
  spec_drive         TEXT,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_product_media (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id      INTEGER NOT NULL REFERENCES vanta_products(id) ON DELETE CASCADE,
  provider        TEXT    NOT NULL DEFAULT 'local',
  provider_id     TEXT    NOT NULL DEFAULT '',
  public_url      TEXT    NOT NULL DEFAULT '',
  original_ref    TEXT    NOT NULL DEFAULT '',
  file_type       TEXT    NOT NULL DEFAULT 'image',
  width           INTEGER,
  height          INTEGER,
  file_size       INTEGER,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  version         INTEGER NOT NULL DEFAULT 1,
  is_published    INTEGER NOT NULL DEFAULT 1,
  uploaded_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_inventory (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id       INTEGER NOT NULL REFERENCES vanta_products(id) ON DELETE CASCADE,
  stock_quantity   INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  version          INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_pricing (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id       INTEGER NOT NULL REFERENCES vanta_products(id) ON DELETE CASCADE,
  currency         TEXT    NOT NULL DEFAULT 'ZAR',
  price_cents      INTEGER NOT NULL DEFAULT 0,
  exchange_rate    REAL,
  effective_from   TEXT    NOT NULL,
  effective_to     TEXT,
  created_at       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_system_config (
  key   TEXT PRIMARY KEY,
  value TEXT    NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_admins (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT   NOT NULL UNIQUE,
  telegram_username TEXT  NOT NULL DEFAULT '',
  role           TEXT     NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  added_by       TEXT,
  added_at       TEXT     NOT NULL,
  is_active      INTEGER  NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vanta_promotions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  subtitle        TEXT    NOT NULL DEFAULT '',
  description     TEXT    NOT NULL DEFAULT '',
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_code   TEXT    NOT NULL DEFAULT '',
  cta_text        TEXT    NOT NULL DEFAULT 'Shop now',
  cta_link        TEXT    NOT NULL DEFAULT '/store/categories',
  background_color TEXT   NOT NULL DEFAULT '#1c1c1f',
  accent_color    TEXT    NOT NULL DEFAULT '#d4af4f',
  image_url       TEXT    NOT NULL DEFAULT '',
  is_active       INTEGER NOT NULL DEFAULT 1,
  start_date      TEXT,
  end_date        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_platform TEXT,
  actor_user_id TEXT,
  action      TEXT    NOT NULL,
  entity_type TEXT    NOT NULL,
  entity_id   TEXT,
  details     TEXT    NOT NULL DEFAULT '{}',
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_financial_ledger (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         TEXT,
  type             TEXT    NOT NULL CHECK (type IN ('payment', 'refund', 'fee', 'adjustment', 'chargeback')),
  amount_cents     INTEGER NOT NULL DEFAULT 0,
  currency         TEXT    NOT NULL DEFAULT 'ZAR',
  exchange_rate    REAL,
  related_payment_id TEXT,
  recorded_at      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_orders (
  id                 TEXT PRIMARY KEY,
  customer_id        INTEGER NOT NULL REFERENCES vanta_customers(id),
  product_id         INTEGER NOT NULL REFERENCES vanta_products(id),
  quantity           INTEGER NOT NULL DEFAULT 1,
  order_state        TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (order_state IN ('checkout_initiated', 'awaiting_payment', 'payment_verification', 'payment_confirmed', 'processing', 'delivery_scheduled', 'awaiting_delivery', 'delivery_in_progress', 'delivery_verified', 'completed', 'cancelled', 'refund_pending', 'refunded', 'disputed')),
  payment_state      TEXT    NOT NULL DEFAULT 'pending' CHECK (payment_state IN ('pending', 'verified', 'rejected', 'expired')),
  delivery_state     TEXT    NOT NULL DEFAULT 'unscheduled' CHECK (delivery_state IN ('unscheduled', 'scheduled', 'in_progress', 'completed', 'missed')),
  amount_cents       INTEGER NOT NULL DEFAULT 0,
  currency           TEXT    NOT NULL DEFAULT 'ZAR',
  exchange_rate      REAL,
  reserved_until     TEXT,
  payment_method     TEXT    NOT NULL DEFAULT 'eft' CHECK (payment_method IN ('payfast', 'eft')),
  player_id          TEXT    NOT NULL DEFAULT '',
  in_game_name       TEXT    NOT NULL DEFAULT '',
  idempotency_key    TEXT    NOT NULL UNIQUE,
  appointment_id     TEXT,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        TEXT NOT NULL REFERENCES vanta_orders(id),
  provider        TEXT    NOT NULL,
  provider_ref    TEXT    NOT NULL,
  amount_cents    INTEGER NOT NULL DEFAULT 0,
  currency        TEXT    NOT NULL DEFAULT 'ZAR',
  status          TEXT    NOT NULL DEFAULT 'pending',
  webhook_received INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_appointments (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES vanta_orders(id),
  scheduled_at    TEXT    NOT NULL,
  admin_platform  TEXT    NOT NULL CHECK (admin_platform IN ('telegram', 'whatsapp')),
  admin_user_id   TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'missed')),
  delivery_evidence TEXT,
  customer_confirmed INTEGER NOT NULL DEFAULT 0,
  missed_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vanta_platform_identities_platform_user
  ON vanta_platform_identities (platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_vanta_products_category
  ON vanta_products (category_id);
CREATE INDEX IF NOT EXISTS idx_vanta_products_published
  ON vanta_products (is_published);
CREATE INDEX IF NOT EXISTS idx_vanta_products_featured
  ON vanta_products (is_featured);
CREATE INDEX IF NOT EXISTS idx_vanta_inventory_product
  ON vanta_inventory (product_id);
CREATE INDEX IF NOT EXISTS idx_vanta_pricing_product
  ON vanta_pricing (product_id);
CREATE INDEX IF NOT EXISTS idx_vanta_audit_logs_created
  ON vanta_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vanta_financial_ledger_order
  ON vanta_financial_ledger (order_id);
`;
