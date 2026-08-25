import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { friendlyWildsGameplayError, isWildsTemporalContinuityError } from "../src/features/play/wilds-temporal-errors.js";

describe("Wilds temporal continuity errors", () => {
  it("turns stale chapter codes into one actionable recovery message", () => {
    for (const code of ["wilds_story_chapter_mismatch", "wilds_story_chapter_inactive"]) {
      assert.equal(isWildsTemporalContinuityError(new Error(code)), true);
      assert.equal(
        friendlyWildsGameplayError(new Error(code)),
        "The Kai chapter changed. Your story has refreshed—try that action again."
      );
    }
  });

  it("never exposes an internal Wilds error code to a player", () => {
    assert.equal(
      friendlyWildsGameplayError(new Error("wilds_story_tournament_entry_failed"), "Tournament entry could not complete. Try again."),
      "Tournament entry could not complete. Try again."
    );
  });

  it("preserves already-readable messages", () => {
    assert.equal(friendlyWildsGameplayError(new Error("Connection paused. Try again.")), "Connection paused. Try again.");
  });

  it("explains steward validation without implying Receiz denied authority", () => {
    assert.equal(friendlyWildsGameplayError(new Error("wilds_world_resource_mandate_invalid")), "Choose a rested companion whose card shows the work this source needs.");
    assert.equal(friendlyWildsGameplayError(new Error("wilds_world_resource_source_stale")), "This source changed in the shared world. Its current state is refreshing—touch it again.");
  });
});
