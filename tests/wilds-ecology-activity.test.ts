import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyWildsEcologyActivityInput, createWildsEcologyActivity } from "../src/features/play/wilds-ecology-activity";
import { generateWildsEcologySite, WILDS_ECOLOGY_FAMILIES } from "../src/features/play/wilds-ecology";

const pulse = "2026-07-15T12:00:00.000Z";

describe("Wilds ecology activity modules", () => {
  for (const [index, familyId] of WILDS_ECOLOGY_FAMILIES.entries()) {
    it(`${familyId} has one deterministic completable module`, () => {
      const site = generateWildsEcologySite({ familyId, pulse, ordinal: index + 1, existingSites: [] });
      assert.ok(site);
      const first = createWildsEcologyActivity(site);
      assert.deepEqual(createWildsEcologyActivity(site), first);
      assert.equal(first.objectives.length >= 3, true);
      assert.equal(first.phase, "ready");
      const submitted = first.sequence.reduce(
        (current, input) => applyWildsEcologyActivityInput(current, input),
        first
      );
      assert.equal(submitted.phase, "submitted");
      assert.equal(submitted.progress, submitted.objectives.length);
    });
  }

  it("rejects an out-of-order input without mutating progress", () => {
    const site = generateWildsEcologySite({ familyId: "echo-ruin", pulse, ordinal: 9, existingSites: [] });
    assert.ok(site);
    const activity = createWildsEcologyActivity(site);
    const next = applyWildsEcologyActivityInput(activity, activity.sequence.at(-1)!);
    assert.equal(next.progress, 0);
    assert.equal(next.misses, 1);
    assert.equal(next.phase, "active");
  });
});
