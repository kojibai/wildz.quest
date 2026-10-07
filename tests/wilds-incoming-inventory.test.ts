import assert from "node:assert/strict";
import test from "node:test";
import { createOwnerBoundInitialPlayState, normalizeWildsRuntimePlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state";
import { admittedInventoryDiagnostics, isAdmittedWildsCard } from "../src/features/play/admitted-inventory";
import { prepareWildsIncomingInventory } from "../src/features/play/wilds-incoming-inventory";
import { canonicalPortableCardJson, sealCollectedCard, sha256PortableBasis, verifyAnyWildsCard } from "../src/features/play/portable-card";
import { deriveCardVariant, variantSeedFor } from "../src/features/play/card-variant";
import { wildsInventoryConvergenceDiagnostics } from "../src/features/play/wilds-inventory-convergence";
import { mergeWildsRemotePlayerPlayState } from "../src/features/play/wilds-player-vault";

test("downloaded identical cards reuse full verified objects while yielding between batches", async () => {
  const local = createOwnerBoundInitialPlayState("incoming_same", "2026-10-07T00:00:00.000Z");
  const incoming = [structuredClone(local.inventory[0]!), structuredClone(local.inventory[0]!)];
  const before = admittedInventoryDiagnostics().verifierCalls;
  let turns = 0, now = 0;
  const prepared = await prepareWildsIncomingInventory(incoming, local.inventory, {
    now: () => now += 5,
    yield: async () => { turns++; }
  });
  assert.equal(turns, 2);
  assert.equal(prepared.length, 2);
  assert.equal(prepared[0], local.inventory[0]);
  assert.equal(prepared[1], local.inventory[0]);
  assert.equal(admittedInventoryDiagnostics().verifierCalls, before);
  const merged = normalizeWildsRuntimePlayState({ ...local, inventory: prepared }, "incoming_same");
  assert.equal(merged.inventory.length, 1);
});

test("same-head mutated proof bytes are rejected instead of reusing a claimed pin", async () => {
  const local = createOwnerBoundInitialPlayState("incoming_forged", "2026-10-07T00:00:00.000Z");
  const changed = structuredClone(local.inventory[0]!);
  changed.manifest.stats.power += 100;
  const before = admittedInventoryDiagnostics().verifierCalls;
  const prepared = await prepareWildsIncomingInventory([changed], local.inventory);
  assert.deepEqual(prepared, []);
  assert.ok(admittedInventoryDiagnostics().verifierCalls > before);
});

test("new source cards are fully verified and become immutable before use", async () => {
  const local = createOwnerBoundInitialPlayState("incoming_new", "2026-10-07T00:00:00.000Z");
  const incoming = structuredClone(local.inventory);
  const before = admittedInventoryDiagnostics().verifierCalls;
  const prepared = await prepareWildsIncomingInventory(incoming);
  assert.equal(prepared.length, 1);
  assert.equal(admittedInventoryDiagnostics().verifierCalls, before + 1);
  assert.ok(isAdmittedWildsCard(prepared[0]!));
  assert.ok(Object.isFrozen(prepared[0]!.manifest.stats));
});

test("unadmitted lookalikes cannot supply proof admission", async () => {
  const local = createOwnerBoundInitialPlayState("incoming_unknown", "2026-10-07T00:00:00.000Z");
  const forged = structuredClone(local.inventory[0]!);
  forged.manifest.name = "Unverified lookalike";
  const prepared = await prepareWildsIncomingInventory([structuredClone(forged)], [forged]);
  assert.deepEqual(prepared, []);
});

test("only valid entries survive malformed incoming storage", async () => {
  const local = createOwnerBoundInitialPlayState("incoming_malformed", "2026-10-07T00:00:00.000Z");
  const incoming = [null, {}, undefined, structuredClone(local.inventory[0]!)];
  const prepared = await prepareWildsIncomingInventory(incoming as never);
  assert.equal(prepared.length, 1);
  assert.equal(prepared[0]!.id, local.inventory[0]!.id);
});

test("legacy migration finishes during yielding preparation instead of the final restore", async () => {
  const owner = "incoming_legacy";
  const local = createOwnerBoundInitialPlayState(owner, "2026-10-07T00:00:00.000Z");
  const incoming = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: owner,
    encounterId: "legacy-incoming", capturedAt: "2026-10-07T00:00:00.000Z" });
  const before = wildsInventoryConvergenceDiagnostics().legacyMigrations;
  const prepared = await prepareWildsIncomingInventory([structuredClone(incoming)]);
  const afterPreparation = wildsInventoryConvergenceDiagnostics().legacyMigrations;
  assert.equal(afterPreparation, before + 1);
  const restored = normalizeWildsRuntimePlayState({ ...local, inventory: prepared, discoveredCardIds: [] }, owner);
  assert.equal(restored.inventory[0]!.manifest.schema, "receiz.wilds_living_card_manifest.v2");
  assert.equal(restored.inventory[0]!.id, incoming.id);
  assert.equal(wildsInventoryConvergenceDiagnostics().legacyMigrations, afterPreparation);
});

