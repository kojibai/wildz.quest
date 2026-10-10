import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("market is a compact overlay with no full-page navigation", () => {
  const source = readFileSync("src/features/market/WildzMarketSheet.tsx", "utf8");
  assert.match(source, /wildz-market-sheet/);
  assert.doesNotMatch(source, /router\.push|href=["']\/market/);
});

test("market presentation delegates exact source, approval and recovery to the staged service", () => {
  const source = readFileSync("src/features/market/WildzMarketSheet.tsx", "utf8");
  assert.match(source, /service\.previewPurchase\(listingId\)/);
  assert.match(source, /'approvePurchase'\|'resume'\|'accept'/);
  assert.match(source, /service\.list\(exact\.request\)/);
  assert.match(source, /service\.cancel\(item\.listingId\)/);
  assert.match(source, /Payment confirmed · delivery pending/);
  assert.match(source, /Asset received · refresh pending/);
  assert.match(source, /formatWildsPhiExact\(purchase\.amountPhiMicro\)/);
  assert.match(source, /formatWildsUsdCents\(purchase\.priceUsdCents\)/);
  assert.doesNotMatch(source, /fetch\(|settledMarketProjection|onSettlement|claimBearerAsset|\.toFixed\(/);
});
