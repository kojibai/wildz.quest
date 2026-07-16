import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampInventoryPage,
  inventoryPageSize,
  rebaseInventoryPage
} from "../src/features/play/inventory-pagination";

test("Commerce Vault pages use four cards on compact screens and eight on wider screens", () => {
  assert.equal(inventoryPageSize(true), 4);
  assert.equal(inventoryPageSize(false), 8);
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
