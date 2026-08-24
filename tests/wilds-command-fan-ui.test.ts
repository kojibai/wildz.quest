import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isWildsCommandButtonSwipeUp, isWildsWorldToolsSwipeDown, isWildsWorldToolsSwipeUp } from "../src/features/play/WildsCommandDock";

test("world tools rest behind one trigger and expose controlled fan and panel state", async () => {
  const source = await readFile("src/features/play/WildsCommandDock.tsx", "utf8");

  assert.match(source, /className="wilds-world-tools-trigger"/);
  assert.match(source, /aria-label="Open world tools"/);
  assert.match(source, /className="wilds-world-tools-fan"/);
  assert.match(source, /toolsOpen: boolean/);
  assert.match(source, /panelKey: WildsCommandKey \| null/);
  assert.doesNotMatch(source, /useState<WildsCommandKey \| null>/);
});

test("center world-tools trigger opens its four-box fan with a deliberate upward swipe", () => {
  const origin = { x: 120, y: 180 };
  assert.equal(isWildsWorldToolsSwipeUp(origin, { x: 124, y: 126 }), true);
  assert.equal(isWildsWorldToolsSwipeUp(origin, { x: 120, y: 150 }), false);
  assert.equal(isWildsWorldToolsSwipeUp(origin, { x: 190, y: 128 }), false);
  assert.equal(isWildsWorldToolsSwipeUp(origin, { x: 120, y: 238 }), false);
});

test("center world-tools trigger recognizes a deliberate downward close gesture", () => {
  const origin = { x: 120, y: 180 };
  assert.equal(isWildsWorldToolsSwipeDown(origin, { x: 124, y: 234 }), true);
  assert.equal(isWildsWorldToolsSwipeDown(origin, { x: 120, y: 210 }), false);
  assert.equal(isWildsWorldToolsSwipeDown(origin, { x: 190, y: 232 }), false);
  assert.equal(isWildsWorldToolsSwipeDown(origin, { x: 120, y: 122 }), false);
});

test("each revealed world-tool button recognizes a short upward panel-opening swipe", () => {
  const origin = { x: 120, y: 180 };
  assert.equal(isWildsCommandButtonSwipeUp(origin, { x: 122, y: 154 }), true);
  assert.equal(isWildsCommandButtonSwipeUp(origin, { x: 120, y: 160 }), false);
  assert.equal(isWildsCommandButtonSwipeUp(origin, { x: 149, y: 154 }), false);
  assert.equal(isWildsCommandButtonSwipeUp(origin, { x: 120, y: 210 }), false);
});
