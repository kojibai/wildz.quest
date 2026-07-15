import type {
  BlogPost,
  BrandConfig,
  Campaign,
  CheckoutState,
  Collection,
  CommerceState,
  ExchangeConfig,
  GameConfig,
  HostingConfig,
  NavigationItem,
  Order,
  Product,
  ProofEvent,
  QualifyingObjectType,
  ReceizedAsset,
  Reward,
  RewardRule,
  SitePage,
  StorefrontConfig
} from "../../types/domain";

export const STORE_STATE_SCHEMA = "receiz.app.store_state.v1";
export const STORE_STATE_CONNECT_SCHEMA = "receiz.app.store_state_connect.v1";
export const COMMERCE_EVENT_SCHEMA = "receiz.app.commerce_event.v1";

export type PublishedStoreState = {
  brand: BrandConfig;
  storefront: StorefrontConfig;
  hosting: HostingConfig;
  navigation: NavigationItem[];
  pages: SitePage[];
  blogPosts: BlogPost[];
  collections: Collection[];
  products: Product[];
  rewards: Reward[];
  rewardRules: RewardRule[];
  assets: ReceizedAsset[];
  qualifiers: QualifyingObjectType[];
  campaigns: Campaign[];
  exchange: ExchangeConfig;
  game: GameConfig;
  checkout: CheckoutState;
};

export type StoreStateRecord = {
  schema: typeof STORE_STATE_SCHEMA;
  id: string;
  type: "store.state.published";
  reason: "publish" | "sync" | "restore";
  recordedAt: string;
  actorReceizId: string;
  tenantHost: string;
  tenantSlug: string;
  merchantReceizId: string;
  state: PublishedStoreState;
};

export type StoreStateConnectRecord = {
  schema: typeof STORE_STATE_CONNECT_SCHEMA;
  event: "store.state.published";
  platform: string;
  recordedAt: string;
  tenantHost: string;
  tenantSlug: string;
  merchantReceizId: string;
  data: {
    action: "store.published";
    storeStateRecordId: string;
    tenantHost: string;
    tenantSlug: string;
    merchantReceizId: string;
    recordedAt: string;
  };
};

export type CommerceEventType =
  | "checkout.created"
  | "checkout.requires_card"
  | "checkout.settled"
  | "checkout.failed"
  | "order.fulfilled"
  | "payment.refunded";

export type CommerceEventData = {
  orderId?: string;
  checkoutSessionId?: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  totalLabel?: string;
  itemCount?: number;
  paymentRail?: Order["paymentRail"];
  settlementStatus?: Order["settlementStatus"];
  funding?: Order["funding"];
  fulfillment?: Order["fulfillment"];
  shipping?: Order["shipping"];
  receiptId?: string;
  proofBundle?: Record<string, unknown> | null;
};

export type CommerceEventRecord = {
  schema: typeof COMMERCE_EVENT_SCHEMA;
  id: string;
  type: CommerceEventType;
  createdAt: string;
  tenantHost: string;
  merchantReceizId: string;
  data: CommerceEventData;
};

export type StoreStateRecordInput = {
  actorReceizId: string;
  tenantHost?: string;
  reason?: StoreStateRecord["reason"];
  recordedAt?: string;
};

function stableSlug(value: string) {
  return value
    .split(".")[0]
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function recordId(prefix: string, tenantHost: string, recordedAt: string) {
  const stamp = recordedAt.replace(/[^0-9a-z]/gi, "");
  return `${prefix}:${tenantHost}:${stamp}`;
}

const MAX_COMPACT_INLINE_MEDIA_CHARS = 160_000;

function shouldCompactInlineMedia(path: string[], value: string) {
  const key = path.at(-1) ?? "";

  if (key === "socialImageUrl") return true;
  return value.startsWith("data:") && value.length > MAX_COMPACT_INLINE_MEDIA_CHARS;
}

function compactInlineMedia(value: unknown, path: string[] = []): unknown {
  if (typeof value === "string") {
    return value.startsWith("data:") && shouldCompactInlineMedia(path, value) ? null : value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => compactInlineMedia(item, [...path, String(index)]));
  }

  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, compactInlineMedia(item, [...path, key])])
  );
}

export function compactPublishedState<T>(value: T): T {
  return compactInlineMedia(structuredClone(value)) as T;
}

