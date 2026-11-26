/**
 * VANTA GARAGE store schema — isolated from the CPM2 fleet schema.
 * All tables prefixed with `vanta_`. Applied idempotently on boot.
 */

/**
 * Single source of truth for the account-units DDL. Named so the migration in
 * store-db.ts can rebuild this table without duplicating the definition — a
 * second copy would drift and silently reintroduce the dedupe bug below.
 *
 * UNIQUE is on (email_hash, product_id), NOT (email, product_id): email is
 * AES-256-GCM encrypted with a random IV, so the same address never encrypts to
 * the same string twice. The old constraint could therefore never match, and
 * re-importing the same .txt block duplicated every unit (proved: one 3-unit
 * block imported twice = 6 rows). email_hash is a stable sha256 of the
 * plaintext and is what dedupe compares.
 */
export const VANTA_ACCOUNT_UNITS_DDL = `
CREATE TABLE IF NOT EXISTS vanta_account_units (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER REFERENCES vanta_products(id) ON DELETE SET NULL,
  email          TEXT    NOT NULL,
  email_hash     TEXT    NOT NULL DEFAULT '',
  password       TEXT    NOT NULL,
  notes          TEXT    NOT NULL DEFAULT '',
  status         TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'assigned', 'sold')),
  game           TEXT    NOT NULL DEFAULT 'cpm2' CHECK (game IN ('cpm1', 'cpm2')),
  -- Set the moment a checkout claims the unit, so two buyers can never hold
  -- the same credential and a refund knows exactly what to restore.
  order_id       TEXT    REFERENCES vanta_orders(id) ON DELETE SET NULL,
  customer_id    INTEGER REFERENCES vanta_customers(id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,
  UNIQUE (email_hash, product_id)
)`;

