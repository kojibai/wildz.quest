import { createWildzListing, planWildzTrade, settleWildzPurchase, type WildzListing } from "@/features/market/wildz-market";

const listings = new Map<string, WildzListing>();
const idempotency = new Map<string, unknown>();

export function discoverWildzListings() { return [...listings.values()].filter((listing) => listing.status === "active").slice(0, 60); }
export function admitWildzListing(input: Parameters<typeof createWildzListing>[0]) { const prior = idempotency.get(input.idempotencyKey) as WildzListing | undefined; if (prior) return prior; const listing = createWildzListing(input); listings.set(listing.id, listing); idempotency.set(input.idempotencyKey, listing); return listing; }
export function admitWildzTrade(input: Parameters<typeof planWildzTrade>[0]) { const prior = idempotency.get(input.idempotencyKey); if (prior) return prior; const plan = planWildzTrade(input); idempotency.set(input.idempotencyKey, plan); return plan; }
export function settleUnavailable(plan: ReturnType<typeof planWildzTrade>) { return settleWildzPurchase(plan, { admitted: false, settlementId: null, capabilityUnavailable: true }); }
