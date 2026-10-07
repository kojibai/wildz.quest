import test from 'node:test';
import assert from 'node:assert/strict';
import { wildsNourishmentPlantsForTile } from '../src/features/play/wilds-nourishment';
import { projectWildsObstaclePlacement, wildsTerrainObstaclesForTile } from '../src/features/play/wilds-terrain-obstacles';
import { projectWildsTreePart } from '../src/features/play/wilds-tree-structure';
import { initialWildsHarvestedSourceState } from '../src/features/play/wilds-steward-construction';
import { projectWildsFruitAttachments } from '../src/features/play/wilds-nourishment-visuals';
import { createWildsResourcePlacementProjector } from '../src/features/play/wilds-resource-placements';
import { projectWildsResourceSourceForObstacle } from '../src/features/play/wilds-resource-authority';
import * as visuals from '../src/features/play/wilds-nourishment-visuals';

test('unchanged plants retain their render data while movement updates picking reach', () => {
  type Row = { plant: ReturnType<typeof import('../src/features/play/wilds-nourishment').projectWildsNourishmentPlants>[number]; groundY: number; tree?: ReturnType<typeof projectWildsObstaclePlacement> };
  const create = (visuals as unknown as { createWildsNourishmentPlantRenderCache?: () => (rows: readonly Row[]) => readonly Row[] }).createWildsNourishmentPlantRenderCache;
  assert.equal(typeof create, 'function');
  const retain = create!();
  const plant = wildsNourishmentPlantsForTile(3, 3)[0]!;
  const row: Row = { plant: { ...plant, valid: true, cropDay: 0, harvested: 0, remaining: plant.capacity, head: 'crop:0', nextRegrowthKaiUPulse: 1, distance: 5, canGather: false }, groundY: plant.position.y };
  const first = retain([row]);
  for (let index = 0; index < 1_000; index++) {
    assert.equal(retain([{ ...row, plant: { ...row.plant, distance: index / 100, canGather: index < 260, head: `crop:${index}` } }]), first);
  }
  assert.notEqual(retain([{ ...row, plant: { ...row.plant, remaining: row.plant.remaining - 1 } }]), first);
  const restored = retain([row]);
  assert.notEqual(retain([{ ...row, groundY: row.groundY + .5 }]), restored);
  assert.equal(retain([]).length, 0);
});

test('plant rendering follows the actual harvested tree and visible source selection', () => {
  type Row = { plant: ReturnType<typeof import('../src/features/play/wilds-nourishment').projectWildsNourishmentPlants>[number]; groundY: number; tree?: ReturnType<typeof projectWildsObstaclePlacement> };
  const create = (visuals as unknown as { createWildsNourishmentPlantRenderCache?: () => (rows: readonly Row[]) => readonly Row[] }).createWildsNourishmentPlantRenderCache;
  assert.equal(typeof create, 'function');
  const retain = create!(), project = createWildsResourcePlacementProjector();
  const plant = wildsNourishmentPlantsForTile(3, 3).find(p => p.kind === 'fruit-tree')!;
  const obstacle = wildsTerrainObstaclesForTile(3, 3).find(o => o.id === plant.terrainTreeId)!;
  const source = projectWildsResourceSourceForObstacle(obstacle);
  const projected = { ...plant, valid: true, cropDay: 0, harvested: 0, remaining: plant.capacity, head: 'crop:0', nextRegrowthKaiUPulse: 1, distance: 5, canGather: false };
  const first = retain([{ plant: projected, groundY: plant.position.y, tree: project([obstacle], {}, 0, null).trees[0] }]);
  assert.equal(retain([{ plant: projected, groundY: plant.position.y, tree: project([obstacle], {}, 1_000_000, null).trees[0] }]), first);
  assert.notEqual(retain([{ plant: projected, groundY: plant.position.y, tree: project([obstacle], { [source.sourceId]: { ...initialWildsHarvestedSourceState(source), harvestedCapacity: source.capacity, lastHarvestKaiPulse: '1000000' } }, 1_000_000, null).trees[0] }]), first);
  assert.notEqual(retain([{ ...first[0]!, plant: { ...projected, sourceId: 'another-visible-plant' } }]), first);
});

test('fruit hangs within the actual rendered canopy, rather than the nominal obstacle height', () => {
  let checked = 0;
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    for (const plant of wildsNourishmentPlantsForTile(x, z).filter(p => p.kind === 'fruit-tree')) {
      const obstacle = wildsTerrainObstaclesForTile(x, z).find(o => o.id === plant.terrainTreeId)!;
      const placement = projectWildsObstaclePlacement(obstacle);
      const fruit = projectWildsFruitAttachments(plant, placement, plant.capacity);
      if (Math.hypot(plant.position.x, plant.position.z) < 13.6) { assert.equal(fruit.length, 0); continue; }
      assert.equal(fruit.length, plant.capacity);
      for (const item of fruit) {
        const crown = projectWildsTreePart(placement, item.canopyPart);
        assert.ok(item.position.y < plant.position.y + crown.y + crown.scale[1] * .72);
        assert.ok(item.position.y > plant.position.y + crown.y - crown.scale[1] * .72);
        assert.ok(Math.hypot(item.localX / crown.scale[0], item.localZ / crown.scale[2]) <= .5);
        assert.ok(item.radius <= .09);
      }
      checked++;
    }
  }
  assert.ok(checked > 20);
});

test('depleted trees leave fallen fruit on the ground, and gathered fruit disappears', () => {
  const plant = wildsNourishmentPlantsForTile(3, 3).find(p => p.kind === 'fruit-tree')!;
  assert.ok(plant);
  const obstacle = wildsTerrainObstaclesForTile(3, 3).find(o => o.id === plant.terrainTreeId)!;
  const source = projectWildsResourceSourceForObstacle(obstacle);
  const placement = createWildsResourcePlacementProjector()([obstacle], { [source.sourceId]: {
    ...initialWildsHarvestedSourceState(source), harvestedCapacity: source.capacity, lastHarvestKaiPulse: '1000000'
  } }, 1_000_000, null).trees[0]!;
  const fruit = projectWildsFruitAttachments(plant, placement, 1);
  assert.equal(fruit.length, 1);
  assert.equal(fruit[0]!.fallen, true);
  assert.ok(fruit[0]!.position.y - plant.position.y <= .1);
  assert.equal(projectWildsFruitAttachments(plant, placement, 0).length, 0);
});
