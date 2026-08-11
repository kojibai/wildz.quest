import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampInventoryPage,
  inventoryPageForAsset,
  inventoryPageSize,
  rebaseInventoryPage,
  shouldCaptureInventorySwipe
} from "../src/features/play/inventory-pagination";

test("Commerce Vault pages use four cards on compact screens and eight on wider screens", () => {
  assert.equal(inventoryPageSize(true), 4);
  assert.equal(inventoryPageSize(false), 8);
});

test("opening a character from quick actions lands on that exact Vault page", () => {
  const ids = Array.from({ length: 17 }, (_, index) => `card-${index + 1}`);
  assert.equal(inventoryPageForAsset(ids, "card-15", 4), 3);
  assert.equal(inventoryPageForAsset(ids, "card-15", 8), 1);
  assert.equal(inventoryPageForAsset(ids, "missing", 4), 0);
});

test("Commerce Vault page clamping keeps empty and 100-card collections in bounds", () => {
  assert.equal(clampInventoryPage(-1, 0, 4), 0);
  assert.equal(clampInventoryPage(99, 0, 8), 0);
  assert.equal(clampInventoryPage(-1, 100, 4), 0);
  assert.equal(clampInventoryPage(99, 100, 4), 24);
  assert.equal(clampInventoryPage(99, 100, 8), 12);
});

test("a 100-card fixture exposes only its active Commerce-sized page", () => {
  const cards = Array.from({ length: 100 }, (_, index) => `card-${index + 1}`);

  const compactPage = clampInventoryPage(99, cards.length, inventoryPageSize(true));
  const widePage = clampInventoryPage(99, cards.length, inventoryPageSize(false));
  const compactVisible = cards.slice(
    compactPage * inventoryPageSize(true),
    compactPage * inventoryPageSize(true) + inventoryPageSize(true)
  );
  const wideVisible = cards.slice(
    widePage * inventoryPageSize(false),
    widePage * inventoryPageSize(false) + inventoryPageSize(false)
  );

  assert.deepEqual(compactVisible, ["card-97", "card-98", "card-99", "card-100"]);
  assert.deepEqual(wideVisible, ["card-97", "card-98", "card-99", "card-100"]);
  assert.ok(compactVisible.length <= 4);
  assert.ok(wideVisible.length <= 8);
});

test("page-size rebasing keeps the former first visible card anchored in the next page", () => {
  assert.equal(rebaseInventoryPage(3, 8, 4, 100), 6);
  assert.equal(rebaseInventoryPage(7, 4, 8, 100), 3);

  const formerFirstIndex = 7 * 4;
  const rebasedWidePage = rebaseInventoryPage(7, 4, 8, 100);
  assert.ok(formerFirstIndex >= rebasedWidePage * 8);
  assert.ok(formerFirstIndex < rebasedWidePage * 8 + 8);
});

test("Vault card taps stay clickable until a deliberate horizontal page swipe", () => {
  const start = { x: 100, y: 100 };

  assert.equal(shouldCaptureInventorySwipe(start, { x: 100, y: 100 }), false);
  assert.equal(shouldCaptureInventorySwipe(start, { x: 112, y: 101 }), false);
  assert.equal(shouldCaptureInventorySwipe(start, { x: 149, y: 151 }), false);
  assert.equal(shouldCaptureInventorySwipe(start, { x: 148, y: 102 }), true);
  assert.equal(shouldCaptureInventorySwipe(start, { x: 52, y: 98 }), true);
});
