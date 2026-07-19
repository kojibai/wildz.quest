import assert from "node:assert/strict";
import { test } from "node:test";
import { wildsLivingWorldModeLabel } from "../src/features/play/wilds-living-world-status.js";

test("the acknowledged live world pill says Connected", () => {
  assert.equal(wildsLivingWorldModeLabel("receiz_live"), "Connected");
  assert.equal(wildsLivingWorldModeLabel("kai_live"), "Connected");
  assert.equal(wildsLivingWorldModeLabel("reconnecting"), "World reconnecting");
});

test("the HUD never rewrites a non-live world as Connected", () => {
  assert.equal(wildsLivingWorldModeLabel("local_practice", true), "Local practice");
  assert.equal(wildsLivingWorldModeLabel("reconnecting", true), "World reconnecting");
});
