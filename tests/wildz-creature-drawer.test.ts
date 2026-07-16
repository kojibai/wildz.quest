import assert from "node:assert/strict";
import { test } from "node:test";
import {
  creatureBookWindow,
  creatureDrawerMetrics,
  creatureDrawerMode,
  drawerHapticPattern,
  settleCreatureDrawer
} from "../src/features/play/creature-drawer";

test("drawer projection keeps its slim closed handle visible with three deliberate snaps", () => {
  const metrics = creatureDrawerMetrics(844, 34);

  assert.ok(metrics.closed >= 30);
  assert.ok(metrics.preview - metrics.closed >= 72);
  assert.ok(metrics.expanded - metrics.preview >= 140);
  assert.equal(creatureDrawerMode(metrics.closed, metrics), "closed");
  assert.equal(creatureDrawerMode(metrics.preview, metrics), "preview");
  assert.equal(creatureDrawerMode(metrics.expanded, metrics), "expanded");
});

test("drawer settling uses flick direction and otherwise chooses the nearest snap", () => {
  const metrics = creatureDrawerMetrics(844);

  assert.equal(settleCreatureDrawer(metrics.preview + 10, -0.8, metrics), "expanded");
  assert.equal(settleCreatureDrawer(metrics.expanded - 10, 0.9, metrics), "preview");
  assert.equal(settleCreatureDrawer(metrics.closed + 4, 0.1, metrics), "closed");
  assert.equal(settleCreatureDrawer(metrics.expanded - 4, 0.1, metrics), "expanded");
  assert.deepEqual(drawerHapticPattern("closed", "preview"), [9]);
  assert.deepEqual(drawerHapticPattern("preview", "expanded"), [9, 28, 14]);
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
