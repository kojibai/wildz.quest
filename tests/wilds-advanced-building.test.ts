import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement, reduceWildsBlueprintPreview } from "../src/features/play/wilds-world-construction";
import { projectWildsCustomBuildingMap } from "../src/features/play/wilds-custom-building-map";
import { createWildsConstructionProject } from "../src/features/play/wilds-construction-project";
import type { WildsConstructionComponentV1 } from "../src/features/play/wilds-construction-component";

test("full-storey stairs rise in walkable quarter-metre steps and stairwell floors keep the flight clear", () => {
  for (const turn of [0, 1, 2, 3]) {
    let blueprint = createWildsBlueprintPreview(`stairs:${turn}`, "wildz.excavation.region.v1:0:0");
    const stairs = previewWildsBlueprintPlacement({ blueprint, kind: "stair-flight", pointer: { x: 0, y: 0, z: 0 }, rotationQuarterTurns: turn, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } });
    assert.equal(stairs.valid, true);
    const tops = stairs.collisionSolids.map(solid => solid.center.y + solid.halfExtents.y).sort((a, b) => a - b);
    assert.equal(tops.length, 12);
    assert.equal(tops.at(-1)! - tops[0]!, 2.75);
    for (let i = 1; i < tops.length; i++) assert.ok(Math.abs(tops[i]! - tops[i - 1]! - .25) < 1e-6);
    blueprint = reduceWildsBlueprintPreview(blueprint, { kind: "place-preview", placement: stairs });
    const floor = previewWildsBlueprintPlacement({ blueprint, kind: "stairwell-floor", pointer: stairs.anchors[0]!.position, rotationQuarterTurns: turn, heightStep: 0, surfaceSnap: true, snapVersion: 2, physical: { terrainY: 0, waterline: null, anchors: stairs.anchors, solids: stairs.collisionSolids } });
    assert.equal(floor.valid, true, floor.cues.join(","));
    // A person halfway up must not hit a full floor slab overhead.
    assert.equal(floor.collisionSolids.some(solid => Math.abs(solid.center.x) < solid.halfExtents.x && Math.abs(solid.center.z) < solid.halfExtents.z), false);
  }
});

test("large custom projects produce one map marker and omit underground pieces", () => {
  const project = createWildsConstructionProject({ ownerReceizId: "builder", name: "Great Hall", region: { x: 0, z: 0 }, kaiUPulse: 1, commandId: "great-hall" });
  const components = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [String(i), { projectId: project.projectId, evidence: {}, transform: { position: { x: i % 20, y: 3, z: Math.floor(i / 20) } } } as WildsConstructionComponentV1]));
  components.underground = { projectId: project.projectId, evidence: { spaceId: "burrow" }, transform: { position: { x: 999, y: -30, z: 999 } } } as WildsConstructionComponentV1;
  const markers = projectWildsCustomBuildingMap({ constructionProjects: { [project.projectId]: project }, constructionComponents: components });
  assert.equal(markers.length, 1);
  assert.equal(markers[0]!.name, "Great Hall");
  assert.equal(markers[0]!.pieceCount, 1000);
  assert.deepEqual(markers[0]!.position, { x: 9.5, y: 3, z: 24.5 });
});
