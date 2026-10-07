import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { wildsCardVerificationDiagnostics } from "../src/features/play/portable-card";
import { loadWildzRestoredOwnerState, saveWildzRestoredPlayState } from "../src/features/identity/wildz-restore";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import type { WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";
import { createWildsNourishmentState, gatherWildsNourishment, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment";
const session: WildzIdentitySession = { schema: "receiz.wildz.identity_session.v1", keyId: "action-save-key", actorId: "action_saver", username: "action_saver", displayName: "Action Saver", portableStateStatus: "verified", localAuthority: "verified", remoteStatus: "offline" };

test("saving finite food consumption reuses current admitted cards across the storage clone", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const initial = createOwnerBoundInitialPlayState(session.actorId);
  const plant = wildsNourishmentPlantsForTile(3, 3)[0]!;
  const gathered = gatherWildsNourishment({ state: createWildsNourishmentState(session.actorId), ownerReceizId: session.actorId, sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, 100).head, kaiUPulse: 100, player: plant.position, spaceId: "wildz.space.outer.v1" });
  assert.ok(gathered.ok); if (!gathered.ok) return;
  const full = { ...initial, playerNourishment: gathered.state, energy: 50 };
  await saveWildzRestoredPlayState({ database, session, playState: full });
  const eaten = applyWildsInput(full, { type: "eat-food", ownerReceizId: session.actorId, itemId: gathered.item.itemId, kaiUPulse: 101 });
  assert.notEqual(eaten, full);
  const before = wildsCardVerificationDiagnostics().executions;
  const saved = await saveWildzRestoredPlayState({ database, session, playState: eaten });
  assert.equal(wildsCardVerificationDiagnostics().executions, before);
  assert.equal(saved.inventory, eaten.inventory);
  const stale = await saveWildzRestoredPlayState({ database, session, playState: full });
  assert.equal(stale.playerNourishment?.items[gathered.item.itemId]?.consumedKaiUPulse, 101);
  const restored = await loadWildzRestoredOwnerState({ database, session });
  assert.equal(restored?.playState.playerNourishment?.items[gathered.item.itemId]?.consumedKaiUPulse, 101);
  assert.deepEqual(restored?.playState.actionHistory, saved.actionHistory);
  assert.equal(restored?.playState.inventory[0]?.proof.digest, initial.inventory[0]?.proof.digest);
});

test("a source state without runtime admission still verifies stored and incoming proofs", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const state = createOwnerBoundInitialPlayState(session.actorId);
  await saveWildzRestoredPlayState({ database, session, playState: state });
  const untrusted = structuredClone(state);
  untrusted.inventory[0]!.manifest.name = "Forged stored creature";
  const before = wildsCardVerificationDiagnostics().executions;
  const saved = await saveWildzRestoredPlayState({ database, session, playState: untrusted });
  assert.ok(wildsCardVerificationDiagnostics().executions > before);
  assert.equal(saved.inventory.some(card => card.manifest.name === "Forged stored creature"), false);
});
