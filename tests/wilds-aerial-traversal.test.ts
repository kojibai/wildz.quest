import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  beginWildsAerialTraversal,
  completeWildsAerialLanding,
  createGroundedWildsAerialState,
  createWildsAerialRuntimeResult,
  planWildsAerialToggle,
  projectWildsFlightEndurancePotential,
  writeWildsAerialRuntimeStep
} from "../src/features/play/wilds-aerial-traversal";
import {
  createWildsVerticalTraversalState,
  WILDS_GLIDE_CRUISE_CLEARANCE,
  writeWildsVerticalTraversalStep
} from "../src/features/play/wilds-vertical-traversal";

const point = { x: 12, z: -8 };

describe("Wildz transient aerial traversal", () => {
  it("plans the tapped aerial skill, switches modes, and lands on an active-mode tap", () => {
    assert.deepEqual(planWildsAerialToggle("ground", "flight", ["flight", "glide"]), { kind: "takeoff", mode: "flight" });
    assert.deepEqual(planWildsAerialToggle("ground", "glide", ["flight", "glide"]), { kind: "takeoff", mode: "glide" });
    assert.deepEqual(planWildsAerialToggle("flight", "glide", ["flight", "glide"]), { kind: "switch", mode: "glide" });
    assert.deepEqual(planWildsAerialToggle("glide", "flight", ["flight", "glide"]), { kind: "switch", mode: "flight" });
    assert.deepEqual(planWildsAerialToggle("flight", "flight", ["flight"]), { kind: "land" });
    assert.deepEqual(planWildsAerialToggle("glide", "glide", ["glide"]), { kind: "land" });
    assert.deepEqual(planWildsAerialToggle("ground", "flight", ["glide"]), { kind: "needs-capability" });
    assert.deepEqual(planWildsAerialToggle("ground", "glide", ["flight"]), { kind: "needs-capability" });
  });

  it("requires exact capability and enough energy for both ground takeoffs", () => {
    const grounded = createGroundedWildsAerialState(point, 4);
    assert.equal(beginWildsAerialTraversal(grounded, { kind: "flight", capabilities: [] }).reason, "flight-required");
    assert.equal(beginWildsAerialTraversal(grounded, { kind: "glide", capabilities: [] }).reason, "glide-required");
    assert.equal(beginWildsAerialTraversal(grounded, { kind: "flight", capabilities: ["flight", "glide"] }).state.mode, "flight");
    const gliding = beginWildsAerialTraversal(grounded, { kind: "glide", capabilities: ["glide"] });
    assert.equal(gliding.state.mode, "glide");
    assert.equal(gliding.state.altitude, 4.4);
    assert.equal(beginWildsAerialTraversal({ ...grounded, stamina: 29 }, { kind: "glide", capabilities: ["glide"] }).reason, "glide-recharging");
  });

  it("lets a tired Flight switch to Glide aloft while Flight relaunch still needs energy", () => {
    const flying = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "flight", capabilities: ["flight", "glide"]
    }).state;
    flying.altitude = 12;
    flying.stamina = 10;
    const gliding = beginWildsAerialTraversal(flying, { kind: "glide", capabilities: ["flight", "glide"] });
    assert.equal(gliding.reason, null);
    assert.equal(gliding.state.mode, "glide");
    assert.equal(gliding.state.altitude, 12);
    assert.equal(beginWildsAerialTraversal(gliding.state, { kind: "flight", capabilities: ["flight", "glide"] }).reason, "flight-recharging");
    gliding.state.stamina = 20;
    const resumed = beginWildsAerialTraversal(gliding.state, { kind: "flight", capabilities: ["flight", "glide"] });
    assert.equal(resumed.state.mode, "flight");
    assert.equal(resumed.state.altitude, 12);
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
      capabilities: ["glide"]
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

  it("simulates a ground Glide tap through tree-clearing height, energy meter, and safe landing", () => {
    const plan = planWildsAerialToggle("ground", "glide", ["glide"]);
    assert.deepEqual(plan, { kind: "takeoff", mode: "glide" });
    if (plan.kind !== "takeoff") throw new Error("Glide takeoff was not planned");
    const aerial = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: plan.mode, capabilities: ["glide"]
    }).state;
    const vertical = createWildsVerticalTraversalState();
    writeWildsVerticalTraversalStep(vertical, {
      deltaSeconds: 0, initialOffset: .4, intent: 0, layer: "air",
      liftPotential: .6, assistedGlide: true, stamina: aerial.stamina, terrainElevation: 4
    });
    const result = createWildsAerialRuntimeResult();
    let highest = vertical.offset;
    let cruiseReached = false;
    let firstEnergyMeter = 100;
    let frames = 0;
    for (; frames < 250 && !aerial.landingRequired; frames += 1) {
      writeWildsAerialRuntimeStep(aerial, {
        deltaSeconds: .1, groundElevation: 4, hasFlight: false, hasGlide: true,
        horizontalDistance: .08, positionX: point.x + frames * .08, positionZ: point.z,
        verticalOffset: vertical.offset
      }, result);
      if (aerial.landingRequired) break;
      writeWildsVerticalTraversalStep(vertical, {
        deltaSeconds: .1, intent: frames >= 40 && frames < 55 ? 1 : 0, layer: "air",
        liftPotential: .6, assistedGlide: true, stamina: aerial.stamina, terrainElevation: 4
      });
      aerial.altitude = vertical.worldY;
      highest = Math.max(highest, vertical.offset);
      if (vertical.offset >= WILDS_GLIDE_CRUISE_CLEARANCE) cruiseReached = true;
      if (frames === 10) firstEnergyMeter = Math.round(aerial.stamina / 5) * 5;
    }
    assert.equal(cruiseReached, true);
    assert.ok(highest > 4.85 && highest <= 7.2, `Glide peak ${highest}m`);
    assert.ok(firstEnergyMeter < 100 && firstEnergyMeter > 0);
    assert.ok(frames > 80 && frames < 200, `Glide lasted ${frames / 10}s`);
    assert.equal(aerial.stamina, 0);
    assert.equal(aerial.landingReason, "flight-exhausted");
    assert.equal(result.horizontalAllowed, false);
    completeWildsAerialLanding(aerial, point.x + frames * .08, point.z, 4);
    assert.equal(aerial.mode, "ground");
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

  it("keeps an exhausted glide descending until the safe landing clearance", () => {
    const state = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "glide", capabilities: ["glide"]
    }).state;
    state.stamina = 0;
    const result = createWildsAerialRuntimeResult();
    writeWildsAerialRuntimeStep(state, {
      deltaSeconds: .1, groundElevation: 4, hasFlight: false, hasGlide: true,
      horizontalDistance: 0, positionX: point.x, positionZ: point.z, verticalOffset: 2
    }, result);

    assert.equal(state.landingRequired, false);
    assert.equal(result.reason, "flight-exhausted");
    writeWildsAerialRuntimeStep(state, {
      deltaSeconds: .1, groundElevation: 4, hasFlight: false, hasGlide: true,
      horizontalDistance: 0, positionX: point.x, positionZ: point.z, verticalOffset: .35
    }, result);
    assert.equal(state.landingRequired, true);
    assert.equal(state.landingReason, "flight-exhausted");
  });

  it("forces a safe landing when Glide enters protected airspace", () => {
    const state = beginWildsAerialTraversal(createGroundedWildsAerialState(point, 4), {
      kind: "glide", capabilities: ["glide"]
    }).state;
    const result = createWildsAerialRuntimeResult();
    writeWildsAerialRuntimeStep(state, {
      deltaSeconds: .1, groundElevation: 4, hasFlight: false, hasGlide: true,
      horizontalDistance: .1, positionX: point.x, positionZ: point.z,
      verticalOffset: .4, protectedAirspace: true
    }, result);
    assert.equal(state.landingRequired, true);
    assert.equal(state.landingReason, "protected-airspace");
    assert.equal(result.horizontalAllowed, false);
  });
});
