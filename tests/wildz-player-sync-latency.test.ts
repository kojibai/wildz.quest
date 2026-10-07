import assert from "node:assert/strict";
import test from "node:test";
import { createOwnerBoundInitialPlayState, normalizeWildsRuntimePlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state";
import { mergeWildsRemotePlayerPlayState } from "../src/features/play/wilds-player-vault";
import { admittedInventoryDiagnostics } from "../src/features/play/admitted-inventory";
import { wildsCardVerificationDiagnostics } from "../src/features/play/portable-card";
import { loadWildzRestoredOwnerState, saveWildzRestoredPlayState } from "../src/features/identity/wildz-restore";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import type { WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";

test("merging an unchanged admitted collection retains exact proofs without revalidating copies", () => {
  const local = createOwnerBoundInitialPlayState("sync_latency", "2026-10-07T00:00:00.000Z");
  local.player = { x: 11, z: 12 };
  local.actionHistory = [{ id: "local-travel", kind: "activity", title: "Travel", detail: "Walking", authority: "local", uPulse: 100 }];
  const admissionBefore = admittedInventoryDiagnostics().verifierCalls;
  const verificationBefore = wildsCardVerificationDiagnostics().executions;
  const merged = mergeWildsRemotePlayerPlayState({ local, restored: local, actorId: "sync_latency" });
  assert.equal(merged.inventory.length, 1);
  assert.equal(merged.inventory[0], local.inventory[0]);
  assert.equal(admittedInventoryDiagnostics().verifierCalls, admissionBefore);
  assert.equal(wildsCardVerificationDiagnostics().executions, verificationBefore);
  assert.deepEqual(merged.player, { x: 11, z: 12 });
  assert.equal(merged.actionHistory.length, 1);
  assert.equal(merged.actionHistory[0]!.id, "local-travel");
  assert.equal(merged.actionHistory[0]!.uPulse, 100);
});

test("a fresh array of admitted duplicate cards keeps normal save admission behavior", () => {
  const local = createOwnerBoundInitialPlayState("sync_duplicates", "2026-10-07T00:00:00.000Z");
  const source = { ...local, inventory: [...local.inventory, ...local.inventory], selectedAssetId: local.inventory[0]!.id };
  const expected = restorePlayState(serializePlayState(source), "sync_duplicates");
  const before = admittedInventoryDiagnostics().verifierCalls;
  const actual = normalizeWildsRuntimePlayState(source, "sync_duplicates");
  assert.deepEqual(actual, expected);
  assert.equal(actual.inventory[0], local.inventory[0]);
  assert.equal(admittedInventoryDiagnostics().verifierCalls, before);
});

test("changed nested card bytes under the same claimed digest still take full admission", () => {
  const local = createOwnerBoundInitialPlayState("sync_forgery", "2026-10-07T00:00:00.000Z");
  const restored = structuredClone(local);
  restored.inventory[0]!.manifest.name = "Forged sync name";
  const merged = mergeWildsRemotePlayerPlayState({ local, restored, actorId: "sync_forgery" });
  assert.equal(merged.inventory.length, 1);
  assert.equal(merged.inventory[0]!.manifest.name, local.inventory[0]!.manifest.name);
  assert.equal(merged.inventory[0]!.proof.digest, local.inventory[0]!.proof.digest);
});

test("unregistered admission does not change discovered-family migration", () => {
  const local = createOwnerBoundInitialPlayState("sync_discovery", "2026-10-07T00:00:00.000Z");
  const source = { ...local, inventory: [...local.inventory], discoveredCardIds: [...local.discoveredCardIds, "mintcub"] };
  const expected = restorePlayState(serializePlayState(source), "sync_discovery");
  const actual = normalizeWildsRuntimePlayState(source, "sync_discovery");
  assert.deepEqual(actual, expected);
  assert.ok(actual.inventory.some(card => card.manifest.familyId === "mintcub"));
});

test("loading stored account proofs gives the browser a turn before completing admission", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const session: WildzIdentitySession = { schema: "receiz.wildz.identity_session.v1", keyId: "startup-turn-key", actorId: "startup_turn", username: "startup_turn", displayName: "Explorer", portableStateStatus: "verified", localAuthority: "verified", remoteStatus: "offline" };
  const playState = createOwnerBoundInitialPlayState(session.actorId, "2026-10-07T00:00:00.000Z");
  await saveWildzRestoredPlayState({ database, session, playState });
  let browserTurn = false;
  const turn = setTimeout(() => { browserTurn = true; }, 0);
  const restored = await loadWildzRestoredOwnerState({ database, session });
  clearTimeout(turn);
  assert.equal(browserTurn, true);
  assert.equal(restored?.playState.inventory[0]!.proof.digest, playState.inventory[0]!.proof.digest);
});
