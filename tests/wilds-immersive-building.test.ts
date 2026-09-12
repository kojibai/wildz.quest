import { resolveWildsObstacleMotion } from "../src/features/play/wilds-grounded-movement";
import assert from "node:assert/strict";
import test from "node:test";
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement, verifyWildsProductionPlacement, type WildsBlueprintPlacement } from "../src/features/play/wilds-world-construction";
import { wildsConstructionOccludesCamera } from "../src/features/play/wilds-construction-camera";
const base = createWildsBlueprintPreview("blueprint:immersive", "wildz.excavation.region.v1:0:0");
function place(kind: WildsBlueprintPlacement["kind"], pieces: WildsBlueprintPlacement[], x: number, z: number, version?: 2) {
  const evidence = { sourceBlueprint: { ...base, pieces }, pointer: { x, y: 0, z }, rotationQuarterTurns: 0, heightStep: 0,
    surfaceSnap: true, ...(version ? { snapVersion: version } : {}), physical: { terrainY: 0, waterline: null, anchors: pieces.flatMap(p => [...p.anchors]), solids: pieces.flatMap(p => [...p.collisionSolids]) } };
  const result = previewWildsBlueprintPlacement({ ...evidence, blueprint: evidence.sourceBlueprint, kind });
  return { result, evidence };
}
test("versioned walls meet foundation edges and roof closes the same module", () => {
  const foundation = place("foundation", [], 0, 0).result;
  const wall = place("wall", [foundation], 2.9, 0, 2);
  assert.equal(wall.result.valid, true, wall.result.cues.join(","));
  assert.equal(wall.result.transform.position.x, 2.85);
  assert.equal(wall.result.transform.rotationQuarterTurns, 1);
  assert.ok(Math.abs(wall.result.geometry.center.y - wall.result.geometry.halfExtents.y - foundation.geometry.center.y - foundation.geometry.halfExtents.y) < 1e-6);
  assert.equal(verifyWildsProductionPlacement(wall.result, wall.evidence), true);
  const roof = place("roof", [foundation, wall.result], 0, 0, 2);
  assert.equal(roof.result.valid, true, roof.result.cues.join(","));
  assert.equal(roof.result.transform.position.x, 0);
  assert.ok(Math.abs(roof.result.geometry.center.y - roof.result.geometry.halfExtents.y - wall.result.geometry.center.y - wall.result.geometry.halfExtents.y) < 1e-6);
  assert.equal(verifyWildsProductionPlacement(roof.result, roof.evidence), true);
});
test("legacy placement evidence remains valid and snap version is bound", () => {
  const foundation = place("foundation", [], 0, 0);
  assert.equal(foundation.result.snapVersion, undefined);
  assert.equal(verifyWildsProductionPlacement(foundation.result, foundation.evidence), true);
  assert.equal(verifyWildsProductionPlacement(foundation.result, { ...foundation.evidence, snapVersion: 2 }), false);
});
test("room door geometry leaves a traversable opening and aligns the frame", () => {
  const foundation = place("foundation", [], 0, 0).result;
  const room = place("room", [foundation], 0, 0, 2).result;
  assert.equal(room.valid, true);
  const door = place("door", [foundation, room], 0, 3, 2).result;
  assert.equal(door.valid, true, door.cues.join(","));
  assert.equal(door.transform.rotationQuarterTurns, room.transform.rotationQuarterTurns);
  assert.ok(door.interior!.halfExtents.x >= .4);
});
test("camera cutaways hide only intervening solids, not the far wall", () => {
  const box = { center: { x: 0, y: 1, z: 2 }, halfExtents: { x: 3, y: 1.5, z: .15 } };
  const camera = { x: 0, y: 2, z: 6 }, target = { x: 0, y: 1, z: 0 };
  assert.equal(wildsConstructionOccludesCamera(box, camera, target), true);
  assert.equal(wildsConstructionOccludesCamera({ ...box, center: { ...box.center, z: -2 } }, camera, target), false);
  assert.equal(wildsConstructionOccludesCamera(box, { ...camera, x: 10 }, { ...target, x: 10 }), false);
});

test("all four walls join one deck at equal height and adjacent floors stay level", () => {
  const foundation = place("foundation", [], 0, 0).result;
  const pieces = [foundation];
  for (const [x, z] of [[2.9, 0], [-2.9, 0], [0, 2.9], [0, -2.9]]) {
    const wall = place("wall", pieces, x, z, 2);
    assert.equal(wall.result.valid, true, wall.result.cues.join(","));
    assert.equal(wall.result.geometry.center.y, 2.1);
    assert.equal(verifyWildsProductionPlacement(wall.result, wall.evidence), true);
    pieces.push(wall.result);
  }
  const floor = place("floor", [foundation], 0, 0, 2).result;
  const adjacent = place("floor", [floor], 5, 0, 2);
  assert.equal(adjacent.result.valid, true, adjacent.result.cues.join(","));
  assert.equal(adjacent.result.geometry.center.x, 6);
  assert.equal(adjacent.result.geometry.center.y, floor.geometry.center.y);
});

test("the physical character fits through the door and cannot walk through the adjoining wall", () => {
  const foundation = place("foundation", [], 0, 0).result;
  const room = place("room", [foundation], 0, 0, 2).result;
  const door = place("door", [foundation, room], 0, 3, 2).result;
  const obstacles = [room, door].flatMap(piece => piece.collisionSolids)
    .filter(solid => solid.center.y + solid.halfExtents.y > 1 && solid.center.y - solid.halfExtents.y < 2)
    .map(solid => ({ id: `wildz.component:${solid.id}`, kind: "structure" as const, material: "solid" as const, position: solid.center,
      radius: Math.hypot(solid.halfExtents.x, solid.halfExtents.z), visualScale: 1,
      shape: { kind: "box" as const, halfX: solid.halfExtents.x, halfY: solid.halfExtents.y, halfZ: solid.halfExtents.z } }));
  const entered = resolveWildsObstacleMotion({ x: 0, z: 4 }, { x: 0, z: 2 }, obstacles, .38);
  assert.ok(entered.position.z <= 2.01);
  assert.deepEqual(entered.blockedBy, []);
  const blocked = resolveWildsObstacleMotion({ x: 1.5, z: 4 }, { x: 1.5, z: 2 }, obstacles, .38);
  assert.ok(blocked.position.z > 3);
  assert.ok(blocked.blockedBy.length > 0);
});
