import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { WILDS_MAJOR_ROUTES } from "../src/features/play/wilds-world-geography";
import {
  projectWildsRouteGuides
} from "../src/features/play/wilds-world-art";

function previousRouteGuideProjection(player: { x: number; z: number }, radius: number) {
  const quantize = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
  const guides = WILDS_MAJOR_ROUTES.flatMap((route, routeIndex) => route.points.slice(0, -1).flatMap((start, segmentIndex) => {
    const end = route.points[segmentIndex + 1]!;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 11));
    return Array.from({ length: steps }, (_, stepIndex) => ({
      id: `route-guide:${route.id}:${segmentIndex}:${stepIndex}`,
      routeId: route.id,
      world: { x: quantize(start.x + dx * stepIndex / steps), z: quantize(start.z + dz * stepIndex / steps) },
      heading: quantize(Math.atan2(dx, dz)),
      variant: (routeIndex % 2) as 0 | 1
    }));
  }));
  const boundedRadius = Number.isFinite(radius) ? Math.max(0, Math.min(42, radius)) : 0;
  return guides.map((guide) => {
    const relative = { x: quantize(guide.world.x - player.x), z: quantize(guide.world.z - player.z) };
    return { ...guide, relative, elevation: sampleWildsTerrain(guide.world.x, guide.world.z).elevation,
      distance: quantize(Math.hypot(relative.x, relative.z)) };
  }).filter((guide) => guide.distance <= boundedRadius)
    .sort((left, right) => left.distance - right.distance || left.id.localeCompare(right.id)).slice(0, 18);
}

describe("Wildz deterministic world-art projection", () => {
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

  it("preserves every route guide and its order across nearby and distant positions", () => {
    for (const [player, radius] of [
      [{ x: 0, z: 0 }, 30],
      [{ x: 17.4, z: -18.2 }, 42],
      [{ x: -86.5, z: 94.1 }, 12],
      [{ x: 10_000, z: 10_000 }, 12],
      [{ x: 0, z: 0 }, 0]
    ] as const) {
      const expected = previousRouteGuideProjection(player, radius);
      assert.deepEqual(projectWildsRouteGuides(player, radius), expected);
      assert.deepEqual(projectWildsRouteGuides(player, radius), expected);
    }
  });
});
