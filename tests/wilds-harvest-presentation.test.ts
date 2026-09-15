import { test } from "node:test";
import assert from "node:assert/strict";
import { wildsHarvestPresentationRemaining } from "../src/features/play/wilds-work-presentation";

test("fast completion still allows arrival and a short harvest dwell", () => {
  assert.equal(wildsHarvestPresentationRemaining(100, 0, null), 100);
  assert.equal(wildsHarvestPresentationRemaining(1200, 0, 1200), 450);
  assert.equal(wildsHarvestPresentationRemaining(1500, 0, 1200), 150);
  assert.equal(wildsHarvestPresentationRemaining(1650, 0, 1200), 0);
});
test("slow settlement adds no delay after the harvest dwell and blocked approaches expire", () => {
  assert.equal(wildsHarvestPresentationRemaining(3000, 0, 1200), 0);
  assert.equal(wildsHarvestPresentationRemaining(8000, 0, null), 0);
});