function clonePublishedState(state: CommerceState): PublishedStoreState {
  return {
    brand: compactPublishedState(state.brand),
    storefront: compactPublishedState(state.storefront),
    hosting: compactPublishedState(state.hosting),
    navigation: compactPublishedState(state.navigation),
    pages: compactPublishedState(state.pages),
    blogPosts: compactPublishedState(state.blogPosts),
    collections: compactPublishedState(state.collections),
    products: compactPublishedState(state.products),
    rewards: compactPublishedState(state.rewards),
    rewardRules: compactPublishedState(state.rewardRules),
    assets: compactPublishedState(state.assets),
    qualifiers: compactPublishedState(state.qualifiers),
    campaigns: compactPublishedState(state.campaigns),
    exchange: compactPublishedState(state.exchange),
    game: compactPublishedState(state.game),
    checkout: compactPublishedState(state.checkout)
  };
}

function tenantHostFromState(state: CommerceState, inputHost?: string) {
  return (
    inputHost?.trim().toLowerCase() ||
    state.hosting.customDomain.domain.trim().toLowerCase() ||
    state.hosting.subdomain.trim().toLowerCase()
  );
}

export function buildStoreStateRecord(state: CommerceState, input: StoreStateRecordInput): StoreStateRecord {
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  const tenantHost = tenantHostFromState(state, input.tenantHost);
  const tenantSlug = state.hosting.tenantSlug || stableSlug(tenantHost);
  const merchantReceizId = state.hosting.merchantReceizId || input.actorReceizId;

  return {
    schema: STORE_STATE_SCHEMA,
    id: recordId("store_state", tenantHost, recordedAt),
    type: "store.state.published",
    reason: input.reason ?? "publish",
    recordedAt,
    actorReceizId: input.actorReceizId,
    tenantHost,
    tenantSlug,
    merchantReceizId,
    state: clonePublishedState(state)
  };
}

