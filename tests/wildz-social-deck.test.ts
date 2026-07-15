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

test("bottom dock follows the six-slot reference order with distinct functions", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const markers = [
    'aria-label="Open card vault"',
    'aria-label="Open world map"',
    'aria-label="Open player profile"',
    'aria-label="Open social market"',
    'aria-label="Open active deck"',
    'aria-label="Open rewards"'
  ];
  const offsets = markers.map((marker) => source.indexOf(marker));
  assert.ok(offsets.every((offset) => offset >= 0));
  assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b));
  for (const token of ["Icons.archive", "Icons.map", "Icons.users", "Icons.waveform", "sealcub-portrait.svg", "Icons.products"]) {
    assert.match(source, new RegExp(token.replace(".", "\\.")));
  }
});
