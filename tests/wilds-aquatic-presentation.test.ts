import assert from "node:assert/strict";
import { test } from "node:test";
import type { WildsTerrainSample } from "../src/features/play/wilds-terrain-authority";
import {
  WILDS_WATERLINE_ELEVATION,
  projectWildsAquaticPresentation,
  projectWildsAquaticPresentationAtPosition,
  wildsAquaticPresentationDiagnostics
} from "../src/features/play/wilds-aquatic-presentation";

function terrain(surface: WildsTerrainSample["surface"], elevation: number): WildsTerrainSample {
  return {
    version: "wildz.terrain.v1",
    elevation,
    normal: { x: 0, y: 1, z: 0 },
    slope: 0,
    surface,
    waterDepth: Math.max(0, -1.1 - elevation),
    regionId: "test-region",
    materialId: `wildz.terrain.material.${surface}.v1`,
    traversal: surface === "deep-water" ? [{ kind: "swim" }] : []
  };
}

test("aquatic presentation distinguishes land, wading, blocked water, and admitted swimming", () => {
  const land = projectWildsAquaticPresentation({ terrain: terrain("grass", 2), canSwim: false, airborne: false });
  const wading = projectWildsAquaticPresentation({ terrain: terrain("shallow-water", -1.6), canSwim: false, airborne: false });
  const blocked = projectWildsAquaticPresentation({ terrain: terrain("deep-water", -4), canSwim: false, airborne: false });
  const swimming = projectWildsAquaticPresentation({ terrain: terrain("deep-water", -4), canSwim: true, airborne: false });

  assert.equal(land.mode, "land");
  assert.equal(wading.mode, "wade");
  assert.equal(blocked.mode, "blocked");
  assert.equal(swimming.mode, "swim");
});

test("swimming suspends the actor inside the exact shared water column", () => {
  const deep = terrain("deep-water", -4);
  const swimming = projectWildsAquaticPresentation({ terrain: deep, canSwim: true, airborne: false });

  assert.equal(swimming.waterSurfaceY, WILDS_WATERLINE_ELEVATION);
  assert.equal(swimming.waterDepth, WILDS_WATERLINE_ELEVATION - deep.elevation);
  assert.ok(swimming.actorLocalY > 0);
  assert.ok(swimming.actorWorldY > deep.elevation);
    assert.ok(swimming.actorWorldY < WILDS_WATERLINE_ELEVATION);
    assert.ok(WILDS_WATERLINE_ELEVATION - swimming.actorWorldY >= 1.35);
  assert.equal(swimming.cameraSubmersionAllowed, true);
  assert.equal(swimming.scubaVisible, true);
  assert.ok(Object.isFrozen(swimming));
});

test("airborne traversal does not enter an aquatic presentation over deep water", () => {
  const airborne = projectWildsAquaticPresentation({ terrain: terrain("deep-water", -4), canSwim: true, airborne: true });

  assert.equal(airborne.mode, "land");
  assert.equal(airborne.waterDepth, WILDS_WATERLINE_ELEVATION + 4);
  assert.equal(airborne.actorLocalY, 0);
  assert.equal(airborne.cameraSubmersionAllowed, false);
  assert.equal(airborne.scubaVisible, false);
});

test("one admitted position projection records one analytical terrain sample", () => {
  const before = wildsAquaticPresentationDiagnostics();

  const projection = projectWildsAquaticPresentationAtPosition({ x: -12.5, z: 9.25, canSwim: true, airborne: false });
  const after = wildsAquaticPresentationDiagnostics();

  assert.equal(after.terrainProjections, before.terrainProjections + 1);
  assert.ok(Number.isFinite(projection.terrainElevation));
});
