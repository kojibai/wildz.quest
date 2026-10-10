import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, createOwnerBoundInitialPlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state";
import { createPlayerBreaths, PLAYER_BREATH_CAPACITY_MICRO } from "../src/features/play/player-breath-energy";
import { canonicalPortableCardJson } from "../src/features/play/portable-card";
import { creditWildsImportedPackageFood, createWildsNourishmentState, gatherWildsNourishment, WILDS_NOURISHMENT_DIGESTION_UPULSES, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import type { WildsResourceLotV1 } from "../src/features/play/wilds-resource-lot";
import { replayWildsResourceGameplayV128 } from "../src/lib/receiz/wilds-resource-gameplay-v128";
import { wildsWalletResourceMemberRefV128 } from "../src/features/play/wallet/wilds-wallet-resource-projection-v128";
import { recoverWildsWalletSourceFoodV128, selectWildsWalletSourceLotsV128 } from "../src/features/play/wallet/wilds-wallet-resource-use-projection-v128";

// These exercise real deterministic source replay and the actual body reducer.
// The caller must separately admit the replay through the existing SDK source.
async function foodFixture() {
  const owner = "recipient-explorer", sender = "sender-explorer", kai = 100_000_000;
  const plant = Array.from({ length: 9 }, (_, i) => wildsNourishmentPlantsForTile(i - 4, -4)).flat().find(p => p.foodKind === "orchard-fruit")!;
  const gathered = await replayWildsResourceGameplayV128({ gameplayOwnerId: sender, commands: [{ kind: "food.gather", commandId: "gather:source-food", sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, kai).head, kaiUPulse: kai, player: plant.position, spaceId: "wildz.space.outer.v1" }] });
  const member = Object.values(gathered.members)[0]!;
  assert.equal(member.kind, "food");
  const receipt = { packageId: "source:package:food", receiptId: "wildz:resource:unpack:fixture" };
  const local = { ...createOwnerBoundInitialPlayState(owner), playerNourishment: creditWildsImportedPackageFood(createWildsNourishmentState(owner), [member], receipt, kai + 1), playerBreaths: createPlayerBreaths(kai + 1, 20), energy: 20 };
  const source = await replayWildsResourceGameplayV128({ gameplayOwnerId: owner, imports: [{ ...receipt, members: [member], sourceArtifactSha256: "a".repeat(64), kaiUPulse: kai + 1 }], commands: [{ kind: "food.consume", commandId: "consume:source-food", itemId: member.id, kaiUPulse: kai + 2, reserveMicroBreaths: local.playerBreaths.reserveMicroBreaths }] });
  return { owner, kai, member, local, source };
}

test("accepted source meal credits exact fuel once after a lost local save and cold restart", async () => {
  const f = await foodFixture(), restored = restorePlayState(serializePlayState(f.local), f.owner);
  const acceptedFuel = f.source.nourishment.items[f.member.id]!.consumedFuelMicroBreaths!;
  const recovery = recoverWildsWalletSourceFoodV128(restored, f.source.nourishment, f.owner, f.kai + 3, [f.member.id]);
  assert.equal(recovery.state.playerBreaths!.restoredMicroBreaths - restored.playerBreaths!.restoredMicroBreaths, acceptedFuel);
  assert.deepEqual(recovery.creditedItemIds, [f.member.id]); assert.deepEqual(recovery.pendingItemIds, []);
  const reopened = restorePlayState(serializePlayState(recovery.state), f.owner);
  assert.equal(recoverWildsWalletSourceFoodV128(reopened, f.source.nourishment, f.owner, f.kai + 4, [f.member.id]).state, reopened);
  assert.equal(f.source.members[f.member.id], undefined, "the accepted source portion remains spent");
});

