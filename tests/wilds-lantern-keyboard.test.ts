import assert from "node:assert/strict";
import { test } from "node:test";
import { worldInputForKeyboardEvent } from "../src/features/play/world-keyboard-routing";

test("L has no manual flashlight action", () => {
  assert.equal(worldInputForKeyboardEvent({ key: "l", defaultPrevented: false, target: null }), null);
  assert.equal(worldInputForKeyboardEvent({ key: "L", defaultPrevented: false, target: null }), null);
});
