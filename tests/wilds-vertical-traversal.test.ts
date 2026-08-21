import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWildsVerticalTraversalState,
  writeWildsVerticalTraversalStep
} from "../src/features/play/wilds-vertical-traversal";

describe("Wildz bounded vertical traversal", () => {
  it("dives and rises only inside the exact water surface and seabed band", () => {
    const state = createWildsVerticalTraversalState();
    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: 0,
      intent: 0,
      layer: "water",
      terrainElevation: -4,
      waterSurfaceY: 0,
      pressurePotential: 1,
      stamina: 100
    });
    const initialOffset = state.offset;
    for (let index = 0; index < 400; index += 1) {
      writeWildsVerticalTraversalStep(state, {
        deltaSeconds: .1,
        intent: -1,
        layer: "water",
        terrainElevation: -4,
        waterSurfaceY: 0,
        pressurePotential: 1,
        stamina: 100
      });
    }
    assert.ok(state.offset < initialOffset);
    assert.equal(state.offset, state.safeMin);
    assert.ok(state.offset > 0);

    for (let index = 0; index < 400; index += 1) {
      writeWildsVerticalTraversalStep(state, {
        deltaSeconds: .1,
        intent: 1,
        layer: "water",
        terrainElevation: -4,
        waterSurfaceY: 0,
        pressurePotential: 1,
        stamina: 100
      });
    }
    assert.equal(state.offset, state.safeMax);
    assert.ok(-4 + state.offset < 0);
  });

  it("limits dive depth by pressure potential and recovers toward the surface without stamina", () => {
    const state = createWildsVerticalTraversalState();
    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: 0,
      intent: 0,
      layer: "water",
      terrainElevation: -9,
      waterSurfaceY: 0,
      pressurePotential: .2,
      stamina: 100
    });
    for (let index = 0; index < 400; index += 1) writeWildsVerticalTraversalStep(state, {
      deltaSeconds: .1,
      intent: -1,
      layer: "water",
      terrainElevation: -9,
      waterSurfaceY: 0,
      pressurePotential: .2,
      stamina: 100
    });
    assert.equal(state.offset, state.safeMin);
    const deepest = state.offset;
    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: 1,
      intent: -1,
      layer: "water",
      terrainElevation: -9,
      waterSurfaceY: 0,
      pressurePotential: .2,
      stamina: 0
    });
    assert.ok(state.offset > deepest);
  });

  it("bounds powered ascent by lift, stamina, ceilings, and a collision-safe landing floor", () => {
    const state = createWildsVerticalTraversalState();
    writeWildsVerticalTraversalStep(state, {
      ceilingY: 8,
      deltaSeconds: 0,
      initialOffset: 4,
      intent: 0,
      layer: "air",
      liftPotential: .45,
      powered: true,
      stamina: 100,
      terrainElevation: 1
    });
    for (let index = 0; index < 400; index += 1) writeWildsVerticalTraversalStep(state, {
      ceilingY: 8,
      deltaSeconds: .1,
      intent: 1,
      layer: "air",
      liftPotential: .45,
      obstacleTopY: 3,
      powered: true,
      stamina: 100,
      terrainElevation: 1
    });
    assert.equal(state.safeMin, 2.35);
    assert.equal(state.offset, state.safeMax);
    assert.ok(1 + state.offset < 8);

    const atCeiling = state.offset;
    writeWildsVerticalTraversalStep(state, {
      ceilingY: 8,
      deltaSeconds: .1,
      intent: 1,
      layer: "air",
      liftPotential: .45,
      obstacleTopY: 3,
      powered: true,
      stamina: 0,
      terrainElevation: 1
    });
    assert.ok(state.offset < atCeiling);
    for (let index = 0; index < 400; index += 1) writeWildsVerticalTraversalStep(state, {
      ceilingY: 8,
      deltaSeconds: .1,
      intent: -1,
      layer: "air",
      liftPotential: .45,
      obstacleTopY: 3,
      powered: true,
      stamina: 100,
      terrainElevation: 1
    });
    assert.equal(state.offset, state.safeMin);
  });

  it("does not teleport a low takeoff above an adjacent canopy", () => {
    const state = createWildsVerticalTraversalState();
    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: 0,
      initialOffset: .35,
      intent: 0,
      layer: "air",
      liftPotential: 1,
      obstacleTopY: 4,
      powered: true,
      stamina: 100,
      terrainElevation: 0
    });

    assert.equal(state.offset, .35);
    assert.equal(state.safeMin, .35);
  });

  it("blocks powered ascent through a canopy until horizontal clearance is real", () => {
    const state = createWildsVerticalTraversalState();
    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: 0,
      initialOffset: .35,
      intent: 0,
      layer: "air",
      liftPotential: 1,
      obstacleTopY: 4,
      powered: true,
      stamina: 100,
      terrainElevation: 0
    });
    for (let index = 0; index < 20; index += 1) writeWildsVerticalTraversalStep(state, {
      deltaSeconds: .1,
      intent: 1,
      layer: "air",
      liftPotential: 1,
      obstacleTopY: 4,
      powered: true,
      stamina: 100,
      terrainElevation: 0
    });
    assert.equal(state.offset, .35);

    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: .1,
      intent: 1,
      layer: "air",
      liftPotential: 1,
      powered: true,
      stamina: 100,
      terrainElevation: 0
    });
    assert.ok(state.offset > .35);
  });

  it("allows an already-clear legitimate air start to keep ascending above canopy", () => {
    const state = createWildsVerticalTraversalState();
    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: .1,
      initialOffset: 5,
      intent: 1,
      layer: "air",
      liftPotential: 1,
      obstacleTopY: 4,
      powered: true,
      stamina: 100,
      terrainElevation: 10
    });
    assert.ok(state.offset > 5);
  });

  it("does not let an unpowered glide climb", () => {
    const state = createWildsVerticalTraversalState();
    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: 0,
      initialOffset: 4,
      intent: 0,
      layer: "air",
      liftPotential: 1,
      powered: false,
      stamina: 100,
      terrainElevation: 0
    });
    const before = state.offset;
    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: .1,
      intent: 1,
      layer: "air",
      liftPotential: 1,
      powered: false,
      stamina: 100,
      terrainElevation: 0
    });
    assert.ok(state.offset < before);
  });

  it("preserves absolute world height while horizontal travel changes terrain elevation", () => {
    const state = createWildsVerticalTraversalState();
    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: 0,
      initialOffset: 5,
      intent: 0,
      layer: "air",
      liftPotential: 1,
      powered: true,
      stamina: 100,
      terrainElevation: 2
    });
    assert.equal(state.worldY, 7);

    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: 0,
      intent: 0,
      layer: "air",
      liftPotential: 1,
      powered: true,
      stamina: 100,
      terrainElevation: 4
    });
    assert.equal(state.worldY, 7);
    assert.equal(state.offset, 3);

    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: 0,
      intent: 0,
      layer: "air",
      liftPotential: 1,
      powered: true,
      stamina: 100,
      terrainElevation: -1
    });
    assert.equal(state.worldY, 7);
    assert.equal(state.offset, 8);
  });

  it("keeps canonical world height truthful when traversal returns to ground", () => {
    const state = createWildsVerticalTraversalState();
    writeWildsVerticalTraversalStep(state, {
      deltaSeconds: 0,
      intent: 0,
      layer: "ground",
      stamina: 100,
      terrainElevation: 6.25
    });

    assert.equal(state.offset, 0);
    assert.equal(state.worldY, 6.25);
  });

  it("mutates and returns the same scalar state object without persistence or authority work", async () => {
    const state = createWildsVerticalTraversalState();
    const returned = writeWildsVerticalTraversalStep(state, {
      deltaSeconds: .1,
      intent: 1,
      layer: "air",
      liftPotential: 1,
      powered: true,
      stamina: 100,
      terrainElevation: 0
    });
    assert.equal(returned, state);
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("src/features/play/wilds-vertical-traversal.ts", "utf8");
    assert.doesNotMatch(source, /fetch|verify|localStorage|indexedDB|setTimeout|setInterval|requestAnimationFrame|react/i);
  });
});
