import assert from "node:assert/strict";
import { test } from "node:test";
import { wildsLivingWorldModeLabel } from "../src/features/play/wilds-living-world-status.js";

test("the acknowledged live world pill says Connected", () => {
  assert.equal(wildsLivingWorldModeLabel("receiz_live"), "Connected");
  assert.equal(wildsLivingWorldModeLabel("kai_live"), "Connected");
  assert.equal(wildsLivingWorldModeLabel("reconnecting"), "World reconnecting");
});

test("the shared live connection outranks a lagging world projection label", () => {
  assert.equal(wildsLivingWorldModeLabel("local_practice", true), "Connected");
  assert.equal(wildsLivingWorldModeLabel("receiz_recovery_pending", true), "Connected");
  assert.equal(wildsLivingWorldModeLabel("reconnecting", true), "Connected");
  assert.equal(wildsLivingWorldModeLabel("receiz_recovery_pending", false), "World reconnecting");
});
