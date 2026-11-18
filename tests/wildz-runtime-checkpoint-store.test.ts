import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyWildsInput, createOwnerBoundInitialPlayState } from '../src/features/play/game-state';
import { KAI_N_DAY_MICRO } from '../src/features/play/kai-klok-moment';
import { wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from '../src/features/play/wilds-nourishment';
import { createPlayerBreaths, PLAYER_BREATH_CAPACITY_MICRO } from '../src/features/play/player-breath-energy';
import { mergeWildsNativeFoodFuelDisplay, prepareWildsNativeFoodFuelRecovery, recoverWildsNativeAdmittedFoodFuel } from '../src/features/play/wilds-food-fuel-recovery';
import { mergeWildsNativeNourishmentDisplay, wildsNativeFoodIds } from '../src/features/play/wilds-native-inventory-display';
import { replayWildzNativeWorldLaw } from '../src/features/play/wildz-native-world-law';
import { createWildzRuntimeCheckpointStore } from '../src/features/play/wildz-runtime-checkpoint-store';
import { prepareWildzRuntimeCheckpoint, wildzRuntimeCheckpointKey } from '../src/features/play/wildz-runtime-checkpoint';
import { createWildzContinuityDatabase } from '../src/lib/storage/wildz-indexed-db';
import { createFakeIndexedDb } from './support/fake-indexed-db';
import { wildsDiscoverySitesForRegion } from '../src/features/play/wilds-discovery-sites';
import type { WildzContinuityDatabase, WildzContinuityTransaction } from '../src/lib/storage/wildz-indexed-db';
import { normalizeWildsExplorationAtlas, wildsExplorationBounds, wildsExplorationContainsRegion } from '../src/features/play/wilds-exploration-atlas';

const scope = { keyId: 'checkpoint-key', actorId: 'checkpoint_keeper' }, pulse = Number(KAI_N_DAY_MICRO) * 100;
function fixture() {
  const fake = createFakeIndexedDb(), database = createWildzContinuityDatabase({ factory: fake.factory });
  const values = new Map<string, string>();
  let full = false, writes = 0;
  const storage = { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null, getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { writes += 1; if (full) throw new DOMException('full', 'QuotaExceededError'); values.set(key, value); } };
  return { fake, database, values, storage, writes: () => writes, full: () => { full = true; },
    store: () => createWildzRuntimeCheckpointStore({ database, getStorage: () => storage }) };
}
function bodyFixture() {
  const base = createOwnerBoundInitialPlayState(scope.actorId);
  const plant = Array.from({ length: 9 }, (_, x) => Array.from({ length: 9 }, (_, z) => wildsNourishmentPlantsForTile(x - 4, z - 4)).flat()).flat()[0]!;
  const positioned = { ...base, player: { x: plant.position.x, z: plant.position.z }, siteSpace: { ...base.siteSpace, position: plant.position } };
  const gathered = applyWildsInput(positioned, { type: 'gather-food', ownerReceizId: scope.actorId, sourceId: plant.sourceId,
    expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, pulse).head, kaiUPulse: pulse });
  return { base, sleeping: applyWildsInput(gathered, { type: 'sleep', kaiUPulse: pulse + 1_000_000 }) };
}

test('cold startup retains the owner atlas when a same-ledger local checkpoint supplies movement', async () => {
  const f = fixture(), base = createOwnerBoundInitialPlayState(scope.actorId);
  const large = normalizeWildsExplorationAtlas({ version: 1, rows: [
    { z: 100, ranges: [{ minX: -100_000, maxX: -1 }, { minX: 1, maxX: 100_000 }] }
  ] }, base.player);
  const held = { ...base, explorationAtlas: large };
  await f.store().write({ ...scope, playState: { ...base, player: { x: 3, z: 4 } } });
  const reopened = await f.store().read({ ...scope, playState: held });
  assert.deepEqual(reopened.player, { x: 3, z: 4 });
  assert.deepEqual(wildsExplorationBounds(reopened.explorationAtlas), wildsExplorationBounds(large));
  assert.equal(wildsExplorationContainsRegion(reopened.explorationAtlas, 0, 100), false);
  assert.equal(reopened.inventory, held.inventory);
});

