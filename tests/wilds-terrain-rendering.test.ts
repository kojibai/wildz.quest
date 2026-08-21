import assert from "node:assert/strict";
import { test } from "node:test";
import { wildsTerrainElevation } from "../src/features/play/wilds-terrain-authority";
import {
  buildWildsTerrainPatchProjection,
  buildWildsTerrainMeshProjection,
  buildWildsTerrainRibbonProjection,
  projectWildsTerrainActorPosition,
  wildsTerrainRelativeElevation
} from "../src/features/play/wilds-terrain-rendering";

test("terrain mesh projection has stable indexed geometry dimensions", () => {
  const mesh = buildWildsTerrainMeshProjection(2, -3, 4);

  assert.equal(mesh.positions.length, 25 * 3);
  assert.equal(mesh.normals.length, 25 * 3);
  assert.equal(mesh.uvs.length, 25 * 2);
  assert.equal(mesh.indices.length, 4 * 4 * 6);
  assert.deepEqual(mesh.origin, { x: 24, z: -36 });
});

test("terrain mesh vertices preserve authoritative world elevations and normals", () => {
  const mesh = buildWildsTerrainMeshProjection(-1, 1, 3);

  for (const vertex of mesh.vertices) {
    assert.equal(vertex.position.y, wildsTerrainElevation(vertex.world.x, vertex.world.z));
    assert.ok(Math.abs(Math.hypot(vertex.normal.x, vertex.normal.y, vertex.normal.z) - 1) < 0.000002);
  }
});

test("neighboring visual meshes preserve identical authoritative edge values", () => {
  const left = buildWildsTerrainMeshProjection(0, 0, 8);
  const right = buildWildsTerrainMeshProjection(1, 0, 8);
  const leftEdge = left.vertices.filter((vertex) => vertex.grid.x === 8).map((vertex) => ({
    world: vertex.world,
    elevation: vertex.position.y,
    normal: vertex.normal
  }));
  const rightEdge = right.vertices.filter((vertex) => vertex.grid.x === 0).map((vertex) => ({
    world: vertex.world,
    elevation: vertex.position.y,
    normal: vertex.normal
  }));

  assert.deepEqual(leftEdge, rightEdge);
});

test("relative terrain keeps the explorer grounded without changing absolute coordinates", () => {
  const player = { x: 37.25, z: -18.5 };
  const nearby = { x: player.x + 8, z: player.z - 5 };

  assert.equal(wildsTerrainRelativeElevation(player.x, player.z, player), 0);
  assert.equal(
    wildsTerrainRelativeElevation(nearby.x, nearby.z, player),
    wildsTerrainElevation(nearby.x, nearby.z) - wildsTerrainElevation(player.x, player.z)
  );
});

test("streamed terrain patch combines a five-by-five tile footprint into one indexed mesh", () => {
  const patch = buildWildsTerrainPatchProjection(3, -2, 2, 4);
  const tiles = 25;

  assert.deepEqual(patch.origin, { x: 12, z: -48 });
  assert.equal(patch.positions.length, tiles * 25 * 3);
  assert.equal(patch.normals.length, tiles * 25 * 3);
  assert.equal(patch.uvs.length, tiles * 25 * 2);
  assert.equal(patch.indices.length, tiles * 4 * 4 * 6);
  assert.equal(patch.vertices[0]?.world.x, 12);
  assert.equal(patch.vertices.at(-1)?.world.z, 12);
});

test("authored ribbons sample both edges from deterministic terrain", () => {
  const ribbon = buildWildsTerrainRibbonProjection([
    { x: 20, z: -8 },
    { x: 28, z: -2 },
    { x: 34, z: 6 }
  ], 0.5, 0.03, 2);

  assert.ok(ribbon.vertices.length > 6);
  assert.equal(ribbon.indices.length, (ribbon.vertices.length / 2 - 1) * 6);
  for (const vertex of ribbon.vertices) {
    assert.equal(vertex.position.y, wildsTerrainElevation(vertex.world.x, vertex.world.z) + 0.03);
  }
});

test("world actors share exact player-relative horizontal and ground coordinates", () => {
  const player = { x: 37.25, z: -18.5 };
  const actor = { x: 45.25, z: -23.75 };

  assert.deepEqual(projectWildsTerrainActorPosition(actor, player, 0.42), [
    8,
    0.42 + wildsTerrainRelativeElevation(actor.x, actor.z, player),
    -5.25
  ]);
});
