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
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
};

export type Product = {
  id: number;
  categoryId: number | null;
  cpm2CarCode: number | null;
  name: string;
  description: string;
  basePriceCents: number;
  currency: string;
  stockQuantity: number;
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
  cpm2CarCode?: number;   // CPM2 catalog car code
  name: string;
  description?: string;
  basePriceCents: number;
  currency?: string;
  stockQuantity?: number;
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
  paymentMethod: "payfast" | "eft";
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
  paymentMethod: "payfast" | "eft";
  playerId: string;
  inGameName: string;
  appointmentId: string | null;
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
