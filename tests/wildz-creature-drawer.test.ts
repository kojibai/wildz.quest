import assert from "node:assert/strict";
import { test } from "node:test";
import {
  creatureBookWindow,
  creatureDrawerMetrics,
  creatureDrawerMode,
  settleCreatureDrawer
} from "../src/features/play/creature-drawer";

test("drawer projection has zero-height closed state and ordered responsive snaps", () => {
  const metrics = creatureDrawerMetrics(844);

  assert.equal(metrics.closed, 0);
  assert.ok(metrics.rail > metrics.closed);
  assert.ok(metrics.grid > metrics.rail);
  assert.ok(metrics.book > metrics.grid);
  assert.equal(creatureDrawerMode(0, metrics), "closed");
  assert.equal(creatureDrawerMode(metrics.rail, metrics), "rail");
  assert.equal(creatureDrawerMode(metrics.grid, metrics), "grid");
  assert.equal(creatureDrawerMode(metrics.book, metrics), "book");
});

test("drawer settling uses flick direction and otherwise chooses the nearest snap", () => {
  const metrics = creatureDrawerMetrics(844);

  assert.equal(settleCreatureDrawer(metrics.rail + 10, -0.8, metrics), "grid");
  assert.equal(settleCreatureDrawer(metrics.grid - 10, 0.9, metrics), "rail");
  assert.equal(settleCreatureDrawer(4, 0.1, metrics), "closed");
  assert.equal(settleCreatureDrawer(metrics.book - 4, 0.1, metrics), "book");
});

test("book windows expose eight-card spreads and preload adjacent spreads without duplicates", () => {
  const cards = Array.from({ length: 19 }, (_, index) => `card-${index + 1}`);
  const first = creatureBookWindow(cards, 0, 1);
  const last = creatureBookWindow(cards, 2, 1);

  assert.equal(first.pageSize, 8);
  assert.equal(first.pageCount, 3);
  assert.deepEqual(first.visible, cards.slice(0, 16));
  assert.equal(first.windowStartPage, 0);
  assert.deepEqual(last.visible, cards.slice(8, 19));
  assert.equal(last.windowStartPage, 1);
  assert.equal(new Set(last.visible).size, last.visible.length);
});

test("book windows remain valid for empty and out-of-range collections", () => {
  assert.deepEqual(creatureBookWindow([], 8, 1).visible, []);
  const cards = ["one", "two"];
  const window = creatureBookWindow(cards, 99, 1);
  assert.equal(window.page, 0);
  assert.deepEqual(window.visible, cards);
});
