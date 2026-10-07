import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, createOwnerBoundInitialPlayState, type PlayState } from "../src/features/play/game-state";
import { admitLocallySealedWildsInventory } from "../src/features/play/admitted-inventory";
import { sealCollectedCard, wildsCardVerificationDiagnostics } from "../src/features/play/portable-card";
import { createWildzDurableSaveProcessor, type WildzDurableSaveInput, type WildzDurableSaveMessage, type WildzDurableSaveReply } from "../src/lib/performance/wildz-durable-save-projection";
import { createWildzDurablePlayStateSaver } from "../src/lib/performance/wildz-durable-save";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { loadWildzRestoredOwnerState } from "../src/features/identity/wildz-restore";
import { createWildsNourishmentState, gatherWildsNourishment, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment";
import type { WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";

const session: WildzIdentitySession = { schema: "receiz.wildz.identity_session.v1", keyId: "worker-save-key", actorId: "worker_saver", username: "worker_saver", displayName: "Worker Saver", portableStateStatus: "verified", localAuthority: "verified", remoteStatus: "offline" };
const initial = () => createOwnerBoundInitialPlayState(session.actorId);
function fakeWorker() {
  const messages: WildzDurableSaveMessage[] = [];
  let terminated = false;
  const worker = {
    onmessage: null as ((event: MessageEvent<WildzDurableSaveReply>) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    onmessageerror: null as ((event: MessageEvent) => void) | null,
    postMessage(message: WildzDurableSaveMessage) { messages.push(structuredClone(message)); },
    terminate() { terminated = true; }
  };
  return { worker, messages, terminated: () => terminated, reply: (reply: WildzDurableSaveReply) => worker.onmessage?.({ data: structuredClone(reply) } as MessageEvent<WildzDurableSaveReply>) };
}
const message = (id: string, state: PlayState): WildzDurableSaveMessage => ({ id, input: { session, playState: state }, inventoryVersion: id });

test("durable save worker waits for the exact commit and reuses immutable cards after finite food consumption", async () => {
  const database = createMemoryWildzContinuityDatabase(), process = createWildzDurableSaveProcessor(database), fake = fakeWorker();
  let id = 0, fallbackCount = 0;
  const saver = createWildzDurablePlayStateSaver({ createWorker: () => fake.worker, createId: () => `save:${++id}` });
  const fallback = async () => { fallbackCount++; return initial(); };
  const plant = wildsNourishmentPlantsForTile(3, 3)[0]!;
  const gathered = gatherWildsNourishment({ state: createWildsNourishmentState(session.actorId), ownerReceizId: session.actorId, sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, 100).head, kaiUPulse: 100, player: plant.position, spaceId: "wildz.space.outer.v1" });
  assert.ok(gathered.ok); if (!gathered.ok) return;
  const full = { ...initial(), playerNourishment: gathered.state, energy: 50 };
  let completed = false;
  const first = saver.save({ session, playState: full }, fallback).then(value => { completed = true; return value; });
  await Promise.resolve(); assert.equal(completed, false); assert.equal(fake.messages.length, 1);
  await assert.rejects(saver.save({ session, playState: full }, fallback), /save_busy/);
  const firstReply = await process(fake.messages[0]!);
  assert.equal(completed, false); fake.reply(firstReply);
  assert.equal((await first).inventory, full.inventory);
  const eaten = applyWildsInput(full, { type: "eat-food", ownerReceizId: session.actorId, itemId: gathered.item.itemId, kaiUPulse: 101 });
  const before = wildsCardVerificationDiagnostics().executions;
  const second = saver.save({ session, playState: eaten }, fallback);
  const secondMessage = fake.messages[1]!;
  assert.equal(secondMessage.reuseInventory, true);
  assert.deepEqual(secondMessage.input.playState.inventory, []);
  const secondReply = await process(secondMessage);
  assert.equal(secondReply.includesInventory, false); fake.reply(secondReply);
  const saved = await second;
  assert.equal(saved.inventory, eaten.inventory);
  assert.equal(wildsCardVerificationDiagnostics().executions, before);
  assert.equal(fallbackCount, 0);
  const stale = saver.save({ session, playState: full }, fallback);
  fake.reply(await process(fake.messages[2]!));
  assert.equal((await stale).playerNourishment?.items[gathered.item.itemId]?.consumedKaiUPulse, 101);
  const restored = await loadWildzRestoredOwnerState({ database, session });
  assert.equal(restored?.playState.playerNourishment?.items[gathered.item.itemId]?.consumedKaiUPulse, 101);
  assert.deepEqual(restored?.playState.actionHistory, saved.actionHistory);
  saver.close();
});

test("worker inventory deltas verify new proof bodies and reject cache version changes or forged reuse bodies", async () => {
  const database = createMemoryWildzContinuityDatabase(), process = createWildzDurableSaveProcessor(database);
  const state = initial();
  await process(structuredClone(message("v1", state)));
  const second = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: session.actorId, encounterId: "worker:added", capturedAt: "2026-10-07T00:00:00.000Z" });
  const changed = { ...state, inventory: admitLocallySealedWildsInventory([...state.inventory, second]) };
  const delta: WildzDurableSaveMessage = { ...message("v2", { ...changed, inventory: [] }), baseInventoryVersion: "v1", inventoryDelta: { length: 2, changes: [{ index: 1, card: second }] } };
  const admitted = await process(structuredClone(delta));
  assert.equal(admitted.inventoryPins.length, 2);
  const before = database.dump();
  const reuse = { ...message("v3", { ...changed, inventory: [] }), baseInventoryVersion: "v2", reuseInventory: true };
  await assert.rejects(process({ ...reuse, baseInventoryVersion: "old-version" }), /version_invalid/);
  await assert.rejects(process({ ...reuse, input: { session: { ...session, keyId: "another-owner-key" }, playState: reuse.input.playState } }), /version_invalid/);
  await assert.rejects(process({ ...reuse, input: { session, playState: structuredClone(changed) } }), /version_invalid/);
  const forged = structuredClone(second); forged.manifest.name = "Forged reused body";
  await assert.rejects(process({ ...message("bad", { ...changed, inventory: [] }), baseInventoryVersion: "v2", inventoryDelta: { length: 2, changes: [{ index: 1, card: forged }] } }), /delta_invalid/);
  assert.deepEqual(database.dump(), before);
  const valid = await process(reuse); assert.equal(valid.inventoryVersion, "v3");
});