test("insufficient room defers the complete accepted meal rather than truncating its once-only fuel", async () => {
  const f = await foodFixture(), acceptedFuel = f.source.nourishment.items[f.member.id]!.consumedFuelMicroBreaths!;
  const full = { ...f.local, playerBreaths: { ...createPlayerBreaths(f.kai + 3, 100), reserveMicroBreaths: PLAYER_BREATH_CAPACITY_MICRO - acceptedFuel + 1 } };
  const pending = recoverWildsWalletSourceFoodV128(full, f.source.nourishment, f.owner, f.kai + 3, [f.member.id]);
  assert.equal(pending.state, full); assert.deepEqual(pending.pendingItemIds, [f.member.id]);
  assert.equal(pending.state.playerNourishment!.items[f.member.id]!.consumedKaiUPulse, undefined);
  const hungry = { ...restorePlayState(serializePlayState(full), f.owner), playerBreaths: createPlayerBreaths(f.kai + 4, 20) };
  const later = recoverWildsWalletSourceFoodV128(hungry, f.source.nourishment, f.owner, f.kai + 4, [f.member.id]);
  assert.equal(later.state.playerBreaths!.restoredMicroBreaths, acceptedFuel);
});

test("recovery requires the original exact local portion, actual source owner, bounded fuel and admitted time", async () => {
  const f = await foodFixture();
  const changed = { ...f.local, playerNourishment: { ...f.local.playerNourishment, items: { [f.member.id]: { ...f.local.playerNourishment.items[f.member.id]!, gatheredKaiUPulse: f.kai - 1 } } } };
  assert.equal(recoverWildsWalletSourceFoodV128(changed, f.source.nourishment, f.owner, f.kai + 3, [f.member.id]).state, changed);
  assert.equal(recoverWildsWalletSourceFoodV128(f.local, { ...f.source.nourishment, ownerReceizId: "foreign" }, f.owner, f.kai + 3, [f.member.id]).state, f.local);
  assert.equal(recoverWildsWalletSourceFoodV128(f.local, f.source.nourishment, f.owner, f.kai + 1, [f.member.id]).state, f.local);
  assert.equal(recoverWildsWalletSourceFoodV128(f.local, f.source.nourishment, f.owner, f.kai + 3, []).state, f.local);
  for (const amount of [0, -1, Number.NaN, PLAYER_BREATH_CAPACITY_MICRO + 1]) {
    const invalid = { ...f.source.nourishment, items: { [f.member.id]: { ...f.source.nourishment.items[f.member.id]!, consumedFuelMicroBreaths: amount } } };
    assert.equal(recoverWildsWalletSourceFoodV128(f.local, invalid, f.owner, f.kai + 3, [f.member.id]).state, f.local);
  }
  const swappedImport = { ...f.source.nourishment, importedItems: { ...f.source.nourishment.importedItems, [f.member.id]: { ...f.source.nourishment.importedItems![f.member.id]!, receiptId: "another:unpack" } } };
  assert.equal(recoverWildsWalletSourceFoodV128(f.local, swappedImport, f.owner, f.kai + 3, [f.member.id]).state, f.local);
  const absent = { ...f.local, playerNourishment: createWildsNourishmentState(f.owner) };
  assert.equal(recoverWildsWalletSourceFoodV128(absent, f.source.nourishment, f.owner, f.kai + 3, [f.member.id]).state, absent, "spent food is never reconstructed into inventory");
});

test("a digestion window defers accepted source fuel without spending the original portion twice", async () => {
  const f = await foodFixture();
  const plants = Array.from({ length: 9 }, (_, i) => wildsNourishmentPlantsForTile(i - 4, -4)).flat().filter(p => p.foodKind === "orchard-fruit" && p.sourceId !== f.member.foodItem.sourceId);
  let body = f.local;
  for (const plant of plants.slice(0, 4)) {
    const gathered = gatherWildsNourishment({ state: body.playerNourishment, ownerReceizId: f.owner, sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, f.kai + 3).head, kaiUPulse: f.kai + 3, player: plant.position, spaceId: "wildz.space.outer.v1" });
    assert.ok(gathered.ok);
    body = { ...body, playerNourishment: gathered.state };
    body = applyWildsInput(body, { type: "eat-food", ownerReceizId: f.owner, itemId: gathered.item.itemId, kaiUPulse: f.kai + 3 }) as typeof body;
  }
  const pending = recoverWildsWalletSourceFoodV128(body, f.source.nourishment, f.owner, f.kai + 4, [f.member.id]);
  assert.equal(pending.state, body); assert.deepEqual(pending.pendingItemIds, [f.member.id]);
  const restored = restorePlayState(serializePlayState(body), f.owner);
  const recovered = recoverWildsWalletSourceFoodV128(restored, f.source.nourishment, f.owner, f.kai + WILDS_NOURISHMENT_DIGESTION_UPULSES + 4, [f.member.id]);
  assert.equal(recovered.state.playerBreaths!.restoredMicroBreaths - restored.playerBreaths!.restoredMicroBreaths, f.source.nourishment.items[f.member.id]!.consumedFuelMicroBreaths);
  assert.deepEqual(recovered.creditedItemIds, [f.member.id]);
});