test('cold startup combines discoveries retained on either side of a storage quota transition', async () => {
  const f = fixture(), store = f.store(), base = createOwnerBoundInitialPlayState(scope.actorId);
  const withVisit = (x: number) => ({ ...base, explorationAtlas: normalizeWildsExplorationAtlas({
    version: 1, rows: [{ z: 90, ranges: [{ minX: x, maxX: x }] }]
  }, base.player) });
  await store.write({ ...scope, playState: withVisit(100) });
  f.full();
  await store.write({ ...scope, playState: withVisit(200) });
  const reopened = await f.store().read({ ...scope, playState: withVisit(300) });
  for (const x of [100, 200, 300]) assert.equal(wildsExplorationContainsRegion(reopened.explorationAtlas, x, 90), true);
  assert.equal(wildsExplorationContainsRegion(reopened.explorationAtlas, 150, 90), false);
});

test('a durable map stays out of movement serialization and both discoveries and movement survive reopening', async () => {
  const f = fixture(), store = f.store(), base = createOwnerBoundInitialPlayState(scope.actorId);
  const held = { ...base, explorationAtlas: normalizeWildsExplorationAtlas({ version: 1, rows: Array.from({ length: 2000 }, (_, z) => ({ z: z + 100, ranges: [{ minX: 1, maxX: 950 }] })) }, base.player) };
  const owner = { ...scope, restoreEpoch: 1, playState: held };
  await store.retainDurableAtlas(owner);
  const expanded = { ...held, explorationAtlas: normalizeWildsExplorationAtlas({ ...held.explorationAtlas, rows: [...held.explorationAtlas.rows,
    { z: -900, ranges: [{ minX: 500, maxX: 505 }] }] }, held.player) };
  const capture = store.prepare({ ...owner, playState: expanded });
  assert.equal(capture.checkpoint.schema, "receiz.wildz.runtime_movement.v2");
  assert.equal("explorationAtlas" in capture.checkpoint.playState, false);
  await capture.commit(JSON.stringify(capture.checkpoint));
  const moved = { ...expanded, player: { x: 7, z: 8 } };
  const movement = store.prepare({ ...owner, playState: moved });
  assert.equal("explorationAtlas" in movement.checkpoint.playState, false);
  await movement.commit(JSON.stringify(movement.checkpoint));
  const reopened = await f.store().read({ ...owner, durableOwner: true });
  assert.deepEqual(reopened.player, moved.player);
  assert.deepEqual(reopened.explorationAtlas, expanded.explorationAtlas);
  assert.equal(reopened.inventory, held.inventory);
});

test('normal checkpoints retain the existing local cache and exclude Vault card bytes', async () => {
  const f = fixture(), store = f.store(), { base, sleeping } = bodyFixture();
  await store.write({ ...scope, playState: sleeping });
  assert.equal(f.fake.dump('meta').length, 0);
  assert.equal(f.writes(), 1);
  assert.equal(f.values.get(wildzRuntimeCheckpointKey(scope.keyId, scope.actorId))!.includes('"inventory"'), false);
  assert.equal((await store.read({ ...scope, playState: base })).playerBreaths!.mode, 'sleep');
});

test('a full local-storage quota preserves food and sleep across cold reopening without a retry loop', async () => {
  const f = fixture(), store = f.store(), { base, sleeping } = bodyFixture();
  await store.write({ ...scope, playState: base });
  f.full();
  await store.write({ ...scope, playState: sleeping });
  const settled = applyWildsInput(sleeping, { type: 'energy-tick', kaiUPulse: pulse + 2_000_000 });
  await store.write({ ...scope, playState: settled });
  assert.equal(f.writes(), 2, 'Only the first rejected write attempts the full cache');
  const reopened = f.store(), restored = await reopened.read({ ...scope, playState: base });
  assert.deepEqual(restored.playerNourishment, settled.playerNourishment);
  assert.deepEqual(restored.playerBreaths, settled.playerBreaths);
  assert.equal(restored.inventory, base.inventory);
  await reopened.write({ ...scope, playState: restored });
  assert.equal(f.writes(), 2);
});

