import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createWildsOrganicGeometry, type WildsOrganicShape } from "../src/features/play/wilds-organic-geometry";

for (const shape of ["trunk", "canopy", "crown", "shrub", "stone"] as WildsOrganicShape[]) {
  test(`${shape} preserves the existing triangle budget with finite, bounded geometry`, () => {
    const geometry = createWildsOrganicGeometry(shape);
    const baseline = shape === "trunk" ? new THREE.CylinderGeometry(.16,.29,1.2,8)
      : shape === "crown" ? new THREE.IcosahedronGeometry(1,1)
      : new THREE.DodecahedronGeometry(1,shape === "stone" ? 0 : 1);
    const vertices = geometry.getAttribute("position");
    assert.equal(geometry.index?.count ?? vertices.count, baseline.index?.count ?? baseline.getAttribute("position").count);
    for (const name of ["position", "normal", "color"]) {
      const attribute = geometry.getAttribute(name);
      assert.equal(attribute.count, vertices.count);
      assert.ok(Array.from(attribute.array).every(Number.isFinite));
    }
    assert.ok(Array.from(geometry.getAttribute("color").array).every(value => value >= 0 && value <= 1));
    assert.ok(geometry.boundingSphere!.radius < 1.5);
    assert.notDeepEqual(Array.from(vertices.array), Array.from(baseline.getAttribute("position").array));
    const again = createWildsOrganicGeometry(shape);
    assert.deepEqual(Array.from(vertices.array), Array.from(again.getAttribute("position").array));
    geometry.dispose(); baseline.dispose(); again.dispose();
  });
}