test("changed status retains normal history precedence without repeating comparison in final merge", async () => {
  const owner = "incoming_status";
  const local = createOwnerBoundInitialPlayState(owner, "2026-10-07T00:00:00.000Z");
  const incoming = structuredClone(local.inventory[0]!);
  incoming.status = "verified";
  incoming.synchronizedAt = "2026-10-07T00:01:00.000Z";
  const before = wildsInventoryConvergenceDiagnostics().historyComparisons;
  const prepared = await prepareWildsIncomingInventory([incoming], local.inventory);
  const afterPreparation = wildsInventoryConvergenceDiagnostics().historyComparisons;
  assert.equal(afterPreparation, before + 1);
  const merged = mergeWildsRemotePlayerPlayState({ local, restored: { ...local, inventory: prepared }, actorId: owner });
  assert.equal(merged.inventory[0], local.inventory[0]);
  assert.equal(wildsInventoryConvergenceDiagnostics().historyComparisons, afterPreparation);
});

test("a verified legacy source whose migration fails retains the parser's recovery behavior", async () => {
  const owner = "incoming_failed_migration", at = "2026-10-07T00:00:00.000Z";
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: owner, encounterId: "invalid-time", capturedAt: at });
  card.manifest.capturedAt = "invalid";
  const variant = card.manifest.variant;
  assert.ok(variant.generatorVersion === 1);
  variant.seed = variantSeedFor({ formId: card.manifest.formId, encounterId: card.manifest.encounterId,
    ownerReceizId: owner, capturedAt: card.manifest.capturedAt, kaiPulse: variant.kaiPulse,
    battleTranscriptDigest: variant.battleTranscriptDigest }, 1);
  variant.traits = deriveCardVariant(variant.seed, 1);
  variant.traitsDigest = sha256PortableBasis(canonicalPortableCardJson(variant.traits));
  card.proof.digest = sha256PortableBasis(canonicalPortableCardJson(card.manifest));
  assert.equal(verifyAnyWildsCard(card).ok, true);
  const source = { ...createOwnerBoundInitialPlayState(owner, at), player: { x: 42, z: 43 }, inventory: [card], discoveredCardIds: [] };
  const expected = restorePlayState(serializePlayState(source), owner);
  const inventory = await prepareWildsIncomingInventory(source.inventory);
  const actual = normalizeWildsRuntimePlayState({ ...source, inventory }, owner);
  // Recovery starters have a fresh issue timestamp; the authority and gameplay
  // fallback must match even though their newly sealed bytes can differ.
  assert.deepEqual(actual.player, expected.player);
  assert.equal(actual.inventory.length, expected.inventory.length);
  assert.equal(actual.inventory[0]!.manifest.ownerReceizId, owner);
  assert.notEqual(actual.player.x, source.player.x);
});
