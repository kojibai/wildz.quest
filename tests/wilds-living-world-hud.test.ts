import assert from "node:assert/strict";
import { test } from "node:test";
import { wildsLivingWorldModeLabel } from "../src/features/play/wilds-living-world-status.js";

test("the acknowledged live world pill says Connected", () => {
  assert.equal(wildsLivingWorldModeLabel("receiz_live"), "Connected");
  assert.equal(wildsLivingWorldModeLabel("reconnecting"), "World reconnecting");
});

test("a connected proof session stays Connected while its deterministic world reconciles", () => {
  assert.equal(wildsLivingWorldModeLabel("local_practice", true), "Connected");
  assert.equal(wildsLivingWorldModeLabel("reconnecting", true), "Connected");
});
