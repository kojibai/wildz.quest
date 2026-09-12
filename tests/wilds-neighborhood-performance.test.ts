import test from "node:test";
import assert from "node:assert/strict";
import { createWildsOrderedSpatialIndex } from "../src/features/play/wilds-ordered-spatial-index";
import { createWildsAerialCollisionSample, createWildsAerialCollisionSampler, nearbyWildsAerialObstacles, writeWildsAerialCollisionSample } from "../src/features/play/wilds-grounded-movement";
import type { WildsTerrainObstacle } from "../src/features/play/wilds-terrain-obstacles";

test("ordered broad phase preserves duplicates, boundary contacts and oversized fallback", () => {
  const shared = { minX: -32, maxX: 0, minZ: -32, maxZ: 0 };
  const giant = { minX: -10000, maxX: 10000, minZ: -10000, maxZ: 10000 };
  const far = { minX: 2000, maxX: 2001, minZ: 2000, maxZ: 2001 };
  const values = [shared, far, giant, shared];
  const query = createWildsOrderedSpatialIndex(values, value => value);
  assert.deepEqual(query({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 }), [shared, giant, shared]);
  assert.equal(query({ minX: 1e100, maxX: 1e100, minZ: 0, maxZ: 0 }), values);
  assert.equal(query({ minX: NaN, maxX: 0, minZ: 0, maxZ: 0 }), values);
});

test("moving aerial broad phase matches exhaustive constraints and blocker ordering", () => {
  const obstacles: WildsTerrainObstacle[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `reverse-${1000 - i}`, kind: i % 4 === 0 ? "ceiling" : i % 4 === 1 ? "aerial-hazard" : "structure",
    material: "solid", position: { x: (i % 40) * 12 - 240, y: i % 5, z: Math.floor(i / 40) * 12 - 144 },
    radius: 9, shape: { kind: "box", halfX: 6, halfY: 2, halfZ: 6 }, visualScale: 1
  }));
  // Equal heights and repeated ids must retain original narrow-phase ordering.
  obstacles.push({ ...obstacles[0]!, id: "tie", position: { x: 0, y: 3, z: 0 }, radius: 20 });
  obstacles.push({ ...obstacles[0]!, id: "tie", position: { x: 0, y: 3, z: 0 }, radius: 20 });
  const sample = createWildsAerialCollisionSampler();
  for (let i = 0; i < 300; i++) {
    const point = { x: (i * 17 % 480) - 240, z: (i * 29 % 288) - 144 };
    const expected = writeWildsAerialCollisionSample(point, i % 9, obstacles, createWildsAerialCollisionSample(), 1.55, .38, obstacles);
    assert.deepEqual(sample(point, i % 9, obstacles, createWildsAerialCollisionSample(), 1.55, .38, obstacles), expected);
  }
  assert.ok(nearbyWildsAerialObstacles(obstacles, { x: 0, z: 0 }, .38).length < obstacles.length / 10);
});

test("construction admission never reuses an index for mutable imported coordinates", async () => {
  const { nearbyWildsConstruction } = await import("../src/features/play/wilds-construction-neighborhood");
  type Components = Parameters<typeof nearbyWildsConstruction>[0];
  // Only the spatial fields are needed by the broad phase; admission verifies full proofs afterwards.
  const component = { transform: { position: { x: 10000, z: 10000 } } };
  const components = { a: component } as unknown as Components;
  nearbyWildsConstruction(components, { x: 0, z: 0 }, 32);
  component.transform.position.x = 0;
  component.transform.position.z = 0;
  assert.ok(nearbyWildsConstruction(components, { x: 0, z: 0 }, 32).includes(components.a!));
});