test('quota fallback preserves accepted native meal pending credit through cold reopening and credits once',async()=>{
 const f=fixture(),base=createOwnerBoundInitialPlayState(scope.actorId);
 const plant=wildsNourishmentPlantsForTile(-4,-4).find(plant=>plant.foodKind==='orchard-fruit')!;
 const gather={kind:'food.gather' as const,actorId:scope.actorId,sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,pulse).head,kaiUPulse:pulse,player:plant.position,spaceId:'wildz.space.outer.v1'};
 const gathered=replayWildzNativeWorldLaw([gather]),item=Object.values(gathered.nourishment[scope.actorId].items)[0]!;
 const accepted=replayWildzNativeWorldLaw([gather,{kind:'food.consume',actorId:scope.actorId,itemId:item.itemId,commandId:`native-eat:${item.itemId}`,kaiUPulse:pulse+1,reserveMicroBreaths:PLAYER_BREATH_CAPACITY_MICRO-7}]);
 const source=prepareWildsNativeFoodFuelRecovery(accepted,scope.actorId),full={...base,playerNourishment:mergeWildsNativeNourishmentDisplay(undefined,gathered.nourishment[scope.actorId])!,playerBreaths:createPlayerBreaths(pulse+1,100),energy:100};
 const pending=mergeWildsNativeFoodFuelDisplay(full,source,scope.actorId,pulse+1,wildsNativeFoodIds(accepted));
 f.full();await f.store().write({...scope,playState:pending});
 const restored=await f.store().read({...scope,playState:base});
 assert.deepEqual(restored.playerNourishment!.nativeItemIds,[item.itemId]);
 assert.deepEqual(restored.playerNourishment!.nativePendingFuelItemIds,[item.itemId]);
 assert.equal(restored.playerBreaths!.restoredMicroBreaths,0);
 const hungry={...restored,playerBreaths:createPlayerBreaths(pulse+2,20),energy:20};
 const credited=recoverWildsNativeAdmittedFoodFuel(hungry,source,scope.actorId,pulse+2);
 assert.equal(credited.playerBreaths!.restoredMicroBreaths,7);
 await f.store().write({...scope,playState:credited});
 const reopened=await f.store().read({...scope,playState:base});
 assert.equal(reopened.playerBreaths!.restoredMicroBreaths,7);
 assert.equal(recoverWildsNativeAdmittedFoodFuel(reopened,source,scope.actorId,pulse+3),reopened);
});

test('an older fallback cannot rewind a newer admitted player ledger or attach to another owner', async () => {
  const f = fixture(), { base, sleeping } = bodyFixture();
  f.full();
  await f.store().write({ ...scope, playState: sleeping });
  const newer = applyWildsInput(sleeping, { type: 'wake', kaiUPulse: pulse + 3_000_000 });
  assert.equal((await f.store().read({ ...scope, playState: newer })).playerBreaths!.mode, 'active');
  const foreign = createOwnerBoundInitialPlayState('another_keeper');
  assert.equal(await f.store().read({ ...scope, actorId: 'another_keeper', playState: foreign }), foreign);
  assert.equal(await f.store().read({ ...scope, keyId: 'another-key', playState: base }), base);
});

test('a copied fallback with foreign inner ownership is rejected by the existing checkpoint verifier', async () => {
  const f = fixture(), { base, sleeping } = bodyFixture();
  const prepared = prepareWildzRuntimeCheckpoint({ ...scope, actorId: 'another_keeper', playState: sleeping });
  await f.database.transaction(['meta'], 'readwrite', tx => tx.put('meta', {
    schema: 'wildz.runtime-checkpoint-fallback.v1', serialized: JSON.stringify(prepared.checkpoint)
  }, wildzRuntimeCheckpointKey(scope.keyId, scope.actorId)));
  assert.equal(await f.store().read({ ...scope, playState: base }), base);
  assert.equal(f.fake.dump('meta').length, 0);
});

test('explicit restore clears an in-flight fallback before subsequent checkpoints can reopen it', async () => {
  const f = fixture(), store = f.store(), { base, sleeping } = bodyFixture();
  f.full();
  const gate = f.fake.gateNextCompletion();
  const writing = store.write({ ...scope, playState: sleeping });
  await gate.completionReached;
  const clearing = store.clear(scope);
  gate.releaseCompletion();
  await Promise.all([writing, clearing]);
  assert.equal(await f.store().read({ ...scope, playState: base }), base);
  assert.equal(f.fake.dump('meta').length, 0);
});

function ownerWithVisit(x: number) {
  const state = createOwnerBoundInitialPlayState(scope.actorId);
  return { ...state, explorationAtlas: normalizeWildsExplorationAtlas({
    version: 1, rows: [{ z: 103, ranges: [{ minX: x, maxX: x }] }],
    siteKeys: [wildsDiscoverySitesForRegion(x, 103)[1]!.key]
  }, state.player) };
}

