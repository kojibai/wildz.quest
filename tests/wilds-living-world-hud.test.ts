import assert from "node:assert/strict";
import { test } from "node:test";
import { wildsLivingWorldModeLabel } from "../src/features/play/wilds-living-world-status.js";

test("the acknowledged live world pill says Connected", () => {
  assert.equal(wildsLivingWorldModeLabel("receiz_live"), "Connected");
  assert.equal(wildsLivingWorldModeLabel("kai_live"), "Connected");
  assert.equal(wildsLivingWorldModeLabel("reconnecting"), "World reconnecting");
});

test("the HUD never rewrites a pending world as Connected or practice", () => {
  assert.equal(wildsLivingWorldModeLabel("local_practice", true), "World reconnecting");
  assert.equal(wildsLivingWorldModeLabel("receiz_recovery_pending", true), "Live sync pending");
  assert.equal(wildsLivingWorldModeLabel("reconnecting", true), "World reconnecting");
});