export const VANTA_SCHEMA = `
CREATE TABLE IF NOT EXISTS vanta_customers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  in_game_name   TEXT    NOT NULL DEFAULT '',
  product_name         TEXT,                            -- what was bought, snapshotted at order time (orders outlive products)
  player_id      TEXT    NOT NULL DEFAULT '',
  currency_pref  TEXT    NOT NULL DEFAULT 'ZAR',
  email          TEXT    NOT NULL DEFAULT '',
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
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
  -- Categories are game-scoped: a CPM2 shopper clicking "Flags" must not land
  -- on 0 results. Defaults to cpm2 because every existing row is a CPM2 car
  -- category (Coupes/Sedans/SUVs/4x4s/Hatchbacks/Van).
  game        TEXT    NOT NULL DEFAULT 'cpm2' CHECK (game IN ('cpm1', 'cpm2')),
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_cpm2_cars (
  code   INTEGER PRIMARY KEY,
  name   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_products (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id        INTEGER REFERENCES vanta_categories(id),
  -- What kind of thing is this? 'car' = a vehicle, 'account' = a CPM
  -- credential unit, 'service' = work done on an account (the bot's "mods").
  -- The CHECK that used to live here listed only car/account: on a FRESH
  -- database the admin UI's service creation died on the constraint, while
  -- the live DB (migrated earlier without it) accepted services fine. The
  -- DDL now matches the column the app actually writes.
  kind               TEXT    NOT NULL DEFAULT 'car' CHECK (kind IN ('car', 'account', 'service')),
  -- Which game the product belongs to. Car codes are NOT unique across games
  -- (CPM1 #2 is a Perodua Myvi, CPM2 #2 is a Scirocco III), so the game tag
  -- is what makes a code, a price or a catalogue lookup unambiguous.
  game               TEXT    NOT NULL DEFAULT 'cpm2' CHECK (game IN ('cpm1', 'cpm2')),
  cpm2_car_code      INTEGER,                    -- links to CPM2 catalog car (from car-catalog.ts)
  name               TEXT    NOT NULL,
  description        TEXT    NOT NULL DEFAULT '',
  base_price_cents   INTEGER NOT NULL DEFAULT 0,
  discount_percent   INTEGER NOT NULL DEFAULT 0,  -- 0-90; sale price = base * (100 - discount) / 100
  currency           TEXT    NOT NULL DEFAULT 'ZAR',
  stock_quantity     INTEGER NOT NULL DEFAULT 0,
  initial_stock      INTEGER NOT NULL DEFAULT 0,  -- stock at creation / last restock — drives ratio-based color tiers
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
  type  TEXT    NOT NULL DEFAULT 'string',
  is_sensitive INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_admins (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT   NOT NULL UNIQUE,
  telegram_username TEXT  NOT NULL DEFAULT '',
  nickname       TEXT     NOT NULL DEFAULT '',
  role           TEXT     NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  added_by       TEXT,
  added_at       TEXT     NOT NULL,
  is_active      INTEGER  NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vanta_telegram_verifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL REFERENCES vanta_customers(id) ON DELETE CASCADE,
  telegram_user_id TEXT    NOT NULL,
  verification_code TEXT   NOT NULL UNIQUE,
  status          TEXT     NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
  expires_at      TEXT     NOT NULL,
  created_at      TEXT     NOT NULL,
  confirmed_at    TEXT
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

CREATE TABLE IF NOT EXISTS vanta_alerts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT    NOT NULL,
  title         TEXT    NOT NULL DEFAULT '',
  message       TEXT    NOT NULL DEFAULT '',
  severity      TEXT    NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  entity_type   TEXT    NOT NULL DEFAULT '',
  entity_id     TEXT,
  related_order_id TEXT,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vanta_alerts_created ON vanta_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vanta_alerts_unread ON vanta_alerts (is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS vanta_jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT    NOT NULL,
  payload       TEXT    NOT NULL DEFAULT '{}',
  status        TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 3,
  next_run_at   TEXT    NOT NULL,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  error         TEXT
);

CREATE INDEX IF NOT EXISTS idx_vanta_jobs_status_next ON vanta_jobs (status, next_run_at);

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
  payment_method     TEXT    NOT NULL DEFAULT 'eft' CHECK (payment_method IN ('payfast', 'eft', 'stars')),
  player_id          TEXT    NOT NULL DEFAULT '',
  in_game_name       TEXT    NOT NULL DEFAULT '',
  idempotency_key    TEXT    NOT NULL UNIQUE,
  appointment_id     TEXT,
  eft_proof_url      TEXT,
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

CREATE TABLE IF NOT EXISTS vanta_support_tickets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL REFERENCES vanta_customers(id) ON DELETE CASCADE,
  subject         TEXT    NOT NULL DEFAULT '',
  message         TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority        TEXT    NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  admin_reply     TEXT,
  resolved_at     TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vanta_wishlist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES vanta_customers(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES vanta_products(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL,
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_vanta_support_tickets_customer
  ON vanta_support_tickets (customer_id);
CREATE INDEX IF NOT EXISTS idx_vanta_support_tickets_status
  ON vanta_support_tickets (status);
CREATE TABLE IF NOT EXISTS vanta_cart_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES vanta_customers(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES vanta_products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_vanta_cart_items_customer
  ON vanta_cart_items (customer_id);
CREATE INDEX IF NOT EXISTS idx_vanta_wishlist_customer
  ON vanta_wishlist (customer_id);
CREATE INDEX IF NOT EXISTS idx_vanta_wishlist_product
  ON vanta_wishlist (product_id);

CREATE TABLE IF NOT EXISTS vanta_notifications (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id       INTEGER NOT NULL REFERENCES vanta_customers(id) ON DELETE CASCADE,
  type              TEXT    NOT NULL DEFAULT 'general',
  title             TEXT    NOT NULL DEFAULT '',
  message           TEXT    NOT NULL DEFAULT '',
  is_read           INTEGER NOT NULL DEFAULT 0,
  related_product_id INTEGER,
  related_order_id  TEXT,
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vanta_notifications_customer ON vanta_notifications (customer_id);
CREATE INDEX IF NOT EXISTS idx_vanta_notifications_unread ON vanta_notifications (customer_id, is_read, created_at DESC);

-- Uploaded admin images, stored in the DB so serverless deploys (read-only FS)
-- can still serve them. Filename is the public URL key; bytes are base64.
CREATE TABLE IF NOT EXISTS vanta_uploads (
  filename     TEXT    PRIMARY KEY,
  data_base64  TEXT    NOT NULL,
  content_type TEXT    NOT NULL DEFAULT 'image/jpeg',
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL
);

-- One credential-unit of an account-kind product (CPM1/CPM2 account for resale).
--
-- Status flow: pending (forwarded by the clone bot, not yet trusted) ->
-- available (owner assigned the unit to a listing) -> assigned (a buyer's
-- checkout claimed it atomically) -> sold (delivered).
--
-- email and password are ENCRYPTED at rest — never log them, never return
-- them in a public response, and mask them in admin once delivered. Losing the
-- encryption key means the units are unusable, which is the intended trade for
-- not storing plaintext buyer credentials.


${VANTA_ACCOUNT_UNITS_DDL}

CREATE INDEX IF NOT EXISTS idx_vanta_account_units_product
  ON vanta_account_units (product_id, status);
CREATE INDEX IF NOT EXISTS idx_vanta_account_units_pending
  ON vanta_account_units (status, created_at);
CREATE INDEX IF NOT EXISTS idx_vanta_account_units_order
  ON vanta_account_units (order_id);
`;
