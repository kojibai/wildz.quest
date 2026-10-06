import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KAI_N_DAY_MICRO } from '../src/features/play/kai-klok-moment';
import { wildsTerrainObstaclesForTile } from '../src/features/play/wilds-terrain-obstacles';
import { createPlayerBreaths, PLAYER_BREATH_CAPACITY_MICRO } from '../src/features/play/player-breath-energy';
import { applyWildsInput, initialPlayState, restorePlayState, serializePlayState, type PlayState } from '../src/features/play/game-state';
import {
  createWildsNourishmentState,
  gatherWildsNourishment,
  projectWildsNourishmentPlants,
  wildsNourishmentPlantById,
  wildsNourishmentPlantsForTile,
  wildsNourishmentSourceAt,
  type WildsNourishmentPlant
} from '../src/features/play/wilds-nourishment';

const DAY = Number(KAI_N_DAY_MICRO), BASE = DAY * 100, OWNER = 'wilds.player.receiz.id';
function plantFixture(): WildsNourishmentPlant {
  for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
    const plant = wildsNourishmentPlantsForTile(x, z).find(candidate => candidate.kind === 'fruit-tree');
    if (plant) return plant;
  }
  throw Error('Expected a canonical fruit tree in the explored test neighborhood');
}
function gather(state = createWildsNourishmentState(OWNER), plant = plantFixture(), kaiUPulse = BASE, head = wildsNourishmentSourceAt(plant, state.sources[plant.sourceId], kaiUPulse).head) {
  return gatherWildsNourishment({ state, ownerReceizId: OWNER, sourceId: plant.sourceId, expectedSourceHead: head, kaiUPulse,
    player: plant.position, spaceId: 'wildz.space.outer.v1' });
}
function playFixture(plant = plantFixture()): PlayState {
  return { ...initialPlayState, player: { x: plant.position.x, z: plant.position.z },
    siteSpace: { ...initialPlayState.siteSpace, position: plant.position },
    energy: 20, playerBreaths: { ...createPlayerBreaths(BASE, 20), strainMicroPercent: 40_000_000, fatigueMicroPercent: 30_000_000 },
    playerNourishment: createWildsNourishmentState(OWNER) };
}

test('fruit gathering uses the exact canonical terrain tree rather than a caller supplied plant', () => {
  const plant = plantFixture(), tile = plant.sourceId.match(/:(-?\d+):(-?\d+):/)!;
  const tree = wildsTerrainObstaclesForTile(Number(tile[1]), Number(tile[2])).find(obstacle => obstacle.id === plant.terrainTreeId);
  assert.deepEqual(plant.position, tree?.position);
  assert.deepEqual(wildsNourishmentPlantById(plant.sourceId), plant);
  assert.equal(wildsNourishmentPlantById(`${plant.sourceId}:forged`), null);
  assert.ok(wildsNourishmentPlantsForTile(Number(tile[1]), Number(tile[2])).some(candidate => candidate.kind !== 'fruit-tree'));
});

test('a crop is finite and replaying its prior source head never creates another item', () => {
  const plant = plantFixture(), state = createWildsNourishmentState(OWNER), head = wildsNourishmentSourceAt(plant, undefined, BASE).head;
  const first = gather(state, plant, BASE, head);
  assert.equal(first.ok, true);
  assert.equal(Object.keys(first.state.items).length, 1);
  const replay = gather(first.state, plant, BASE, head);
  assert.equal(replay.ok, false);
  assert.equal(replay.reason, 'stale-source');
  assert.equal(replay.state, first.state);
  let depleted = first.state;
  for (let count = 1; count < plant.capacity; count++) depleted = gather(depleted, plant).state;
  assert.equal(Object.keys(depleted.items).length, plant.capacity);
  assert.equal(wildsNourishmentSourceAt(plant, depleted.sources[plant.sourceId], BASE).remaining, 0);
  assert.equal(gather(depleted, plant).reason, 'depleted');
});