export function buildStoreStateConnectRecord(
  record: StoreStateRecord,
  platform = "Receiz.app Commerce Cloud"
): StoreStateConnectRecord {
  return {
    schema: STORE_STATE_CONNECT_SCHEMA,
    event: "store.state.published",
    platform,
    recordedAt: record.recordedAt,
    tenantHost: record.tenantHost,
    tenantSlug: record.tenantSlug,
    merchantReceizId: record.merchantReceizId,
    data: {
      action: "store.published",
      storeStateRecordId: record.id,
      tenantHost: record.tenantHost,
      tenantSlug: record.tenantSlug,
      merchantReceizId: record.merchantReceizId,
      recordedAt: record.recordedAt
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCommerceEventType(value: unknown): value is CommerceEventType {
  return (
    value === "checkout.created" ||
    value === "checkout.requires_card" ||
    value === "checkout.settled" ||
    value === "checkout.failed" ||
    value === "order.fulfilled" ||
    value === "payment.refunded"
  );
}

export function isStoreStateRecord(value: unknown): value is StoreStateRecord {
  return isRecord(value) && value.schema === STORE_STATE_SCHEMA && isRecord(value.state);
}

export function isCommerceEventRecord(value: unknown): value is CommerceEventRecord {
  return isRecord(value) && value.schema === COMMERCE_EVENT_SCHEMA && isCommerceEventType(value.type) && isRecord(value.data);
}

export function storeStateRecordMatchesTenantHost(record: StoreStateRecord, tenantHost: string) {
  const normalized = tenantHost.trim().toLowerCase();
  return (
    record.tenantHost === normalized ||
    record.state.hosting.subdomain.toLowerCase() === normalized ||
    record.state.hosting.customDomain.domain.toLowerCase() === normalized
  );
}

export function storeStateProjectionSource(records: unknown[], tenantHost: string): "published" | "fallback" {
  return records
    .filter(isStoreStateRecord)
    .some((record) => storeStateRecordMatchesTenantHost(record, tenantHost))
    ? "published"
    : "fallback";
}

export function projectStoreStateFromRecords(
  baseState: CommerceState,
  records: unknown[],
  tenantHost: string
): CommerceState {
  const latest = records
    .filter(isStoreStateRecord)
    .filter((record) => storeStateRecordMatchesTenantHost(record, tenantHost))
    .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt))[0];

  if (!latest) return baseState;

  return {
    ...baseState,
    ...latest.state,
    cart: { lines: [] },
    orders: [],
    customers: [],
    listings: [],
    receiz: baseState.receiz,
    auth: baseState.auth,
    publish: {
      ...baseState.publish,
      checklist: baseState.publish.checklist
    },
    proofEvents: []
  };
}

function normalizeHost(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function commerceTenantAliases(state: CommerceState, tenantHost: string) {
  return new Set(
    [tenantHost, state.hosting.subdomain, state.hosting.customDomain.domain]
      .map((host) => normalizeHost(host))
      .filter(Boolean)
  );
}

function matchesCommerceTenant(event: CommerceEventRecord, aliases: Set<string>) {
  return aliases.has(normalizeHost(event.tenantHost));
}

export function projectCommerceEventsFromRecords(
  baseState: CommerceState,
  records: unknown[],
  tenantHost: string
): CommerceState {
  const aliases = commerceTenantAliases(baseState, tenantHost);

  return records
    .filter(isCommerceEventRecord)
    .filter((event) => matchesCommerceTenant(event, aliases))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .reduce((projected, event) => admitCommerceEvent(projected, event).state, baseState);
}

function paymentRailFromEvent(event: CommerceEventRecord): Order["paymentRail"] {
  if (event.data.paymentRail) return event.data.paymentRail;
  if (event.type === "checkout.requires_card") return "card_fallback";
  if (event.type === "checkout.settled") return "receiz_wallet";
  return "receiz_checkout";
}

function settlementStatusFromEvent(event: CommerceEventRecord): Order["settlementStatus"] {
  if (event.data.settlementStatus) return event.data.settlementStatus;
  if (event.type === "checkout.requires_card") return "card_required";
  if (event.type === "checkout.settled" || event.type === "order.fulfilled") return "settled";
  if (event.type === "payment.refunded") return "refunded";
  return "pending";
}

function orderStatusFromEvent(event: CommerceEventRecord): Order["status"] {
  if (event.type === "checkout.requires_card") return "card_required";
  if (event.type === "checkout.settled") return "settled";
  if (event.type === "order.fulfilled") return "fulfilled";
  if (event.type === "payment.refunded") return "refunded";
  return "pending";
}

function eventOrder(state: CommerceState, event: CommerceEventRecord): Order {
  const customerId = event.data.customerId || `customer:${event.data.customerEmail || event.id}`;
  const orderId = event.data.orderId || event.data.checkoutSessionId || event.id;
  const fulfillmentStatus = event.data.fulfillment?.status;
  const status =
    fulfillmentStatus === "shipping_required"
      ? "pending"
      : fulfillmentStatus === "payment_required"
        ? "card_required"
        : orderStatusFromEvent(event);
  const sealed =
    fulfillmentStatus === "ready_to_ship" ||
    fulfillmentStatus === "delivery_queued" ||
    fulfillmentStatus === "fulfilled" ||
    (!fulfillmentStatus && (event.type === "checkout.settled" || event.type === "order.fulfilled"));

  return {
    id: orderId,
    customerId,
    customerEmail: event.data.customerEmail,
    totalLabel: event.data.totalLabel || "$0.00",
    status,
    itemCount: event.data.itemCount ?? 1,
    sealed,
    createdAt: event.createdAt,
    merchantReceizId: event.merchantReceizId || state.hosting.merchantReceizId,
    tenantHost: event.tenantHost,
    checkoutSessionId: event.data.checkoutSessionId,
    paymentRail: paymentRailFromEvent(event),
    settlementStatus: settlementStatusFromEvent(event),
    funding: event.data.funding,
    fulfillment: event.data.fulfillment,
    shipping: event.data.shipping
  };
}

function upsertOrder(orders: Order[], order: Order) {
  if (!orders.some((item) => item.id === order.id)) return [order, ...orders];
  return orders.map((item) => (item.id === order.id ? { ...item, ...order } : item));
}

function upsertCustomer(state: CommerceState, order: Order, event: CommerceEventRecord) {
  const customerId = order.customerId;
  const existing = state.customers.find((customer) => customer.id === customerId);
  const customer = {
    ...(existing ?? {
      id: customerId,
      name: event.data.customerName || event.data.customerEmail || "Receiz customer",
      email: event.data.customerEmail || "",
      tier: "Customer",
      rewardsValueLabel: "$0",
      beans: 0,
      streak: "0x",
      orderIds: [],
      rewardIds: [],
      assetIds: []
    }),
    name: event.data.customerName || existing?.name || event.data.customerEmail || "Receiz customer",
    email: event.data.customerEmail || existing?.email || "",
    shippingAddress: event.data.shipping ?? existing?.shippingAddress,
    orderIds: Array.from(new Set([order.id, ...(existing?.orderIds ?? [])]))
  };

  if (!existing) return [customer, ...state.customers];
  return state.customers.map((item) => (item.id === customer.id ? customer : item));
}

function proofEventForCommerceEvent(event: CommerceEventRecord, order: Order): ProofEvent {
  const settled = order.settlementStatus === "settled";
  const refunded = order.settlementStatus === "refunded";

  return {
    id: event.id,
    type: settled ? "ORDER_VERIFIED" : "OBJECT_VERIFIED",
    title: settled ? "ORDER_VERIFIED" : refunded ? "PAYMENT_REFUNDED" : "CHECKOUT_RECORDED",
    detail: `${order.id} · ${order.paymentRail ?? "receiz_checkout"} · ${event.merchantReceizId}`,
    status: settled ? "verified" : "linked",
    timestampLabel: "now",
    createdAt: event.createdAt
  };
}

export function admitCommerceEvent(
  state: CommerceState,
  event: CommerceEventRecord
): { admitted: boolean; state: CommerceState } {
  if (!isCommerceEventRecord(event)) return { admitted: false, state };
  if (state.proofEvents.some((proofEvent) => proofEvent.id === event.id)) {
    return { admitted: false, state };
  }

  const order = eventOrder(state, event);
  const proofEvent = proofEventForCommerceEvent(event, order);

  return {
    admitted: true,
    state: {
      ...state,
      orders: upsertOrder(state.orders, order),
      customers: upsertCustomer(state, order, event),
      proofEvents: [proofEvent, ...state.proofEvents]
    }
  };
}

function stringFromRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function stringFromRecords(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    const value = stringFromRecord(record, keys);
    if (value) return value;
  }
  return undefined;
}

function numberFromRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function numberFromRecords(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    const value = numberFromRecord(record, keys);
    if (typeof value === "number") return value;
  }
  return undefined;
}

