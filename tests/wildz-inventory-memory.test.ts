import assert from "node:assert/strict";
import test from "node:test";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { admittedInventoryDiagnostics } from "../src/features/play/admitted-inventory";
import { createStoredWildzPlayState, loadWildzRestoredOwnerState } from "../src/features/identity/wildz-restore";
import { wildzOwnerScope, type WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { retainWildzInventoryMemory, restoreWildzInventoryMemory, wildzInventoryMemoryKey } from "../src/features/identity/wildz-inventory-memory";

const session: WildzIdentitySession = { schema: "receiz.wildz.identity_session.v1", keyId: "memory-test-key",
  actorId: "memory_keeper", username: "memory_keeper", displayName: "Keeper", portableStateStatus: "verified",
  localAuthority: "verified", remoteStatus: "offline", createdAt: "2026-08-11T12:00:00.000Z" };

async function fixture() {
  const database = createMemoryWildzContinuityDatabase();
  const record = structuredClone(createStoredWildzPlayState(session, createOwnerBoundInitialPlayState(session.actorId, session.createdAt)));
  const scope = wildzOwnerScope(session.keyId, session.actorId);
  await database.transaction(["ownerStates"], "readwrite", tx => tx.put("ownerStates", record, scope));
  return { database, record, scope };
}

test("cold reopening retains the previously verified inventory head without replaying card proofs", async () => {
  const { database, record } = await fixture();
  const first = await loadWildzRestoredOwnerState({ database, session });
  assert.ok(first);
  const before = admittedInventoryDiagnostics().verifierCalls;
  const reopened = await loadWildzRestoredOwnerState({ database, session });
  assert.ok(reopened);
  assert.notEqual(reopened.playState.inventory[0], first.playState.inventory[0], "storage returns fresh objects");
  assert.equal(reopened.playState.inventory[0]!.proof.digest, record.playState.inventory[0]!.proof.digest);
  assert.deepEqual(reopened.playState.player, record.playState.player);
  assert.equal(admittedInventoryDiagnostics().verifierCalls, before, "the authenticated memory head replaces full history replay");
});

test("changed proof bytes under the same claimed head cannot reuse memory", async () => {
  const { database, record, scope } = await fixture();
  await loadWildzRestoredOwnerState({ database, session });
  record.playState.inventory[0]!.manifest.name = "forged unchanged head";
  await database.transaction(["ownerStates"], "readwrite", tx => tx.put("ownerStates", record, scope));
  const before = admittedInventoryDiagnostics().verifierCalls;
  const restored = await loadWildzRestoredOwnerState({ database, session });
  assert.ok(restored);
  assert.ok(admittedInventoryDiagnostics().verifierCalls > before, "changed bytes take canonical admission");
  assert.ok(restored.playState.inventory.every(card => card.manifest.name !== "forged unchanged head"));
});

test("memory is authenticated and bound to the exact owner, device and ordered inventory", async () => {
  const { database, record } = await fixture();
  await loadWildzRestoredOwnerState({ database, session });
  const memory = await database.read<Record<string, unknown>>("meta", wildzInventoryMemoryKey(session));
  assert.ok(memory);
  const other = { ...session, actorId: "another_keeper" };
  await database.transaction(["meta"], "readwrite", tx => tx.put("meta", { ...memory, actorId: other.actorId }, wildzInventoryMemoryKey(other)));
  assert.equal(await restoreWildzInventoryMemory(database, other, structuredClone(record.playState.inventory)), null);
  const otherDevice = createMemoryWildzContinuityDatabase();
  await otherDevice.transaction(["meta"], "readwrite", tx => tx.put("meta", memory, wildzInventoryMemoryKey(session)));
  assert.equal(await restoreWildzInventoryMemory(otherDevice, session, structuredClone(record.playState.inventory)), null);
  await database.transaction(["meta"], "readwrite", tx => tx.put("meta", { ...memory, digest: "0".repeat(64), verified: true }, wildzInventoryMemoryKey(session)));
  assert.equal(await restoreWildzInventoryMemory(database, session, structuredClone(record.playState.inventory)), null);
});

test("unadmitted uploads cannot create a memory and missing keys preserve the full proof fallback", async () => {
  const { database, record } = await fixture();
  await assert.rejects(retainWildzInventoryMemory(database, session, record.playState.inventory), /unadmitted/);
  await loadWildzRestoredOwnerState({ database, session });
  const keys = database.dump().wrappingKeys;
  await database.transaction(["wrappingKeys"], "readwrite", async tx => { for (const [key] of keys) await tx.delete("wrappingKeys", key); });
  const before = admittedInventoryDiagnostics().verifierCalls;
  const restored = await loadWildzRestoredOwnerState({ database, session });
  assert.ok(restored);
  assert.ok(admittedInventoryDiagnostics().verifierCalls > before);
  assert.equal(restored.playState.inventory[0]!.proof.digest, record.playState.inventory[0]!.proof.digest);
  assert.ok(await database.read("ownerStates", wildzOwnerScope(session.keyId, session.actorId)), "the durable source is preserved");
});

test("memory checks freeze all downstream bytes and preserve normal legacy migration", async () => {
  const { database } = await fixture();
  const { sealCollectedCard } = await import("../src/features/play/portable-card");
  const { prepareWildsIncomingInventory } = await import("../src/features/play/wilds-incoming-inventory");
  const { normalizeWildsRuntimePlayState } = await import("../src/features/play/game-state");
  const legacy = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: session.actorId,
    encounterId: "memory-legacy", capturedAt: session.createdAt! });
  const prepared = await prepareWildsIncomingInventory([legacy]);
  await retainWildzInventoryMemory(database, session, prepared);
  const restored = await restoreWildzInventoryMemory(database, session, structuredClone(prepared));
  assert.ok(restored);
  assert.ok(Object.isFrozen(restored[0]!.manifest.stats));
  const normalized = normalizeWildsRuntimePlayState({ ...createOwnerBoundInitialPlayState(session.actorId, session.createdAt),
    inventory: restored, discoveredCardIds: [] }, session.actorId);
  assert.equal(normalized.inventory[0]!.manifest.schema, "receiz.wilds_living_card_manifest.v2");
  assert.equal(normalized.inventory[0]!.id, legacy.id);
});