test('gathering rejects distance, vertical separation, interiors, owner changes, and regressed time', () => {
  const plant = plantFixture(), first = gather(), state = first.state, head = wildsNourishmentSourceAt(plant, state.sources[plant.sourceId], BASE).head;
  const request = { state, ownerReceizId: OWNER, sourceId: plant.sourceId, expectedSourceHead: head, kaiUPulse: BASE, player: plant.position, spaceId: 'wildz.space.outer.v1' };
  for (const alteration of [
    { player: { ...plant.position, x: plant.position.x + 10 } },
    { player: { ...plant.position, y: plant.position.y + 10 } },
    { spaceId: 'wildz.space.interior.v1' },
    { ownerReceizId: 'another-player' },
    { kaiUPulse: BASE - 1 }
  ]) {
    const rejected = gatherWildsNourishment({ ...request, ...alteration });
    assert.equal(rejected.ok, false, JSON.stringify(alteration));
    assert.equal(rejected.state, state);
  }
});

test('a regrown crop has one finite new yield and an old day head cannot harvest it', () => {
  const plant = plantFixture(); let state = createWildsNourishmentState(OWNER);
  const oldHead = wildsNourishmentSourceAt(plant, undefined, BASE).head;
  for (let count = 0; count < plant.capacity; count++) state = gather(state, plant).state;
  const future = BASE + DAY * plant.regrowthDays * 1000;
  const crop = wildsNourishmentSourceAt(plant, state.sources[plant.sourceId], future);
  assert.equal(crop.remaining, plant.capacity);
  assert.equal(gather(state, plant, future, oldHead).reason, 'stale-source');
  const regrown = gather(state, plant, future, crop.head);
  assert.equal(regrown.ok, true);
  assert.equal(Object.keys(regrown.state.items).length, plant.capacity + 1);
  assert.equal(wildsNourishmentSourceAt(plant, regrown.state.sources[plant.sourceId], future).remaining, plant.capacity - 1);
});

test('a shared source map controls depletion independently of an owner local inventory', () => {
  const plant = plantFixture(); let world = createWildsNourishmentState(OWNER);
  for (let count = 0; count < plant.capacity; count++) world = gather(world, plant).state;
  const personal = createWildsNourishmentState('second-owner');
  const crop = wildsNourishmentSourceAt(plant, world.sources[plant.sourceId], BASE);
  const denied = gatherWildsNourishment({ state: personal, ownerReceizId: 'second-owner', sourceId: plant.sourceId,
    expectedSourceHead: crop.head, kaiUPulse: BASE, player: plant.position, spaceId: 'wildz.space.outer.v1', sourceStates: world.sources });
  assert.equal(denied.reason, 'depleted');
  assert.equal(Object.keys(denied.state.items).length, 0);
  assert.equal(projectWildsNourishmentPlants({ player: plant.position, radius: 3, kaiUPulse: BASE, sourceStates: world.sources }).find(value => value.sourceId === plant.sourceId)?.canGather, false);
});

test('eating consumes its exact item once and restores only finite fuel', () => {
  const plant = plantFixture(), start = playFixture(plant), head = wildsNourishmentSourceAt(plant, undefined, BASE).head;
  const gathered = applyWildsInput(start, { type: 'gather-food', ownerReceizId: OWNER, sourceId: plant.sourceId, expectedSourceHead: head, kaiUPulse: BASE });
  const item = Object.values(gathered.playerNourishment!.items)[0]!;
  const eaten = applyWildsInput(gathered, { type: 'eat-food', ownerReceizId: OWNER, itemId: item.itemId, kaiUPulse: BASE });
  assert.ok(eaten.playerBreaths!.reserveMicroBreaths > gathered.playerBreaths!.reserveMicroBreaths);
  assert.equal(eaten.playerNourishment!.items[item.itemId].consumedKaiUPulse, BASE);
  if (eaten.playerBreaths?.schema !== 'wildz.player-breaths.v2' || gathered.playerBreaths?.schema !== 'wildz.player-breaths.v2') throw Error('Expected body checkpoints');
  assert.equal(eaten.playerBreaths.strainMicroPercent, gathered.playerBreaths.strainMicroPercent);
  assert.equal(eaten.playerBreaths.fatigueMicroPercent, gathered.playerBreaths.fatigueMicroPercent);
  assert.equal(applyWildsInput(eaten, { type: 'eat-food', ownerReceizId: OWNER, itemId: item.itemId, kaiUPulse: BASE }), eaten);
  assert.equal(applyWildsInput(gathered, { type: 'eat-food', ownerReceizId: 'another-owner', itemId: item.itemId, kaiUPulse: BASE }), gathered);
  const full = { ...gathered, energy: 100, playerBreaths: createPlayerBreaths(BASE, 100) };
  const fullEaten = applyWildsInput(full, { type: 'eat-food', ownerReceizId: OWNER, itemId: item.itemId, kaiUPulse: BASE });
  assert.equal(fullEaten.playerBreaths!.reserveMicroBreaths, PLAYER_BREATH_CAPACITY_MICRO);
  assert.equal(fullEaten, full);
  assert.equal(fullEaten.playerNourishment!.items[item.itemId].consumedKaiUPulse, undefined);
});