function moneyLabelFromRecords(records: Record<string, unknown>[]) {
  const explicit = stringFromRecords(records, ["totalLabel", "total_label", "amountLabel", "amount_label"]);
  if (explicit) return explicit;

  const amountUsd = numberFromRecords(records, ["amountUsd", "amount_usd", "totalUsd", "total_usd", "amount"]);
  if (typeof amountUsd === "number") return `$${amountUsd.toFixed(2)}`;

  const amountCents = numberFromRecords(records, ["amountUsdCents", "amount_usd_cents", "amountCents", "amount_cents"]);
  if (typeof amountCents === "number") return `$${(amountCents / 100).toFixed(2)}`;

  return undefined;
}

function itemCountFromRecords(records: Record<string, unknown>[]) {
  const itemCount = numberFromRecords(records, ["itemCount", "item_count"]);
  return typeof itemCount === "number" ? Math.max(1, Math.trunc(itemCount)) : undefined;
}

function normalizeCommerceEventType(type?: string): CommerceEventType | null {
  if (!type) return "checkout.settled";
  if (isCommerceEventType(type)) return type;

  switch (type.trim().toLowerCase()) {
    case "checkout.session.created":
    case "order.created":
      return "checkout.created";
    case "checkout.session.requires_card":
    case "payment.requires_card":
    case "payment.requires_action":
      return "checkout.requires_card";
    case "checkout.session.completed":
    case "payment.completed":
    case "payment.succeeded":
    case "payment.settled":
    case "wallet.transfer.completed":
    case "wallet.transfer.settled":
      return "checkout.settled";
    case "payment.created":
      return "checkout.created";
    case "payment.refunded":
      return "payment.refunded";
    case "checkout.session.failed":
    case "payment.failed":
    case "wallet.transfer.failed":
      return "checkout.failed";
    default:
      return null;
  }
}

