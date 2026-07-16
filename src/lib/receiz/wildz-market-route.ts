import type { PortableCardAsset } from "../../features/play/portable-card";
import type { WildzListing, WildzTradePlan } from "../../features/market/wildz-market";
import type { WildzMarketAdmission } from "./wildz-market-repository";
import { wildzTradeExpiresAt } from "./wildz-market-state";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function assertExactMarketFields(value: unknown, fields: readonly string[]) {
  if (!isRecord(value)) throw new Error("market_request_invalid");
  const accepted = Object.keys(value).every((key) => fields.includes(key))
    && fields.every((key) => Object.hasOwn(value, key));
  if (!accepted) throw new Error("market_request_fields_invalid");
  return value;
}

function expectedHead(value: Record<string, unknown>) {
  if (!Number.isInteger(value.expectedRevision) || Number(value.expectedRevision) < 0) {
    throw new Error("market_revision_invalid");
  }
  if (value.expectedAppendAnchorId !== null
    && (typeof value.expectedAppendAnchorId !== "string"
      || !value.expectedAppendAnchorId.trim()
      || value.expectedAppendAnchorId.length > 512)) {
    throw new Error("market_append_anchor_invalid");
  }
  return {
    expectedRevision: Number(value.expectedRevision),
    expectedAppendAnchorId: value.expectedAppendAnchorId as string | null
  };
}

export function marketIdempotencyKey(headers: Headers) {
  const value = headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[a-zA-Z0-9._:-]{1,160}$/.test(value)) throw new Error("market_idempotency_required");
  return value;
}

export function parseWildzListingRequest(value: unknown) {
  const body = assertExactMarketFields(value, ["asset", "priceCents", "expectedRevision", "expectedAppendAnchorId"]);
  if (!isRecord(body.asset) || !/^wilds:[a-f0-9]{24}$/.test(String(body.asset.id ?? ""))) {
    throw new Error("market_asset_invalid");
  }
  if (!Number.isInteger(body.priceCents)) throw new Error("market_price_invalid");
  return {
    asset: body.asset as PortableCardAsset,
    priceCents: Number(body.priceCents),
    ...expectedHead(body)
  };
}

export function parseWildzListingCommand(value: unknown) {
  const body = assertExactMarketFields(value, ["listingId", "expectedRevision", "expectedAppendAnchorId"]);
  if (typeof body.listingId !== "string" || !body.listingId.trim() || body.listingId.length > 512) {
    throw new Error("market_listing_id_required");
  }
  return { listingId: body.listingId, ...expectedHead(body) };
}

export function parseWildzTradeCommand(value: unknown) {
  const body = assertExactMarketFields(value, ["tradeId", "expectedRevision", "expectedAppendAnchorId"]);
  if (typeof body.tradeId !== "string" || !body.tradeId.trim() || body.tradeId.length > 512) {
    throw new Error("market_trade_id_required");
  }
  return { tradeId: body.tradeId, ...expectedHead(body) };
}

export function publicWildzListing(listing: WildzListing) {
  return {
    schema: listing.schema,
    id: listing.id,
    assetId: listing.assetId,
    proofDigest: listing.proofDigest,
    sellerActorId: listing.sellerActorId,
    seller: listing.sellerActorId,
    priceCents: listing.priceCents,
    currency: listing.currency,
    status: listing.status,
    createdAt: listing.createdAt,
    revision: listing.revision
  };
}

export function publicWildzTrade(trade: WildzTradePlan) {
  return {
    schema: trade.schema,
    id: trade.id,
    listingId: trade.listingId,
    assetId: trade.assetId,
    sellerActorId: trade.sellerActorId,
    buyerActorId: trade.buyerActorId,
    priceCents: trade.priceCents,
    currency: trade.currency,
    createdAt: trade.createdAt,
    expiresAt: wildzTradeExpiresAt(trade)
  };
}

export function publicMarketAdmission(admission: WildzMarketAdmission, entity: "listing" | "trade", idempotencyKey: string) {
  if (admission.status === "market_capability_unavailable") {
    return { status: 503, body: { status: admission.status, ownershipTransferred: false } };
  }
  if (admission.status === "market_revision_conflict") {
    return { status: 409, body: { ...admission, ownershipTransferred: false } };
  }
  const record = entity === "listing"
    ? Object.values(admission.state.listings).find((listing) => listing.idempotencyKey === idempotencyKey)
    : Object.values(admission.state.trades).find((trade) => trade.idempotencyKey === idempotencyKey);
  if (!record) throw new Error(`market_${entity}_admission_missing`);
  return {
    status: admission.status === "admitted" ? 201 : 200,
    body: {
      status: admission.status,
      [entity]: entity === "listing"
        ? publicWildzListing(record as WildzListing)
        : publicWildzTrade(record as WildzTradePlan),
      head: { revision: admission.state.revision, appendAnchorId: admission.state.appendAnchorId },
      ownershipTransferred: false
    }
  };
}

export function marketRouteError(cause: unknown, fallback: string) {
  const error = cause instanceof Error ? cause.message : fallback;
  const status = error === "receiz_authority_required" ? 401
    : error === "receiz_profile_required" ? 403
      : /ownership_required|seller_required|buyer_required|self_trade/.test(error) ? 403
        : /not_found/.test(error) ? 404
          : error === "wildz_market_public_card_required" ? 409
            : 400;
  return { status, body: { error, ownershipTransferred: false } };
}