test('restoration preserves owner food and consumed receipts while dropping malformed or foreign items', () => {
  const plant = plantFixture(), start = playFixture(plant), head = wildsNourishmentSourceAt(plant, undefined, BASE).head;
  const gathered = applyWildsInput(start, { type: 'gather-food', ownerReceizId: OWNER, sourceId: plant.sourceId, expectedSourceHead: head, kaiUPulse: BASE });
  const item = Object.values(gathered.playerNourishment!.items)[0]!;
  const eaten = applyWildsInput(gathered, { type: 'eat-food', ownerReceizId: OWNER, itemId: item.itemId, kaiUPulse: BASE });
  const restored = restorePlayState(serializePlayState(eaten), OWNER);
  assert.deepEqual(restored.playerNourishment, eaten.playerNourishment);
  assert.equal(applyWildsInput(restored, { type: 'eat-food', ownerReceizId: OWNER, itemId: item.itemId, kaiUPulse: BASE }), restored);
  assert.equal(restorePlayState(serializePlayState(eaten), 'another-owner').playerNourishment, undefined);
  assert.equal(restorePlayState(serializePlayState(eaten)).playerNourishment, undefined);
  const forged = JSON.parse(serializePlayState(gathered));
  forged.state.playerNourishment.items[item.itemId].ownerReceizId = 'another-owner';
  forged.state.playerNourishment.items.fake = { ...item, itemId: 'fake' };
  const rejected = restorePlayState(JSON.stringify(forged), OWNER);
  assert.deepEqual(rejected.playerNourishment?.items, {});
  assert.equal(applyWildsInput(rejected, { type: 'eat-food', ownerReceizId: OWNER, itemId: item.itemId, kaiUPulse: BASE }), rejected);
});

test('full fuel preserves food and digestion prevents repeated eating beyond its bounded window', () => {
  const plants = Array.from({ length: 9 }, (_, i) => wildsNourishmentPlantsForTile(i - 4, -4)).flat().filter(p => p.kind === 'fruit-tree');
  assert.ok(plants.length >= 2);
  let state = createWildsNourishmentState(OWNER);
  for (const plant of plants.slice(0, 2)) for (let slot = 0; slot < plant.capacity; slot++) state = gather(state, plant).state;
  let play: PlayState = { ...playFixture(), playerNourishment: state, playerBreaths: createPlayerBreaths(BASE, 20) };
  const items = Object.values(state.items);
  for (const item of items.slice(0, 4)) play = applyWildsInput(play, { type: 'eat-food', ownerReceizId: OWNER, itemId: item.itemId, kaiUPulse: BASE });
  const blocked = applyWildsInput(play, { type: 'eat-food', ownerReceizId: OWNER, itemId: items[4]!.itemId, kaiUPulse: BASE });
  assert.equal(blocked, play);
  assert.equal(blocked.playerNourishment!.items[items[4]!.itemId].consumedKaiUPulse, undefined);
  const digested = applyWildsInput(play, { type: 'eat-food', ownerReceizId: OWNER, itemId: items[4]!.itemId, kaiUPulse: BASE + 120_000_001 });
  assert.ok(digested.playerNourishment!.items[items[4]!.itemId].consumedKaiUPulse);
});
