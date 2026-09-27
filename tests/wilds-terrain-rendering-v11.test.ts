import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWildsTerrainPatchV11 } from "../src/features/play/wilds-terrain-rendering-v11";
import { sampleWildsTerrainV11 } from "../src/features/play/wilds-terrain-authority";
import { offsetWildsWorldAddress } from "../src/features/play/wilds-world-address";

const far = { worldVersion: 11, regionX: "9007199254740993", regionZ: "-17", localX: 23_500_000, localZ: 12_000_000 } as const;

describe("exact v11 terrain scene patch", () => {
  it("samples the same physical elevations as movement across a huge region seam", () => {
    const patch = buildWildsTerrainPatchV11(far, 2, 1, 12, 2, 8);
    assert.equal(patch.vertexCount, 41 * 41);
    assert.equal(patch.indices.length, 40 * 40 * 6);
    const center = 16 * 41 + 16;
    assert.equal(patch.positions[center * 3 + 1], sampleWildsTerrainV11(offsetWildsWorldAddress(far, 500_000n, 0n)).elevation);
    assert.ok(patch.vertices.some(vertex => vertex.address.regionX === "9007199254740994"));
    assert.ok(patch.vertices.some(vertex => vertex.address.regionX === "9007199254740993"));
    for (const vertex of patch.vertices) {
      assert.equal(vertex.y, sampleWildsTerrainV11(vertex.address).elevation);
      assert.ok(Number.isFinite(vertex.y));
    }
  });
});