test('stored movement reads two small coordinates and writes no geographic data for unchanged movement', async () => {
  const f = fixture();
  const reads: string[] = [], writes: string[] = [];
  const database: WildzContinuityDatabase = {
    read: f.database.read,
    transaction: (stores, mode, run) => f.database.transaction(stores, mode, tx => {
      const observed: WildzContinuityTransaction = {
        ...tx,
        get: (store, key) => { reads.push(String(key)); return tx.get(store, key); },
        put: (store, value, key) => { writes.push(String(key)); return tx.put(store, value, key); }
      };
      return run(observed);
    })
  };
  const store = createWildzRuntimeCheckpointStore({ database, getStorage: () => f.storage });
  const owner = { ...scope, restoreEpoch: 1, playState: ownerWithVisit(915) };
  await store.retainDurableAtlas(owner);
  const first = store.prepare(owner);
  await first.commit(JSON.stringify(first.checkpoint));
  reads.length = writes.length = 0;
  const next = store.prepare({ ...owner, playState: { ...owner.playState, player: { x: 2, z: 3 } } });
  await next.commit(JSON.stringify(next.checkpoint));
  const prefix = wildzRuntimeCheckpointKey(scope.keyId, scope.actorId);
  assert.deepEqual(reads, [prefix + ':atlas-generation', prefix + ':movement:head']);
  assert.deepEqual(writes, [prefix + ':movement', prefix + ':movement:head']);
  assert.equal(f.writes(), 0);
});

test('a reset, missing durable owner, and different identity cannot reopen or reuse a superseded compact base', async () => {
  const f = fixture(), active = f.store(), otherTab = f.store();
  const owner = { ...scope, restoreEpoch: 1, playState: ownerWithVisit(55), durableOwner: true };
  await active.retainDurableAtlas(owner);
  const old = active.prepare({ ...owner, playState: { ...owner.playState, player: { x: 5, z: 6 } } });
  assert.ok(!('explorationAtlas' in old.checkpoint.playState));
  const smaller = { ...owner, restoreEpoch: 2, playState: createOwnerBoundInitialPlayState(scope.actorId) };
  assert.equal(await otherTab.read(smaller), smaller.playState);
  await otherTab.retainDurableAtlas(smaller);
  await old.commit(JSON.stringify(old.checkpoint));
  assert.equal(await f.store().read(smaller), smaller.playState);
  assert.equal(await f.store().read({ ...smaller, durableOwner: false }), smaller.playState);
  assert.ok('explorationAtlas' in active.prepare({ ...owner, restoreEpoch: 2 }).checkpoint.playState);
  assert.ok('explorationAtlas' in active.prepare({ ...owner, actorId: 'other_keeper' }).checkpoint.playState);
  active.release(scope);
  assert.ok('explorationAtlas' in active.prepare(owner).checkpoint.playState);
});

test('late serialization cannot replace newer movement and concurrent tabs retain disjoint territory and sites', async () => {
  const f = fixture(), tab = f.store(), another = f.store();
  const owner = { ...scope, restoreEpoch: 1, playState: createOwnerBoundInitialPlayState(scope.actorId), durableOwner: true };
  await tab.retainDurableAtlas(owner);
  await another.retainDurableAtlas(owner);
  const late = tab.prepare({ ...owner, playState: { ...owner.playState, player: { x: 1, z: 1 } } });
  const first = tab.prepare({ ...owner, playState: { ...ownerWithVisit(70), player: { x: 4, z: 2 } } });
  await first.commit(JSON.stringify(first.checkpoint));
  const second = another.prepare({ ...owner, playState: { ...ownerWithVisit(80), player: { x: 5, z: 2 } } });
  await second.commit(JSON.stringify(second.checkpoint));
  await late.commit(JSON.stringify(late.checkpoint));
  const restored = await f.store().read(owner);
  assert.deepEqual(restored.player, { x: 5, z: 2 });
  for (const x of [70, 80]) {
    assert.ok(wildsExplorationContainsRegion(restored.explorationAtlas, x, 103));
    assert.ok(restored.explorationAtlas.siteKeys.includes(wildsDiscoverySitesForRegion(x, 103)[1]!.key));
  }
  assert.ok(!wildsExplorationContainsRegion(restored.explorationAtlas, 75, 103));
});

