import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyWildsInput, createOwnerBoundInitialPlayState } from '../src/features/play/game-state';
import { KAI_N_DAY_MICRO } from '../src/features/play/kai-klok-moment';
import { wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from '../src/features/play/wilds-nourishment';
import { createWildzRuntimeCheckpointStore } from '../src/features/play/wildz-runtime-checkpoint-store';
import { prepareWildzRuntimeCheckpoint, wildzRuntimeCheckpointKey } from '../src/features/play/wildz-runtime-checkpoint';
import { createWildzContinuityDatabase } from '../src/lib/storage/wildz-indexed-db';
import { createFakeIndexedDb } from './support/fake-indexed-db';

const scope = { keyId: 'checkpoint-key', actorId: 'checkpoint_keeper' }, pulse = Number(KAI_N_DAY_MICRO) * 100;
function fixture() {
  const fake = createFakeIndexedDb(), database = createWildzContinuityDatabase({ factory: fake.factory });
  const values = new Map<string, string>();
  let full = false, writes = 0;
  const storage = { getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => { values.delete(key); },
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
