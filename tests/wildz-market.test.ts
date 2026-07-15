import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildzListing, planWildzTrade, settleWildzPurchase } from "../src/features/market/wildz-market";

test("listing requires actor ownership, revision, and idempotency", () => {
  assert.throws(() => createWildzListing({ actor: "@buyer", owner: "@seller", assetId: "card:1", proofDigest: "sha256:a", priceCents: 500, currency: "USD", expectedRevision: 0, idempotencyKey: "list:1" }), /ownership/);
  assert.throws(() => createWildzListing({ actor: "@seller", owner: "@seller", assetId: "card:1", proofDigest: "sha256:a", priceCents: 500, currency: "USD", expectedRevision: -1, idempotencyKey: "list:1" }), /revision/);
});

test("a planned trade never transfers ownership before admitted settlement", () => {
  const listing = createWildzListing({ actor: "@seller", owner: "@seller", assetId: "card:1", proofDigest: "sha256:a", priceCents: 500, currency: "USD", expectedRevision: 0, idempotencyKey: "list:1" });
  const plan = planWildzTrade({ listing, buyer: "@buyer", expectedRevision: listing.revision, idempotencyKey: "trade:1" });
  assert.equal(plan.ownershipTransferred, false);
  assert.equal(settleWildzPurchase(plan, { admitted: false, settlementId: null }).ownershipTransferred, false);
  assert.equal(settleWildzPurchase(plan, { admitted: true, settlementId: "settled:1" }).ownershipTransferred, true);
  assert.throws(() => planWildzTrade({ listing, buyer: "@buyer", expectedRevision: 0, idempotencyKey: "stale" }), /stale/);
});
