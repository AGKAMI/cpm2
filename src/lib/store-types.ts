/**
 * VANTA GARAGE store domain types.
 */

export type Exclusivity = "standard" | "limited_edition" | "one_of_one";
export type AvailabilityState = "available" | "limited" | "sold_out" | "unavailable";
export type Platform = "telegram" | "whatsapp";

export type Customer = {
  id: number;
  inGameName: string;
  playerId: string;
  currencyPref: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformIdentity = {
  id: number;
  customerId: number;
  platform: Platform;
  platformUserId: string;
  platformUsername: string;
  linkedAt: string;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
    isActive: boolean;
    /** Which game's catalogue this category belongs to. Scoped so a CPM2
     *  shopper never sees CPM1's tree (and vice versa) as empty results. */
    game: ProductGame;
    createdAt: string;
  };

export type ProductKind = "car" | "account" | "service";
export type ProductGame = "cpm1" | "cpm2";

export type Product = {
  id: number;
  categoryId: number | null;
  /** 'car' = a vehicle, 'account' = a CPM credential unit. Never share a card layout. */
  kind: ProductKind;
  /** Which game the product belongs to. Car codes are NOT unique across games
   *  (CPM1 #2 is a Perodua Myvi, CPM2 #2 is a Scirocco III), so this tag is
   *  what makes a code, a price or a catalogue lookup unambiguous. */
  game: ProductGame;
  cpm2CarCode: number | null;
  /**
   * Raw image path for a product cover, when one is stored on the product row.
   * Null today: the live vanta_products table has no image column — covers come
   * from the product media tables (see listCoverImageMap). Public payloads get
   * the absolute URL as `coverUrl`; this stays null until a column exists.
   */
  imageUrl: string | null;
  name: string;
  description: string;
  basePriceCents: number;
  discountPercent: number;             // 0-90; sale price = base * (100 - discount) / 100
  currency: string;
  stockQuantity: number;
  stockInitial: number;         // baseline at creation / last restock — for ratio color tiers
  availabilityState: AvailabilityState;
  exclusivity: Exclusivity;
  isFeatured: boolean;
  isNew: boolean;
  isSale: boolean;
  isPublished: boolean;
  version: number;
  airSuspension: boolean;       // Air suspension installation included
  unlockedBodykits: boolean;    // Design unlocks bodykits
  specHp: number | null;        // legacy — perf specs kept for old rows only
  specTopSpeed: number | null;
  specZeroHundred: string | null;
  specDrive: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductMedia = {
  id: number;
  productId: number;
  provider: string;
  providerId: string;
  publicUrl: string;
  originalRef: string;
  fileType: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  sortOrder: number;
  version: number;
  isPublished: boolean;
  uploadedAt: string;
};

export type Inventory = {
  id: number;
  productId: number;
  stockQuantity: number;
  reservedQuantity: number;
  version: number;
  updatedAt: string;
};

export type Pricing = {
  id: number;
  productId: number;
  currency: string;
  priceCents: number;
  exchangeRate: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
};

export type SystemConfig = {
  key: string;
  value: string;
  updatedAt: string;
};

export type AuditLog = {
  id: number;
  actorPlatform: Platform | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  createdAt: string;
};

export type FinancialLedgerEntry = {
  id: number;
  orderId: string | null;
  type: "payment" | "refund" | "fee" | "adjustment" | "chargeback";
  amountCents: number;
  currency: string;
  exchangeRate: number | null;
  relatedPaymentId: string | null;
  recordedAt: string;
};

// ----- API request/response shapes -----

export type CreateCustomerInput = {
  inGameName: string;
  playerId: string;
  telegramId?: string;
  whatsappId?: string;
};

export type ProductInput = {
  categoryId?: number;
  kind?: ProductKind;     // 'car' (default) | 'account'
  game?: ProductGame;     // 'cpm2' (default) | 'cpm1'
  cpm2CarCode?: number;   // CPM2 catalog car code
  name: string;
  description?: string;
  basePriceCents: number;
  discountPercent?: number;             // 0-90; sale price = base * (100 - discount) / 100
  currency?: string;
  stockQuantity?: number;
  stockInitial?: number;
  availabilityState?: AvailabilityState;
  exclusivity?: Exclusivity;
  isFeatured?: boolean;
  isNew?: boolean;
  isSale?: boolean;
  isPublished?: boolean;
  airSuspension?: boolean;      // Air suspension installation included
  unlockedBodykits?: boolean;   // Design unlocks bodykits
  specHp?: number;              // legacy — accepted for old rows, UI removed
  specTopSpeed?: number;
  specZeroHundred?: string;
  specDrive?: string;
};

export type OrderState = "awaiting_payment" | "payment_confirmed" | "processing" | "delivery_scheduled" | "awaiting_delivery" | "delivery_in_progress" | "delivery_verified" | "completed" | "cancelled" | "refund_pending" | "refunded" | "disputed";
export type PaymentState = "pending" | "verified" | "rejected" | "expired";
export type DeliveryState = "unscheduled" | "scheduled" | "in_progress" | "completed" | "missed";

export type CheckoutSession = {
  step: "awaiting_details" | "awaiting_confirm" | "done";
  productId: number;
  paymentMethod: "payfast" | "eft" | "stars";
  playerId?: string;
  inGameName?: string;
};

export type Order = {
  id: string;
  customerId: number;
  productId: number;
  quantity: number;
  orderState: OrderState;
  paymentState: PaymentState;
  deliveryState: DeliveryState;
  amountCents: number;
  currency: string;
  exchangeRate: number | null;
  reservedUntil: string | null;
  paymentMethod: "payfast" | "eft" | "stars";
  playerId: string;
  inGameName: string;
  appointmentId: string | null;
  /** Uploaded EFT proof of payment (the durable uploads URL), when attached. */
  eftProofUrl?: string | null;
  /** What was bought, snapshotted at order time. Orders outlive products:
      a deleted or renamed product must never blank out purchase history. */
  productName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Appointment = {
  id: string;
  orderId: string;
  scheduledAt: string;
  adminPlatform: Platform;
  adminUserId: string;
  status: "scheduled" | "completed" | "missed";
  deliveryEvidence: string | null;
  customerConfirmed: boolean;
  missedCount: number;
  createdAt: string;
};

export type Promotion = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  discountPercent: number;
  discountCode: string;
  ctaText: string;
  ctaLink: string;
  backgroundColor: string;
  accentColor: string;
  imageUrl: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  /** Which catalogue this promotion belongs to. Null = both games. */
  game: "cpm1" | "cpm2" | null;
  /** The attached product. When set, the promotion overrides that product's
   *  displayed price and card styling on the storefront. */
  productId: number | null;
  /** Hue of the Promoted pill. The metallic material + shine are fixed. */
  pillColor: string;
  createdAt: string;
  updatedAt: string;
};

export type PromotionInput = {
  title: string;
  subtitle?: string;
  description?: string;
  discountPercent?: number;
  discountCode?: string;
  ctaText?: string;
  ctaLink?: string;
  backgroundColor?: string;
  accentColor?: string;
  imageUrl?: string;
  isActive?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  sortOrder?: number;
  /** cpm1 | cpm2, or null for both games. */
  game?: "cpm1" | "cpm2" | null;
  /** Attach an existing product; null detaches. */
  productId?: number | null;
  /** Promoted-pill hue (metallic material + shine stay fixed). */
  pillColor?: string;
};
