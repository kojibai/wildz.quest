import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { wildsTerrainElevation } from "../src/features/play/wilds-terrain-authority";
import { WILDS_WATERLINE_ELEVATION } from "../src/features/play/wilds-aquatic-presentation";
import {
  buildWildsTerrainPatchProjection,
  buildWildsTerrainMeshProjection,
  buildWildsTerrainWaterProjection,
  buildWildsTerrainRibbonProjection,
  clearWildsTerrainRenderCaches,
  projectWildsTerrainActorPosition,
  writeWildsTerrainActorPosition,
  wildsTerrainProjectionDiagnostics,
  wildsTerrainRenderCacheDiagnostics,
  wildsTerrainRelativeElevation
} from "../src/features/play/wilds-terrain-rendering";

function projectionDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

test("cached terrain and water preserve exact projection output and return independent values", () => {
  clearWildsTerrainRenderCaches();
  const cases = [
    ["e43da4837b66db92442effb74e9ece8ff5add59bca2b0dc884ee6783528c4bd1", () => buildWildsTerrainMeshProjection(-2, 3, 4)],
    ["177269fe3093301405d9c6e38b84d5017baf777aa55bbbbca9c85d96dd4d84a2", () => buildWildsTerrainPatchProjection(2, -1, 2, 4)],
    ["607db2700f50b70dc2449dc720655361ec63b2194d855da54c22700d01ea2a88", () => buildWildsTerrainWaterProjection(-1, -9, 2, 4)],
    ["27dca4c90f6a7fd3abddd938894d49af22e4f83ccd4a6cb49903d34382989294", () => buildWildsTerrainPatchProjection(1.25, -2.5, 1, 3)],
    ["b118a956ce349aaef82ff1bbae8c3d1d271c9de4ffd367dc274275dbb99c141d", () => buildWildsTerrainWaterProjection(1.25, -2.5, 1, 3)]
  ] as const;
  for (const [expected, build] of cases) {
    assert.equal(projectionDigest(build()), expected);
    assert.equal(projectionDigest(build()), expected);
  }
  const beforeMutation = buildWildsTerrainMeshProjection(-2, 3, 4);
  (beforeMutation.positions as number[])[0] = 999;
  beforeMutation.vertices[0]!.world.x = 999;
  beforeMutation.vertices[0]!.normal.y = 999;
  assert.equal(projectionDigest(buildWildsTerrainMeshProjection(-2, 3, 4)), cases[0][0]);
  const diagnostics = wildsTerrainRenderCacheDiagnostics();
  assert.ok(diagnostics.mesh.hits > 0);
  assert.ok(diagnostics.water.hits > 0);
});

test("terrain rendering caches evict old tiles at their fixed entry bounds", () => {
  clearWildsTerrainRenderCaches();
  for (let tileX = 0; tileX <= 384; tileX += 1) buildWildsTerrainMeshProjection(tileX, 0, 1);
  let diagnostics = wildsTerrainRenderCacheDiagnostics();
  assert.equal(diagnostics.mesh.entries, diagnostics.mesh.maxEntries);
  assert.ok(diagnostics.mesh.bytes <= diagnostics.mesh.maxBytes);
  const meshMisses = diagnostics.mesh.misses;
  buildWildsTerrainMeshProjection(0, 0, 1);
  assert.equal(wildsTerrainRenderCacheDiagnostics().mesh.misses, meshMisses + 1);

  for (let tileX = 0; tileX <= 512; tileX += 1) buildWildsTerrainWaterProjection(tileX, 0, 0, 1);
  diagnostics = wildsTerrainRenderCacheDiagnostics();
  assert.equal(diagnostics.water.entries, diagnostics.water.maxEntries);
  assert.ok(diagnostics.water.bytes <= diagnostics.water.maxBytes);
  const waterMisses = diagnostics.water.misses;
  buildWildsTerrainWaterProjection(0, 0, 0, 1);
  assert.equal(wildsTerrainRenderCacheDiagnostics().water.misses, waterMisses + 1);
});

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

test("streamed physical water projects distinct shallow and deep surfaces above the terrain bed", () => {
  const water = buildWildsTerrainWaterProjection(-1, -9, 2, 8);

  assert.ok(water.shallow.indices.length > 0);
  assert.ok(water.deep.indices.length > 0);
  const shallowHeights = water.shallow.positions.filter((_, index) => index % 3 === 1);
  const deepHeights = water.deep.positions.filter((_, index) => index % 3 === 1);
  assert.equal(water.waterline, WILDS_WATERLINE_ELEVATION);
  assert.ok(shallowHeights.every((y) => y === WILDS_WATERLINE_ELEVATION));
  assert.ok(deepHeights.every((y) => y === WILDS_WATERLINE_ELEVATION));
});

test("physical water has no square holes where a dry causeway crosses submerged terrain", () => {
  const radius = 2;
  const segments = 4;
  const water = buildWildsTerrainWaterProjection(-8, -4, radius, segments);
  const streamedTiles = (radius * 2 + 1) ** 2;
  const expectedTriangleIndices = streamedTiles * segments * segments * 6;

  assert.equal(water.shallow.indices.length + water.deep.indices.length, expectedTriangleIndices);
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

test("steady trainer projection reuses the admitted anchor elevation for 300 frames", () => {
  const player = { x: 37.25, z: -18.5 };
  const anchorElevation = wildsTerrainElevation(player.x, player.z);
  const before = wildsTerrainProjectionDiagnostics();

  for (let frame = 0; frame < 300; frame += 1) {
    const phase = frame / 60;
    const actor = { x: 45.25 + Math.sin(phase) * 0.7, z: -23.75 + Math.cos(phase * 0.83) * 0.7 };
    const position = projectWildsTerrainActorPosition(actor, player, 0, { anchorElevation });
    assert.deepEqual(position, [
      actor.x - player.x,
      wildsTerrainElevation(actor.x, actor.z) - anchorElevation,
      actor.z - player.z
    ]);
  }

  const after = wildsTerrainProjectionDiagnostics();
  assert.equal(after.anchorTerrainSamples, before.anchorTerrainSamples);
  assert.equal(after.actorTerrainSamples, before.actorTerrainSamples + 300);
});

test("steady trainer frame positioning reuses one mutable target", () => {
  const target = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } };
  const anchorElevation = wildsTerrainElevation(37.25, -18.5);
  for (let frame = 0; frame < 10_000; frame += 1) {
    const phase = frame / 60;
    const x = 45.25 + Math.sin(phase) * .7;
    const z = -23.75 + Math.cos(phase * .83) * .7;
    assert.equal(writeWildsTerrainActorPosition(target, x, z, 37.25, -18.5, 0, undefined, anchorElevation), target);
  }
  assert.ok(Number.isFinite(target.x));
  assert.ok(Number.isFinite(target.y));
  assert.ok(Number.isFinite(target.z));
});
