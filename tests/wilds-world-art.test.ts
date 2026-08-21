import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import {
  projectWildsHorizonAnchors,
  projectWildsRouteGuides
} from "../src/features/play/wilds-world-art";

describe("Wildz deterministic world-art projection", () => {
  it("projects a stable quality-bounded terrain-authority horizon", () => {
    const player = { x: 37.25, z: -18.75 };
    const low = projectWildsHorizonAnchors(player, "low");
    const medium = projectWildsHorizonAnchors(player, "medium");
    const high = projectWildsHorizonAnchors(player, "high");

    assert.equal(low.length, 10);
    assert.equal(medium.length, 14);
    assert.equal(high.length, 18);
    assert.deepEqual(high, projectWildsHorizonAnchors(player, "high"));
    assert.equal(new Set(high.map((anchor) => anchor.id)).size, high.length);

    for (const anchor of high) {
      const distance = Math.hypot(anchor.relative.x, anchor.relative.z);
      assert.ok(distance >= 28 && distance <= 35, `${anchor.id}:${distance}`);
      assert.equal(anchor.elevation, sampleWildsTerrain(anchor.world.x, anchor.world.z).elevation);
      assert.ok(anchor.variant === 0 || anchor.variant === 1 || anchor.variant === 2);
    }
  });

  it("projects only nearby authored-route guides on exact terrain", () => {
    const player = { x: 0, z: 0 };
    const guides = projectWildsRouteGuides(player, 30);

    assert.ok(guides.length >= 4);
    assert.ok(guides.length <= 18);
    assert.deepEqual(guides, projectWildsRouteGuides(player, 30));
    assert.equal(new Set(guides.map((guide) => guide.id)).size, guides.length);
    for (const guide of guides) {
      assert.ok(guide.distance <= 30, guide.id);
      assert.equal(guide.elevation, sampleWildsTerrain(guide.world.x, guide.world.z).elevation);
      assert.ok(Number.isFinite(guide.heading));
    }
    assert.deepEqual(projectWildsRouteGuides({ x: 10_000, z: 10_000 }, 12), []);
  });

  it("keeps visual projection pure and outside every authority hot path", async () => {
    const source = await readFile("src/features/play/wilds-world-art.ts", "utf8");

    assert.doesNotMatch(source, /Math\.random|fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
    assert.doesNotMatch(source, /setTimeout|setInterval|requestAnimationFrame|performance\.now/);
    assert.doesNotMatch(source, /react|receiz|verif|proof|vault|identity/i);
  });
});