test("main save transport sends a versioned changed-card delta after commit and never substitutes unadmitted matching pins", async () => {
  const fake = fakeWorker(), database = createMemoryWildzContinuityDatabase(), process = createWildzDurableSaveProcessor(database);
  let id = 0;
  const saver = createWildzDurablePlayStateSaver({ createWorker: () => fake.worker, createId: () => `save:${++id}` });
  const state = initial(), fallback = async () => state;
  const first = saver.save({ session, playState: state }, fallback); fake.reply(await process(fake.messages[0]!)); await first;
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: session.actorId, encounterId: "worker:delta", capturedAt: "2026-10-07T00:00:00.000Z" });
  const next = { ...state, inventory: admitLocallySealedWildsInventory([...state.inventory, card]) };
  const second = saver.save({ session, playState: next }, fallback);
  assert.deepEqual(fake.messages[1]?.inventoryDelta?.changes.map(change => change.index), [1]);
  assert.equal(fake.messages[1]?.baseInventoryVersion, "save:1");
  fake.reply(await process(fake.messages[1]!)); assert.equal((await second).inventory, next.inventory);
  const unknown = structuredClone(next), third = saver.save({ session, playState: unknown }, fallback);
  assert.equal(fake.messages[2]?.reuseInventory, undefined); assert.equal(fake.messages[2]?.returnInventory, true);
  fake.reply(await process(fake.messages[2]!)); assert.notEqual((await third).inventory, unknown.inventory);
  saver.close();
});

test("post-submit worker failures reject an unknown commit without duplicating the durable write", async () => {
  const fake = fakeWorker(), state = initial();
  let fallbacks = 0;
  const saver = createWildzDurablePlayStateSaver({ createWorker: () => fake.worker, createId: () => "submitted" });
  const saving = saver.save({ session, playState: state }, async () => { fallbacks++; return state; });
  fake.worker.onerror?.({ preventDefault() {} } as ErrorEvent);
  await assert.rejects(saving, /outcome_unknown/);
  assert.equal(fallbacks, 0); assert.equal(fake.terminated(), true);
  saver.close();
});

test("worker startup or rejected dispatch uses the existing saver once before any worker commit", async () => {
  const state = initial(); let fallbacks = 0;
  const fallback = async () => { fallbacks++; return state; };
  const absent = createWildzDurablePlayStateSaver({ createWorker: () => { throw Error("worker unavailable"); } });
  assert.equal(await absent.save({ session, playState: state }, fallback), state); assert.equal(fallbacks, 1);
  const fake = fakeWorker(); fake.worker.postMessage = () => { throw new DOMException("cannot clone", "DataCloneError"); };
  const rejected = createWildzDurablePlayStateSaver({ createWorker: () => fake.worker });
  assert.equal(await rejected.save({ session, playState: state }, fallback), state); assert.equal(fallbacks, 2); assert.equal(fake.messages.length, 0);
});

test("a platform without worker IndexedDB falls back only after an explicit no-write response", async () => {
  const fake = fakeWorker(), state = initial(); let writes = 0;
  const saver = createWildzDurablePlayStateSaver({ createWorker: () => fake.worker, createId: () => "storage-check" });
  const saving = saver.save({ session, playState: state }, async () => { writes++; return state; });
  fake.reply({ id: "storage-check", ok: false, error: "wildz_durable_save_worker_storage_unavailable", fallbackSafe: true });
  assert.equal(await saving, state); assert.equal(writes, 1); assert.equal(fake.terminated(), true);
});
