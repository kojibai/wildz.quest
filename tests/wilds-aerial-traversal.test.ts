import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  advanceWildsAerialTraversal,
  beginWildsAerialTraversal,
  createGroundedWildsAerialState,
  createWildsAerialRuntimeResult,
  writeWildsAerialRuntimeStep
} from "../src/features/play/wilds-aerial-traversal";

const point = { x: 12, z: -8 };

describe("Wildz transient aerial traversal", () => {
  it("requires exact capability and launch height for takeoff and gliding", () => {
    const grounded = createGroundedWildsAerialState(point, 4);
    assert.equal(beginWildsAerialTraversal(grounded, { kind: "flight", capabilities: [] }).reason, "flight-required");
    assert.equal(beginWildsAerialTraversal(grounded, { kind: "glide", capabilities: ["glide"] }).reason, "launch-height-required");
    assert.equal(beginWildsAerialTraversal(grounded, { kind: "flight", capabilities: ["flight", "glide"] }).state.mode, "flight");
    assert.equal(beginWildsAerialTraversal(grounded, { kind: "glide", capabilities: ["glide"], launchHeight: 4 }).state.mode, "glide");
  });

  it("warns before flight exhaustion, falls back safely, and recharges on the ground", () => {
    let state = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "flight",
      capabilities: ["flight", "glide"]
    }).state;
    for (let index = 0; index < 1_000 && state.mode !== "ground"; index += 1) {
      state = advanceWildsAerialTraversal(state, {
        capabilities: ["flight", "glide"],
        deltaSeconds: 0.1,
        groundElevation: 4,
        horizontalDistance: 0.2,
        position: point,
        verticalIntent: 1
      }).state;
    }

    assert.ok(state.altitude <= 16);
    assert.equal(state.stamina, 0);
    assert.equal(state.mode, "ground");

    const blocked = beginWildsAerialTraversal(state, { kind: "flight", capabilities: ["flight", "glide"] });
    assert.equal(blocked.reason, "flight-recharging");
    assert.equal(blocked.state.mode, "ground");

    for (let index = 0; index < 50; index += 1) {
      state = advanceWildsAerialTraversal(state, {
        capabilities: ["flight", "glide"], deltaSeconds: 0.1, groundElevation: 4,
        horizontalDistance: 0, position: point, verticalIntent: 0
      }).state;
    }
    assert.equal(state.stamina, 100);
    assert.equal(beginWildsAerialTraversal(state, { kind: "flight", capabilities: ["flight", "glide"] }).state.mode, "flight");
  });

  it("reports low energy before it forces a glide", () => {
    const flying = { ...beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "flight", capabilities: ["flight", "glide"]
    }).state, stamina: 20 };
    const warning = advanceWildsAerialTraversal(flying, {
      capabilities: ["flight", "glide"], deltaSeconds: 0.1, groundElevation: 4,
      horizontalDistance: 0.2, position: point, verticalIntent: 0
    });

    assert.equal(warning.state.mode, "flight");
    assert.equal(warning.reason, "flight-energy-low");
  });

  it("turns height into bounded glide range and never passes through rising terrain", () => {
    const launched = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "glide",
      capabilities: ["glide"],
      launchHeight: 5
    }).state;
    const gliding = advanceWildsAerialTraversal(launched, {
      capabilities: ["glide"], deltaSeconds: 0.1, groundElevation: 4, horizontalDistance: 0.7, position: point, verticalIntent: 0
    });
    const collided = advanceWildsAerialTraversal(gliding.state, {
      capabilities: ["glide"], deltaSeconds: 0.1, groundElevation: 20, horizontalDistance: 0.7, position: { x: 13, z: -8 }, verticalIntent: 0
    });

    assert.equal(gliding.state.mode, "glide");
    assert.ok(gliding.state.distance > 0);
    assert.equal(collided.state.mode, "ground");
    assert.equal(collided.state.altitude, 20);
  });

  it("falls back safely after capability loss and replays byte-identically", () => {
    const flying = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "flight", capabilities: ["flight", "glide"]
    }).state;
    const input = { capabilities: ["glide"] as const, deltaSeconds: 0.05, groundElevation: 4, horizontalDistance: 0.3, position: point, verticalIntent: 0 };
    const first = advanceWildsAerialTraversal(flying, input);
    const replay = advanceWildsAerialTraversal(flying, input);

    assert.equal(first.state.mode, "glide");
    assert.deepEqual(first, replay);
  });

  it("contains no authority, network, persistence, timer, or React work", async () => {
    const source = await readFile("src/features/play/wilds-aerial-traversal.ts", "utf8");
    assert.doesNotMatch(source, /verify|fetch|localStorage|indexedDB|setTimeout|setInterval|react/i);
  });

  it("updates runtime stamina and horizontal admission without allocating replacement state", () => {
    const state = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "flight", capabilities: ["flight", "glide"]
    }).state;
    const result = createWildsAerialRuntimeResult();
    const returned = writeWildsAerialRuntimeStep(state, {
      deltaSeconds: .1,
      groundElevation: 4,
      hasFlight: true,
      hasGlide: true,
      horizontalDistance: .2,
      positionX: point.x,
      positionZ: point.z,
      verticalOffset: 3
    }, result);

    assert.equal(returned, result);
    assert.equal(result.state, state);
    assert.equal(state.altitude, 7);
    assert.equal(result.horizontalAllowed, true);

    state.stamina = 0;
    writeWildsAerialRuntimeStep(state, {
      deltaSeconds: .1,
      groundElevation: 4,
      hasFlight: false,
      hasGlide: false,
      horizontalDistance: 0,
      positionX: point.x,
      positionZ: point.z,
      verticalOffset: .35
    }, result);
    assert.equal(state.mode, "ground");
    assert.equal(result.horizontalAllowed, false);
  });
});
