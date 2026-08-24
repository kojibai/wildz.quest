import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("market is a compact overlay with no full-page navigation", () => {
  const source = readFileSync("src/features/market/WildzMarketSheet.tsx", "utf8");
  assert.match(source, /wildz-market-sheet/);
  assert.doesNotMatch(source, /router\.push|href=["']\/market/);
});

test("market purchase admits a trade before proof-backed checkout and reuses settlement recovery", () => {
  const source = readFileSync("src/features/market/WildzMarketSheet.tsx", "utf8");
  assert.match(source, /fetch\("\/api\/market\/trades"/);
  assert.match(source, /JSON\.stringify\(\{ listingId: selected\.id, expectedRevision: head\.revision, expectedAppendAnchorId: head\.appendAnchorId \}\)/);
  assert.match(source, /fetch\("\/api\/market\/checkout"/);
  assert.match(source, /fetch\("\/api\/market\/settlement"/);
  assert.match(source, /JSON\.stringify\(\{ tradeId, expectedRevision: checkoutHead\.revision, expectedAppendAnchorId: checkoutHead\.appendAnchorId \}\)/);
  assert.match(source, /result\?\.status === "recovery_pending" \|\| result\?\.status === "payment_failed"/);
  assert.match(source, /marketHead\(result\?\.head\)/);
  assert.match(source, /setPending\(\{ tradeId, checkoutHead: recoveryHead \}\)/);
  assert.match(source, /result\?\.status === "reservation_expired"/);
  assert.match(source, /settledMarketProjection/);
  assert.match(source, /verifyAnyWildsCard\(asset\)\.ok/);
  assert.match(source, /await onSettlement\?\.\(projection\.asset\)/);
  assert.doesNotMatch(source, /wildz-listing-composer|body:\s*JSON\.stringify\(\{[^}]*\b(?:actor|buyer|seller|listing|priceCents|amount|recipientUserId)\b/s);
});
