import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  projectWildsConstellation,
  projectWildsStarField
} from "../src/features/play/wilds-celestial-model";

test("the Wilds star field is deterministic and tier-bounded", () => {
  const expectedCounts = { low: 96, medium: 160, high: 240 } as const;
  for (const tier of ["low", "medium", "high"] as const) {
    const first = projectWildsStarField(tier);
    const second = projectWildsStarField(tier);
    assert.equal(first.count, expectedCounts[tier]);
    assert.deepEqual(first.positions, second.positions);
    assert.deepEqual(first.brightness, second.brightness);
    assert.equal(first.positions.length, first.count * 3);
    for (let index = 0; index < first.positions.length; index += 3) {
      const radius = Math.hypot(first.positions[index]!, first.positions[index + 1]!, first.positions[index + 2]!);
      assert.ok(radius >= 44.9 && radius <= 47.1, `star ${index / 3} escaped the celestial shell`);
      assert.ok(first.positions[index + 1]! >= 1.8, `star ${index / 3} fell below the playable horizon`);
    }
  }
  const model = readFileSync("src/features/play/wilds-celestial-model.ts", "utf8");
  const sky = readFileSync("src/features/play/WildsCelestialSky.tsx", "utf8");
  assert.doesNotMatch(model, /Math\.random|Date\.now|performance\.now/);
  assert.doesNotMatch(sky, /Date\.now|performance\.now/);
  assert.match(sky, /expression\.dayProgress \* Math\.PI \* 2/);
});

test("each Kai Ark/day phase has a stable authored constellation", () => {
  const phases = ["sunrise", "morning", "midday", "afternoon", "twilight", "night"] as const;
  const signatures = phases.map((phase) => {
    const first = projectWildsConstellation(phase);
    assert.deepEqual(first, projectWildsConstellation(phase));
    assert.ok(first.segmentCount >= 4);
    assert.equal(first.positions.length, first.segmentCount * 6);
    return [...first.positions].map((value) => value.toFixed(3)).join(":");
  });
  assert.equal(new Set(signatures).size, phases.length);
});