test('pagehide retains its synchronous exit on aborted IDB and a cold restore clears every owner exit', async () => {
  const f = fixture(), store = f.store();
  const owner = { ...scope, restoreEpoch: 1, playState: createOwnerBoundInitialPlayState(scope.actorId), durableOwner: true };
  await store.retainDurableAtlas(owner);
  const moved = { ...ownerWithVisit(77), player: { x: 8, z: 2 } };
  f.fake.failNextRequest();
  const writing = store.write({ ...owner, playState: moved });
  assert.equal(f.values.size, 1, 'the synchronous exit is already present before the IDB promise runs');
  const exit = JSON.parse([...f.values.values()][0]!);
  assert.deepEqual(exit.delta.rows, [{ z: 103, ranges: [{ minX: 77, maxX: 77 }] }]);
  assert.equal('explorationAtlas' in JSON.parse(exit.serialized).playState, false);
  await writing;
  assert.equal(f.fake.abortedTransactions, 1);
  const restored = await f.store().read(owner);
  assert.deepEqual(restored.player, moved.player);
  assert.deepEqual(restored.explorationAtlas, moved.explorationAtlas);
  await f.store().clear(scope);
  assert.equal(f.values.size, 0);
  assert.equal(f.fake.dump('meta').length, 0);
});

test('a failed foreground transaction is superseded by pagehide and local storage denial still allows IDB recovery', async () => {
  const f = fixture(), tab = f.store();
  const owner = { ...scope, restoreEpoch: 1, playState: createOwnerBoundInitialPlayState(scope.actorId), durableOwner: true };
  await tab.retainDurableAtlas(owner);
  const earlier = tab.prepare({ ...owner, playState: { ...owner.playState, player: { x: 1, z: 2 } } });
  const gate = f.fake.gateNextAbort();
  f.fake.failNextRequest();
  const foreground = earlier.commit(JSON.stringify(earlier.checkpoint));
  await gate.transactionError;
  f.full();
  const moved = { ...ownerWithVisit(303), player: { x: 7, z: 8 } };
  const hide = tab.write({ ...owner, playState: moved });
  gate.releaseAbort();
  await Promise.all([foreground, hide]);
  const denied = createWildzRuntimeCheckpointStore({ database: f.database,
    getStorage() { throw new DOMException('unavailable', 'SecurityError'); } });
  const restored = await denied.read(owner);
  assert.deepEqual(restored.player, moved.player);
  assert.deepEqual(restored.explorationAtlas, moved.explorationAtlas);
});

test('a newer owner ledger keeps its movement and absorbs independent territory and visits from an older v1', async () => {
  const f = fixture(), { sleeping } = bodyFixture();
  const earlier = ownerWithVisit(905);
  await f.store().write({ ...scope, playState: { ...earlier, player: { x: 7, z: 8 } } });
  const reopened = await f.store().read({ ...scope, playState: sleeping });
  assert.deepEqual(reopened.player, sleeping.player);
  assert.equal(reopened.playerBreaths, sleeping.playerBreaths);
  assert.ok(wildsExplorationContainsRegion(reopened.explorationAtlas, 905, 103));
  assert.ok(reopened.explorationAtlas.siteKeys.includes(earlier.explorationAtlas.siteKeys[0]!));
});

test('the first completed covering movement retires only the interrupted exits this process read', async () => {
  const f = fixture(), original = f.store(), reopened = f.store();
  const owner = { ...scope, restoreEpoch: 1, playState: createOwnerBoundInitialPlayState(scope.actorId), durableOwner: true };
  await original.retainDurableAtlas(owner);
  f.fake.failNextRequest();
  await original.write({ ...owner, playState: ownerWithVisit(55) });
  const [firstExit] = f.values.keys();
  const recovered = await reopened.read(owner);
  assert.ok(wildsExplorationContainsRegion(recovered.explorationAtlas, 55, 103));

  // Original tab writes again after the reopener took its snapshot. Its newer
  // disjoint discoveries survive when the reopener commits the first snapshot.
  f.fake.failNextRequest();
  await original.write({ ...owner, playState: ownerWithVisit(66) });
  const otherExit = [...f.values.keys()].find(key => key !== firstExit)!;
  assert.ok(otherExit);
  const next = reopened.prepare({ ...owner, playState: recovered });
  await next.commit(JSON.stringify(next.checkpoint));
  assert.ok(!f.values.has(firstExit!));
  assert.ok(f.values.has(otherExit));
  const lastTab = f.store();
  const merged = await lastTab.read(owner);
  for (const x of [55, 66]) assert.ok(wildsExplorationContainsRegion(merged.explorationAtlas, x, 103));
  const last = lastTab.prepare({ ...owner, playState: merged });
  await last.commit(JSON.stringify(last.checkpoint));
  assert.equal(f.values.size, 0);
  assert.deepEqual((await f.store().read(owner)).explorationAtlas, merged.explorationAtlas);
});

