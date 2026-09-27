import assert from "node:assert/strict";
import { it } from "node:test";
import { resolveWildsGroundMovement } from "../src/features/play/wilds-grounded-movement.js";

it("uses an exact-address terrain sampler for v11 movement instead of nearby v10 geography", () => {
  const samples: string[] = [];
  const result = resolveWildsGroundMovement({ x: 7, z: 19 }, { x: 7.4, z: 19 }, {
    obstacles: [],
    terrainSampler(x, z) {
      samples.push(`${x}:${z}`);
      return { elevation: 13.5, surface: "grass", traversal: [] };
    }
  });
  assert.equal(result.position.x, 7.4);
  assert.equal(result.elevation, 13.5);
  assert.equal(result.surface, "grass");
  assert.ok(samples.includes("7:19"));
  assert.ok(samples.includes("7.4:19"));
});
