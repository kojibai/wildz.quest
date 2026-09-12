import test from "node:test";
import assert from "node:assert/strict";
import { projectWildsTreePart } from "../src/features/play/wilds-tree-structure";
import { projectWildsResourceBody } from "../src/features/play/wilds-work-presentation";

test("trees and stumps remain rooted across sizes and depletion states", () => {
  for (const scale of [.72, 1, 1.34]) for (const variant of [0, 1, 2]) for (let available = 0; available <= 20; available++) {
    const item = { x: 25, z: -80, scale, variant, resourceBody: projectWildsResourceBody({ kind: "timber", capacity: 20, availableCapacity: available }) };
    const trunk = projectWildsTreePart(item, "trunk");
    assert.ok(Math.abs(trunk.y - .6 * trunk.scale[1] + .035) < 1e-8);
    const parts = ["lower", "upper", "crown"].map(part => projectWildsTreePart(item, part as "lower" | "upper" | "crown"));
    if (!available) {
      for (const part of parts) assert.deepEqual(part.scale, [0, 0, 0]);
    } else {
      assert.ok(parts[2]!.y < trunk.y + .6 * trunk.scale[1]);
      for (let i = 0; i < 2; i++) {
        const radii = [.72 * .46, .56 * .46, .52 * .46];
        assert.ok(parts[i]!.y + radii[i]! * parts[i]!.scale[1] >= parts[i + 1]!.y - radii[i + 1]! * parts[i + 1]!.scale[1]);
      }
    }
  }
});

test("growth habits have distinct silhouettes but deterministic transforms and identical stumps", () => {
  const ratios = new Set<number>();
  for (const variant of [0, 1, 2]) {
    const item = { x: -351, z: 928, scale: 1, variant };
    const crown = projectWildsTreePart(item, "lower");
    assert.deepEqual(crown, projectWildsTreePart(item, "lower"));
    ratios.add(Math.round(crown.scale[0] / crown.scale[1] * 100));
    const exhausted = { ...item, resourceBody: projectWildsResourceBody({ kind: "timber", capacity: 20, availableCapacity: 0 }) };
    assert.deepEqual(projectWildsTreePart(exhausted, "crown").scale, [0, 0, 0]);
    const stump = projectWildsTreePart(exhausted, "trunk");
    assert.ok(Math.abs(stump.y - .6 * stump.scale[1] + .035) < 1e-8);
  }
  assert.equal(ratios.size, 3);
});