test('a v1 explicit restore with the identical owner map and ledger fences an old compact coordinate', async () => {
  const f = fixture(), before = f.store();
  const owner = { ...scope, restoreEpoch: 0, playState: ownerWithVisit(100), durableOwner: true };
  await before.retainDurableAtlas(owner);
  const next = before.prepare({ ...owner, playState: { ...owner.playState, player: { x: 7, z: 1 } } });
  await next.commit(JSON.stringify(next.checkpoint));
  assert.deepEqual((await f.store().read(owner)).player, { x: 7, z: 1 });

  // This is the exact pair of removals used by the released v1 restore.
  const key = wildzRuntimeCheckpointKey(scope.keyId, scope.actorId);
  f.storage.removeItem(key);
  await f.database.transaction(['meta'], 'readwrite', tx => tx.delete('meta', key));
  const fresh = f.store();
  assert.equal(await fresh.read(owner), owner.playState);
  assert.ok('explorationAtlas' in fresh.prepare(owner).checkpoint.playState);
  await fresh.retainDurableAtlas(owner);
  assert.ok(!('explorationAtlas' in fresh.prepare(owner).checkpoint.playState));
});

test('compact baseline installation preserves a complete v1 fallback with its later movement and unique sites', async () => {
  const f = fixture(), { sleeping } = bodyFixture(), { explorationAtlas } = ownerWithVisit(801);
  const existing = { ...sleeping, explorationAtlas };
  f.full();
  await f.store().write({ ...scope, playState: existing });
  const key = wildzRuntimeCheckpointKey(scope.keyId, scope.actorId);
  const old = await f.database.read<{ serialized: string }>('meta', key);
  const tab = f.store(), owner = { ...scope, restoreEpoch: 0, playState: ownerWithVisit(101), durableOwner: true };
  await tab.retainDurableAtlas(owner);
  const movement = tab.prepare(owner);
  await movement.commit(JSON.stringify(movement.checkpoint));
  assert.equal((await f.database.read<{ serialized: string }>('meta', key))?.serialized, old?.serialized);
  const recovered = await f.store().read(owner);
  assert.deepEqual(recovered.player, existing.player);
  assert.deepEqual(recovered.playerBreaths, existing.playerBreaths);
  for (const x of [101, 801]) {
    assert.ok(wildsExplorationContainsRegion(recovered.explorationAtlas, x, 103));
    assert.ok(recovered.explorationAtlas.siteKeys.includes(wildsDiscoverySitesForRegion(x, 103)[1]!.key));
  }
});

test('a cold read during an unfinished geography transaction observes a complete old or complete new checkpoint', async () => {
  const f = fixture(), tab = f.store();
  const owner = { ...scope, restoreEpoch: 1, playState: createOwnerBoundInitialPlayState(scope.actorId), durableOwner: true };
  await tab.retainDurableAtlas(owner);
  const first = tab.prepare(owner);
  await first.commit(JSON.stringify(first.checkpoint));
  const gate = f.fake.gateNextCompletion();
  const moved = { ...ownerWithVisit(803), player: { x: 4, z: 5 } };
  const next = tab.prepare({ ...owner, playState: moved });
  const publishing = next.commit(JSON.stringify(next.checkpoint));
  await gate.completionReached;
  const before = await f.store().read(owner);
  assert.deepEqual(before.player, owner.playState.player);
  assert.ok(!wildsExplorationContainsRegion(before.explorationAtlas, 803, 103));
  gate.releaseCompletion();
  await publishing;
  const after = await f.store().read(owner);
  assert.deepEqual(after.player, moved.player);
  assert.deepEqual(after.explorationAtlas, moved.explorationAtlas);
});
