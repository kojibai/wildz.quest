import test from "node:test";
import assert from "node:assert/strict";
import { createWildsGrassGeometry } from "../src/features/play/wilds-botanical-geometry";
import { wildsVegetationAspect, wildsTerrainSurfaceTint } from "../src/features/play/wilds-place-presentation";

test("grass retains the old box's twelve triangles without degenerate normals", () => {
  const geometry = createWildsGrassGeometry();
  assert.equal(geometry.getAttribute("position").count, 36);
  const normals = geometry.getAttribute("normal");
  for (let i = 0; i < normals.count; i++) {
    assert.ok(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < .00001);
  }
  geometry.dispose();
});

test("grove forms remain stable, smoothly varying and bounded across distant and negative coordinates", () => {
  const forms = new Set<number>();
  for (let x = -10000; x <= 10000; x += 131) {
    const z = x * -.79;
    const value = wildsVegetationAspect(x, z);
    assert.equal(value, wildsVegetationAspect(x, z));
    assert.ok(value >= .7 && value <= 1.1);
    assert.ok(Math.abs(value - wildsVegetationAspect(x + .01, z)) < .001);
    forms.add(value);
  }
  assert.ok(forms.size > 100);
  assert.notDeepEqual(wildsTerrainSurfaceTint("rock"), wildsTerrainSurfaceTint("grass"));
  assert.notDeepEqual(wildsTerrainSurfaceTint("sand"), wildsTerrainSurfaceTint("soil"));
});
