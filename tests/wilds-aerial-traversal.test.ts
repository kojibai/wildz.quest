import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  beginWildsAerialTraversal,
  completeWildsAerialLanding,
  createGroundedWildsAerialState,
  createWildsAerialRuntimeResult,
  projectWildsFlightEndurancePotential,
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
    const state = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "flight",
      capabilities: ["flight", "glide"]
    }).state;
    const result = createWildsAerialRuntimeResult();
    for (let index = 0; index < 1_000 && !state.landingRequired; index += 1) {
      writeWildsAerialRuntimeStep(state, {
        deltaSeconds: 0.1,
        groundElevation: 4,
        hasFlight: true,
        hasGlide: true,
        horizontalDistance: 0.2,
        positionX: point.x,
        positionZ: point.z,
        verticalOffset: state.mode === "flight" ? 4 : .35
      }, result);
    }

    assert.equal(state.stamina, 0);
    assert.equal(state.landingRequired, true);
    completeWildsAerialLanding(state, point.x, point.z, 4);

    const blocked = beginWildsAerialTraversal(state, { kind: "flight", capabilities: ["flight", "glide"] });
    assert.equal(blocked.reason, "flight-recharging");
    assert.equal(blocked.state.mode, "ground");

    for (let index = 0; index < 50; index += 1) {
      writeWildsAerialRuntimeStep(state, {
        deltaSeconds: 0.1, groundElevation: 4, hasFlight: true, hasGlide: true,
        horizontalDistance: 0, positionX: point.x, positionZ: point.z, verticalOffset: 0
      }, result);
    }
    assert.equal(state.stamina, 100);
    assert.equal(beginWildsAerialTraversal(state, { kind: "flight", capabilities: ["flight", "glide"] }).state.mode, "flight");
  });

  it("reports low energy before it forces a glide", () => {
    const flying = { ...beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "flight", capabilities: ["flight", "glide"]
    }).state, safeAnchor: { x: point.x, z: point.z, elevation: 4 }, stamina: 20 };
    const warning = createWildsAerialRuntimeResult();
    writeWildsAerialRuntimeStep(flying, {
      deltaSeconds: 0.1, groundElevation: 4, hasFlight: true, hasGlide: true,
      horizontalDistance: 0.2, positionX: point.x, positionZ: point.z, verticalOffset: 3
    }, warning);

    assert.equal(flying.mode, "flight");
    assert.equal(warning.reason, "flight-energy-low");
  });

  it("keeps Level-1 flight duration intact and rewards progression with longer finite airtime", () => {
    assert.equal(projectWildsFlightEndurancePotential(1), 0);
    assert.ok(projectWildsFlightEndurancePotential(8) > 0);
    assert.equal(projectWildsFlightEndurancePotential(20), 1);
    assert.equal(projectWildsFlightEndurancePotential(200), 1);
    const poweredTicks = (flightEndurancePotential: number) => {
      const state = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
        kind: "flight",
        capabilities: ["flight"]
      }).state;
      const result = createWildsAerialRuntimeResult();
      let ticks = 0;
      while (!state.landingRequired && ticks < 2_000) {
        writeWildsAerialRuntimeStep(state, {
          deltaSeconds: .1,
          flightEndurancePotential,
          groundElevation: 4,
          hasFlight: true,
          hasGlide: false,
          horizontalDistance: .2,
          positionX: point.x,
          positionZ: point.z,
          verticalOffset: 6
        }, result);
        ticks += 1;
      }
      return ticks;
    };

    const levelOneTicks = poweredTicks(0);
    const veteranTicks = poweredTicks(1);
    assert.ok(levelOneTicks > 400);
    assert.ok(veteranTicks > levelOneTicks * 1.9);
    assert.ok(veteranTicks < 2_000);
  });

  it("turns admitted gliding into bounded stamina and distance", () => {
    const launched = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "glide",
      capabilities: ["glide"],
      launchHeight: 5
    }).state;
    const result = createWildsAerialRuntimeResult();
    writeWildsAerialRuntimeStep(launched, {
      deltaSeconds: 0.1, groundElevation: 4, hasFlight: false, hasGlide: true,
      horizontalDistance: 0.7, positionX: point.x, positionZ: point.z, verticalOffset: 5
    }, result);

    assert.equal(launched.mode, "glide");
    assert.ok(launched.distance > 0);
    assert.ok(launched.stamina < 100);
  });

  it("falls back safely after capability loss and replays byte-identically", () => {
    const run = () => {
      const flying = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
        kind: "flight", capabilities: ["flight", "glide"]
      }).state;
      const result = createWildsAerialRuntimeResult();
      writeWildsAerialRuntimeStep(flying, {
        deltaSeconds: .05, groundElevation: 4, hasFlight: false, hasGlide: true,
        horizontalDistance: .3, positionX: point.x, positionZ: point.z, verticalOffset: 3
      }, result);
      return JSON.stringify({ flying, reason: result.reason, horizontalAllowed: result.horizontalAllowed });
    };

    assert.equal(run(), run());
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
    assert.equal(state.altitude, 4.35);
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
    assert.equal(state.mode, "flight");
    assert.equal(state.landingRequired, true);
    assert.equal(result.horizontalAllowed, false);
  });

  it("requires one deterministic landing consumer instead of snapping forced transitions at the current coordinate", () => {
    const state = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "flight", capabilities: ["flight"]
    }).state;
    const result = createWildsAerialRuntimeResult();
    const startingAltitude = state.altitude;
    writeWildsAerialRuntimeStep(state, {
      deltaSeconds: .1,
      groundElevation: 11,
      hasFlight: false,
      hasGlide: false,
      horizontalDistance: 1,
      positionX: 99,
      positionZ: 99,
      verticalOffset: 3,
      protectedAirspace: true
    }, result);

    assert.equal(state.mode, "flight");
    assert.equal(state.landingRequired, true);
    assert.equal(state.landingReason, "protected-airspace");
    assert.equal(state.altitude, startingAltitude);
    assert.deepEqual(state.safeAnchor, { x: 12, z: -8, elevation: 4 });
    assert.equal(result.horizontalAllowed, false);

    const completed = completeWildsAerialLanding(state, state.safeAnchor.x, state.safeAnchor.z, state.safeAnchor.elevation);
    assert.equal(completed, state);
    assert.equal(state.mode, "ground");
    assert.equal(state.landingRequired, false);
    assert.equal(state.altitude, 4);
  });

  it("preserves the exhaustion reason while a spent glide awaits safe landing", () => {
    const state = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "glide", capabilities: ["glide"], launchHeight: 4
    }).state;
    state.stamina = 0;
    const result = createWildsAerialRuntimeResult();
    writeWildsAerialRuntimeStep(state, {
      deltaSeconds: .1, groundElevation: 4, hasFlight: false, hasGlide: true,
      horizontalDistance: 0, positionX: point.x, positionZ: point.z, verticalOffset: 2
    }, result);

    assert.equal(state.landingRequired, true);
    assert.equal(state.landingReason, "flight-exhausted");
    assert.equal(result.reason, "flight-exhausted");
  });
});
