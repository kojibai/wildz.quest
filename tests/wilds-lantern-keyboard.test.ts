import assert from "node:assert/strict";
import { test } from "node:test";
import { isWildsLanternKeyboardEvent } from "../src/features/play/world-keyboard-routing";

test("L toggles the lantern only from the unowned world surface", () => {
  assert.equal(isWildsLanternKeyboardEvent({ key: "l", defaultPrevented: false, target: null }), true);
  assert.equal(isWildsLanternKeyboardEvent({ key: "L", defaultPrevented: false, target: null }), true);
  assert.equal(isWildsLanternKeyboardEvent({ key: "l", defaultPrevented: true, target: null }), false);
  const button = { closest: () => button } as unknown as EventTarget;
  assert.equal(isWildsLanternKeyboardEvent({ key: "l", defaultPrevented: false, target: button }), false);
  assert.equal(isWildsLanternKeyboardEvent({ key: "k", defaultPrevented: false, target: null }), false);
});
