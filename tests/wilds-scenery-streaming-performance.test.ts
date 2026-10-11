import assert from 'node:assert/strict';
import {test} from 'node:test';
import {projectWildsBuildSceneryFootprints, wildsBuildSceneryClearedAt, wildsBuildSceneryDiagnostics} from '../src/features/play/wilds-build-scenery';
import {buildWildsTerrainPatchProjection, buildWildsTerrainWaterProjection, gradeWildsTerrainMeshProjection, gradeWildsTerrainWaterProjection} from '../src/features/play/wilds-terrain-rendering';

test('retired scenery preserves ordinary terrain detail after all laydowns are collected', () => {
  const history = [{id: 'collected-clearance', ownerId: 'owner', sourceHead: 'history', center: {x: 6, y: 3, z: 6}, halfExtents: {x: 12, z: 12}, yaw: 0, clearsScenery: true as const, historicalScenery: true as const}];
  const ground = buildWildsTerrainPatchProjection(0, 0, 1, 4);
  const water = buildWildsTerrainWaterProjection(0, 0, 1, 4);
  assert.equal(buildWildsTerrainPatchProjection(0, 0, 1, 4, history).vertices.length, ground.vertices.length);
  const historicalWater = buildWildsTerrainWaterProjection(0, 0, 1, 4, history);
  assert.equal(historicalWater.deep.positions.length + historicalWater.shallow.positions.length, water.deep.positions.length + water.shallow.positions.length);
  assert.equal(gradeWildsTerrainMeshProjection(ground, history), ground);
  assert.equal(gradeWildsTerrainWaterProjection(water, history), water);
  const retained = history.map(pad => ({...pad, retainedLaydown: true as const}));
  assert.ok(buildWildsTerrainPatchProjection(0, 0, 1, 4, retained).vertices.length > ground.vertices.length, 'uncollected laydowns retain their exact supported floor');
});

test('one streamed scenery batch builds one index for all tree, bush and flower queries', () => {
  const source = Array.from({length: 120}, (_, index) => ({center: {x: index * 6, y: 0, z: 0}, halfExtents: {x: 2, z: 2}, yaw: .15}));
  const footprints = projectWildsBuildSceneryFootprints(source);
  const before = wildsBuildSceneryDiagnostics();
  for (let index = 0; index < 4_000; index++) wildsBuildSceneryClearedAt(footprints, index % 800, 20, .2);
  assert.equal(wildsBuildSceneryDiagnostics().spatialIndexBuilds - before.spatialIndexBuilds, 1);
  assert.equal(Object.isFrozen(source), false);
  assert.equal(Object.isFrozen(source[0].center), false);
  assert.equal(wildsBuildSceneryClearedAt(footprints, 0, 0), true);
  source[0].center.x = -1000;
  assert.equal(wildsBuildSceneryClearedAt(footprints, 0, 0), true, 'a streamed batch owns its snapshot');
  assert.equal(wildsBuildSceneryClearedAt(projectWildsBuildSceneryFootprints(source), 0, 0), false, 'the next batch reflects the new footprint');
});

test('direct mutable footprint queries still observe changed imported coordinates', () => {
  const source = [{center: {x: 1000, y: 0, z: 0}, halfExtents: {x: 2, z: 2}, yaw: 0}];
  assert.equal(wildsBuildSceneryClearedAt(source, 0, 0), false);
  source[0].center.x = 0;
  assert.equal(wildsBuildSceneryClearedAt(source, 0, 0), true);
});
