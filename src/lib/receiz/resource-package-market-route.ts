import {
  validPackageMarketPrice,
  publicResourcePackageListing
} from "../../features/market/resource-package-market";
import { assertExactMarketFields, marketRouteError } from "./wildz-market-route";
import { WILDS_RESOURCE_CUSTODY_UNAVAILABLE } from "./wilds-resource-custody-capability";
import { resourcePackageMarketHead, type ResourcePackageMarketAdmission } from "./resource-package-market-repository";

export function resourcePackageMarketRouteError(cause: unknown, fallback: string) {
  if (cause instanceof Error && cause.message === WILDS_RESOURCE_CUSTODY_UNAVAILABLE) {
    return { status: 503, body: { error: cause.message, status: "resource_custody_unavailable", ownershipTransferred: false } };
  }
  return marketRouteError(cause, fallback);
}

export function parseResourcePackageMarketHead(value: Record<string, unknown>) {
  if (!Number.isSafeInteger(value.expectedRevision) || Number(value.expectedRevision) < 0
    || (value.expectedAppendAnchorId !== null && (typeof value.expectedAppendAnchorId !== "string" || !value.expectedAppendAnchorId || value.expectedAppendAnchorId.length > 512))) throw new Error("package_market_head_invalid");
  return { expectedRevision: Number(value.expectedRevision), expectedAppendAnchorId: value.expectedAppendAnchorId as string | null };
}
export function parseResourcePackageMarketListing(value: unknown) {
  const body = assertExactMarketFields(value, ["packageId", "priceCents", "expectedRevision", "expectedAppendAnchorId"]);
  if (typeof body.packageId !== "string" || !/^wildz:package:[a-f0-9]{64}$/.test(body.packageId) || !validPackageMarketPrice(body.priceCents)) throw new Error("package_market_listing_invalid");
  return { packageId: body.packageId, priceCents: body.priceCents, ...parseResourcePackageMarketHead(body) };
}
export function parseResourcePackageMarketCommand(value: unknown, field: "listingId" | "tradeId") {
  const body = assertExactMarketFields(value, [field, "expectedRevision", "expectedAppendAnchorId"]);
  const id = body[field];
  if (typeof id !== "string" || !new RegExp(`^pack-${field === "listingId" ? "listing" : "trade"}:[a-f0-9]{32}$`).test(id)) throw new Error("package_market_id_invalid");
  return { id, ...parseResourcePackageMarketHead(body) };
}
export function publicResourcePackageMarketAdmission(admission: ResourcePackageMarketAdmission, idempotencyKey: string, kind: "listing" | "trade") {
  if (admission.status === "market_capability_unavailable") return { status: 503, body: { status: admission.status, ownershipTransferred: false } };
  if (admission.status === "market_revision_conflict") return { status: 409, body: { ...admission, ownershipTransferred: false } };
  const entity = kind === "listing" ? Object.values(admission.state.listings).find((item) => item.idempotencyKey === idempotencyKey) : Object.values(admission.state.trades).find((item) => item.idempotencyKey === idempotencyKey);
  if (!entity) throw new Error("package_market_admission_missing");
  return { status: admission.status === "admitted" ? 201 : 200, body: { status: admission.status, [kind]: kind === "listing" ? publicResourcePackageListing(entity as Parameters<typeof publicResourcePackageListing>[0]) : { id: entity.id }, head: resourcePackageMarketHead(admission.state), ownershipTransferred: false } };
}
