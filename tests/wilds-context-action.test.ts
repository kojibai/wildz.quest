import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyWildsInput, initialPlayState, worldBounds } from "../src/features/play/game-state";
import { resolveWildsContextAction } from "../src/features/play/wilds-context-action";
import { cameraRelativeMovement, movementScale, normalizeWildsMovementMode } from "../src/features/play/wilds-movement";
import { WILDS_FLAGSHIP_LANDMARKS } from "../src/features/play/wilds-landmarks";

const emptyContext = {
  pendingReward: false,
  landmark: null,
  secretId: null,
  selectedPlayer: null,
  joinableActivity: null
};

describe("Wilds contextual world actions", () => {
  it("selects one Pulse action in the documented priority order", () => {
    assert.deepEqual(resolveWildsContextAction({ ...emptyContext, pendingReward: true }), {
      kind: "collect",
      label: "Collect reward"
    });
    assert.deepEqual(resolveWildsContextAction({
      ...emptyContext,
      landmark: WILDS_FLAGSHIP_LANDMARKS[0]
    }), {
      kind: "enter",
      label: "Enter Hearttree Sanctum",
      landmarkId: "hearttree-sanctum"
    });
    assert.deepEqual(resolveWildsContextAction({ ...emptyContext, secretId: "signal-1" }), {
      kind: "activate",
      label: "Awaken hidden signal",
      targetId: "signal-1"
    });
    assert.deepEqual(resolveWildsContextAction({
      ...emptyContext,
      selectedPlayer: { playerId: "player-2", handle: "Nova" }
    }), {
      kind: "greet",
      label: "Greet Nova",
      playerId: "player-2"
    });
    assert.deepEqual(resolveWildsContextAction({
      ...emptyContext,
      joinableActivity: { id: "run-1", name: "Resonance Run" }
    }), {
      kind: "join",
      label: "Join Resonance Run",
      activityId: "run-1"
    });
    assert.deepEqual(resolveWildsContextAction(emptyContext), {
      kind: "scan",
      label: "Pulse the world"
    });
  });

  it("keeps walking precise and makes running intentionally faster", () => {
    assert.equal(movementScale("walk"), 1);
    assert.equal(movementScale("run"), 1.25);
    assert.ok(worldBounds.analogStep * movementScale("run") / 0.045 <= 12);
    assert.equal(normalizeWildsMovementMode("run"), "run");
    assert.equal(normalizeWildsMovementMode("unexpected"), "walk");

    const walking = applyWildsInput(initialPlayState, { type: "move-vector", x: 1, z: 0, mode: "walk" });
    const running = applyWildsInput(initialPlayState, { type: "move-vector", x: 1, z: 0, mode: "run" });
    const walkDistance = walking.player.x - initialPlayState.player.x;
    const runDistance = running.player.x - initialPlayState.player.x;
    assert.ok(Math.abs(runDistance / walkDistance - 1.25) < 0.001);
  });

  it("keeps trackpad forward aligned with the orbiting camera", () => {
    assert.deepEqual(cameraRelativeMovement({ x: 0, z: -1 }, 0), { x: 0, z: -1 });
    const cameraOnRight = cameraRelativeMovement({ x: 0, z: -1 }, Math.PI / 2);
    assert.ok(Math.abs(cameraOnRight.x + 1) < 0.0001);
    assert.ok(Math.abs(cameraOnRight.z) < 0.0001);
    const cameraBehind = cameraRelativeMovement({ x: 0, z: -1 }, Math.PI);
    assert.ok(Math.abs(cameraBehind.x) < 0.0001);
    assert.ok(Math.abs(cameraBehind.z - 1) < 0.0001);
  });
});
