import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("market is a compact overlay with no full-page navigation", () => {
  const source = readFileSync("src/features/market/WildzMarketSheet.tsx", "utf8");
  assert.match(source, /wildz-market-sheet/);
  assert.doesNotMatch(source, /router\.push|href=["']\/market/);
});
