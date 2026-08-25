import assert from "node:assert/strict";
import test from "node:test";
import { projectWildsCapabilityPresentation } from "../src/features/play/wilds-capability-presentation";

test("every active family projects one matching actor pose and world effect", () => {
  const track = projectWildsCapabilityPresentation({ family: "track", targetId: "trace:1" });
  const lumber = projectWildsCapabilityPresentation({ family: "lumber", targetId: "tree:1" });
  const light = projectWildsCapabilityPresentation({ family: "light", targetId: null });

  assert.deepEqual(track, { family: "track", actorPose: "curious", actorCue: "track-read", worldEffect: "trace-ribbon", targetId: "trace:1", color: "#75f3d0" });
  assert.equal(lumber.actorPose, "work");
  assert.equal(lumber.worldEffect, "timber-chips");
  assert.equal(light.worldEffect, "light-field");
  assert.equal(Object.isFrozen(light), true);
});

