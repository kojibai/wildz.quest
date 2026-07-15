import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("social deck preserves the game command surfaces and embedded social market", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  for (const token of ["onOpenMap", "onOpenProfile", "onOpenMarket", "nearbyCards"]) {
    assert.match(source, new RegExp(token));
  }
  assert.match(source, /sealcub-portrait\.svg/);
  assert.doesNotMatch(source, /router\.push|href=["']\/market/);
});