function paymentRailFromWebhook(records: Record<string, unknown>[], eventType: CommerceEventType, rawType?: string) {
  const explicit = stringFromRecords(records, ["paymentRail", "payment_rail"]);
  if (explicit) return explicit as Order["paymentRail"];

  const walletApplied = numberFromRecords(records, [
    "walletAppliedUsdCents",
    "wallet_applied_usd_cents",
    "walletAppliedCents",
    "wallet_applied_cents"
  ]);
  const cardDelta = numberFromRecords(records, [
    "cardDeltaUsdCents",
    "card_delta_usd_cents",
    "cardDeltaCents",
    "card_delta_cents"
  ]);
  if (typeof walletApplied === "number" && walletApplied > 0 && typeof cardDelta === "number" && cardDelta > 0) {
    return "wallet_card_split";
  }
  if (typeof walletApplied === "number" && walletApplied > 0) return "receiz_wallet";
  if (typeof cardDelta === "number" && cardDelta > 0) return "card_fallback";

  const normalizedRawType = rawType?.trim().toLowerCase();
  if (normalizedRawType?.startsWith("wallet.transfer.")) return "receiz_wallet";
  if (eventType === "checkout.requires_card") return "card_fallback";
  return undefined;
}

function settlementStatusFromWebhook(records: Record<string, unknown>[], eventType: CommerceEventType) {
  const explicit = stringFromRecords(records, ["settlementStatus", "settlement_status"]);
  if (explicit) return explicit as Order["settlementStatus"];
  if (eventType === "checkout.requires_card") return "card_required";
  if (eventType === "checkout.settled" || eventType === "order.fulfilled") return "settled";
  if (eventType === "payment.refunded") return "refunded";
  return "pending";
}

function proofBundleFromRecords(records: Record<string, unknown>[]) {
  for (const record of records) {
    if (isRecord(record.proofBundle)) return record.proofBundle;
    if (isRecord(record.proof_bundle)) return record.proof_bundle;
  }
  return null;
}

export function commerceEventFromUnknown(value: unknown, fallbackHost: string): CommerceEventRecord | null {
  if (isCommerceEventRecord(value)) return value;
  if (!isRecord(value)) return null;

  const data = isRecord(value.data) ? value.data : value;
  const records = [data, value];
  const rawType = stringFromRecords(records, ["type", "event", "eventType", "event_type"]);
  const eventType = normalizeCommerceEventType(rawType);
  if (!eventType) return null;
  const id =
    stringFromRecords(records, [
      "id",
      "eventId",
      "event_id",
      "paymentId",
      "payment_id",
      "transferId",
      "transfer_id",
      "checkoutSessionId",
      "checkout_session_id",
      "orderId",
      "order_id",
      "receiptId",
      "receipt_id"
    ]) ?? crypto.randomUUID();
  const createdAt = stringFromRecords(records, ["createdAt", "created_at", "timestamp", "occurredAt", "occurred_at"]);
  const tenantHost =
    stringFromRecords(records, ["tenantHost", "tenant_host", "storeHost", "store_host", "host", "domain"]) ??
    fallbackHost;

  return {
    schema: COMMERCE_EVENT_SCHEMA,
    id,
    type: eventType,
    createdAt: createdAt ?? new Date().toISOString(),
    tenantHost,
    merchantReceizId:
      stringFromRecords(records, [
        "merchantReceizId",
        "merchant_receiz_id",
        "merchantId",
        "merchant_id",
        "destinationReceizId",
        "destination_receiz_id",
        "toReceizId",
        "to_receiz_id"
      ]) ?? "",
    data: {
      orderId: stringFromRecords(records, ["orderId", "order_id"]),
      checkoutSessionId: stringFromRecords(records, ["checkoutSessionId", "checkout_session_id", "sessionId", "session_id"]),
      customerId: stringFromRecords(records, ["customerId", "customer_id", "buyerId", "buyer_id"]),
      customerEmail: stringFromRecords(records, ["customerEmail", "customer_email", "buyerEmail", "buyer_email"]),
      customerName: stringFromRecords(records, ["customerName", "customer_name", "buyerName", "buyer_name"]),
      totalLabel: moneyLabelFromRecords(records),
      itemCount: itemCountFromRecords(records),
      paymentRail: paymentRailFromWebhook(records, eventType, rawType),
      settlementStatus: settlementStatusFromWebhook(records, eventType),
      funding: isRecord(data.funding) ? (data.funding as Order["funding"]) : undefined,
      fulfillment: isRecord(data.fulfillment) ? (data.fulfillment as Order["fulfillment"]) : undefined,
      shipping: isRecord(data.shipping) ? (data.shipping as Order["shipping"]) : undefined,
      receiptId: stringFromRecords(records, ["receiptId", "receipt_id", "paymentId", "payment_id", "transferId", "transfer_id"]),
      proofBundle: proofBundleFromRecords(records)
    }
  };
}