test("admitted source consumption repairs local unavailable routing without allowing another spend", async () => {
  const f = await foodFixture(), locked = { ...f.local, playerNourishment: { ...f.local.playerNourishment, unavailableItemIds: [f.member.id, "other:locked"] } };
  const recovered = recoverWildsWalletSourceFoodV128(locked, f.source.nourishment, f.owner, f.kai + 3, [f.member.id]);
  assert.deepEqual(recovered.state.playerNourishment!.unavailableItemIds, ["other:locked"]);
  assert.equal(applyWildsInput(recovered.state, { type: "eat-food", ownerReceizId: f.owner, itemId: f.member.id, kaiUPulse: f.kai + 4 }), recovered.state);
});

test("current stored, consumed, reserved and source-locked material is unavailable even with an imported cache ref", () => {
  const owner = "bob.receiz.id", source = Array.from({ length: 9 }, (_, i) => projectWildsResourceRegion(i - 4, -4)).flat().find(s => s.kind === "timber")!;
  const lot = createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: "alice.receiz.id", actorPosition: source.position, kaiUPulse: 100_000_000 }).lot;
  const ref = wildsWalletResourceMemberRefV128({ kind: "material", id: lot.lotId, materialLot: lot });
  const base = { ...initialWildsWorldProjection(), materialLots: { [lot.lotId]: lot } }, input = { world: base, ownerReceizId: owner, availableMembers: [ref], lockedMemberIds: new Set<string>() };
  assert.deepEqual(selectWildsWalletSourceLotsV128(input).materialLots, [lot], "current imported keeper can select the unchanged genesis lot");
  for (const field of ["storedMaterialLots", "consumedMaterialLots", "reservedMaterialLots"] as const) {
    assert.deepEqual(selectWildsWalletSourceLotsV128({ ...input, world: { ...base, [field]: { [lot.lotId]: "actual:world:lock" } } }).materialLots, [], field);
  }
  assert.deepEqual(selectWildsWalletSourceLotsV128({ ...input, lockedMemberIds: new Set([lot.lotId]) }).materialLots, []);
  assert.equal(canonicalPortableCardJson(ref.materialLot), canonicalPortableCardJson(lot));
});

test("resource selector preserves ordinary holdings and enforces reservation on source-imported Honey", () => {
  // Selection is presentation only; proof/source admission is a separate port.
  const lot = { schema: "wildz.resource-lot.v1", lotId: "honey:source", kind: "living-honey", ownerReceizId: "alice.receiz.id", quantity: 2, head: "a".repeat(64) } as unknown as WildsResourceLotV1;
  const ref = wildsWalletResourceMemberRefV128({ kind: "resource", id: lot.lotId, resourceLot: lot });
  const own = { ...lot, lotId: "honey:ordinary", ownerReceizId: "bob.receiz.id" }, world = { ...initialWildsWorldProjection(), resourceLots: { [lot.lotId]: lot, [own.lotId]: own } };
  const input = { world, ownerReceizId: "bob.receiz.id", availableMembers: [ref], lockedMemberIds: new Set<string>() };
  assert.deepEqual(selectWildsWalletSourceLotsV128(input).resourceLots.map(item => item.lotId).sort(), [lot.lotId, own.lotId].sort());
  assert.deepEqual(selectWildsWalletSourceLotsV128({ ...input, world: { ...world, reservedResourceLots: { [lot.lotId]: "package:reserved" } } }).resourceLots, [own]);
});
