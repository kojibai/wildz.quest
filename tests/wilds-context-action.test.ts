import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  it("shows one dormant door control that only glows when an entrance is available", () => {
    const button = readFileSync("src/features/play/WildzContextButton.tsx", "utf8");
    const icons = readFileSync("src/components/icons.tsx", "utf8");
    const css = readFileSync("app/globals.css", "utf8");

    assert.match(icons, /door:\s*DoorClosed/);
    assert.match(button, /const canEnter = action\.kind === "enter"/);
    assert.match(button, /<Icons\.door/);
    assert.match(button, /disabled=\{!canEnter\}/);
    assert.match(button, /can-enter/);
    assert.match(css, /\.wildz-context-button\.can-enter\s*\{[^}]*box-shadow:[^}]*rgba\(255,\s*200,\s*90/s);
  });

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

  it("keeps D-pad up aligned with the camera's current screen-forward direction", () => {
    const screenUp = { x: 0, z: -1 };
    assert.deepEqual(cameraRelativeMovement(screenUp, 0), { x: 0, z: -1 });
    const quarterTurn = cameraRelativeMovement(screenUp, Math.PI / 2);
    assert.ok(Math.abs(quarterTurn.x + 1) < 1e-10);
    assert.ok(Math.abs(quarterTurn.z) < 1e-10);
  });

});
