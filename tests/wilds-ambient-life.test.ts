import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  projectWildsAmbientLifeLod,
  projectWildsAmbientLifeNeighborhood,
  wildsAmbientLifeDiagnostics
} from "../src/features/play/wilds-ambient-life";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { WILDS_WATERLINE_ELEVATION } from "../src/features/play/wilds-terrain-rendering";

describe("quality-bounded ambient Wilds life", () => {
  it("reuses one immutable projection throughout movement inside an admitted region", () => {
    const first = projectWildsAmbientLifeNeighborhood({ x: -95.5, z: -239.5 }, "high");
    const afterFirst = wildsAmbientLifeDiagnostics();
    const moved = projectWildsAmbientLifeNeighborhood({ x: -73, z: -217 }, "high");
    const afterMovement = wildsAmbientLifeDiagnostics();

    assert.equal(moved, first);
    assert.deepEqual(afterMovement, afterFirst);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(first.every((life) => Object.isFrozen(life) && Object.isFrozen(life.path)), true);
  });

  it("keeps every generated aquatic and aerial path inside its physical medium", () => {
    const projections = [] as ReturnType<typeof projectWildsAmbientLifeNeighborhood>[number][];
    for (let regionZ = -14; regionZ <= 4; regionZ += 2) {
      for (let regionX = -8; regionX <= 8; regionX += 2) {
        projections.push(...projectWildsAmbientLifeNeighborhood({ x: regionX * 24 + 1, z: regionZ * 24 + 1 }, "high"));
      }
    }

    assert.ok(projections.some((life) => life.medium === "aquatic"));
    assert.ok(projections.some((life) => life.medium === "aerial"));
    for (const life of projections) for (let index = 0; index < life.path.length; index += 1) {
      const point = life.path[index]!;
      const next = life.path[(index + 1) % life.path.length]!;
      for (let sample = 0; sample <= 4; sample += 1) {
        const amount = sample / 4;
        const x = point.x + (next.x - point.x) * amount;
        const z = point.z + (next.z - point.z) * amount;
        const y = point.y + (next.y - point.y) * amount;
        const terrain = sampleWildsTerrain(x, z);
        if (life.medium === "aquatic") {
          assert.ok(terrain.surface === "shallow-water" || terrain.surface === "deep-water", life.id);
          assert.ok(y > terrain.elevation && y < WILDS_WATERLINE_ELEVATION, life.id);
        } else {
          assert.ok(y >= terrain.elevation + 2.4, life.id);
        }
      }
    }
  });

  it("preserves identity and visibility across distance LOD changes", () => {
    const life = projectWildsAmbientLifeNeighborhood({ x: -95, z: -239 }, "high")[0];
    assert.ok(life);
    const far = projectWildsAmbientLifeLod(life, 44);
    const near = projectWildsAmbientLifeLod(life, 2);

    assert.equal(far.id, life.id);
    assert.equal(near.id, life.id);
    assert.equal(far.visible, true);
    assert.equal(near.visible, true);
    assert.notEqual(far.detail, near.detail);
  });

  it("uses deterministic quality prefixes without exceeding mobile population caps", () => {
    const position = { x: -95, z: -239 };
    const low = projectWildsAmbientLifeNeighborhood(position, "low");
    const medium = projectWildsAmbientLifeNeighborhood(position, "medium");
    const high = projectWildsAmbientLifeNeighborhood(position, "high");

    assert.ok(low.length <= 12);
    assert.ok(medium.length <= 20);
    assert.ok(high.length <= 28);
    assert.deepEqual(low.map((life) => life.id), high.slice(0, low.length).map((life) => life.id));
    assert.deepEqual(medium.map((life) => life.id), high.slice(0, medium.length).map((life) => life.id));
  });
});
