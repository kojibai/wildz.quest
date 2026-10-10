import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizClient, createReceizIdentityKeyFile } from "@receiz/sdk";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { replayWildsResourceGameplayV128 } from "../src/lib/receiz/wilds-resource-gameplay-v128";
import { initialWildsResourceJournalV128 } from "../src/lib/receiz/wilds-resource-journal-v128";
import { wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment";
import { createWildsResourcePackage } from "../src/features/play/wilds-resource-package";
import { createWildsWalletResourceProjectionStoreV128 } from "../src/features/play/wallet/wilds-wallet-resource-projection-store-v128";
import { projectWildsWalletResourceProjectionsV128 } from "../src/features/play/wallet/wilds-wallet-resource-projection-v128";
import type { WildsWalletResourceProjectionV128 } from "../src/features/play/wallet/wilds-wallet-resource-source-controller-v128";
import type { WildsResourceExchangeBrowserRuntimeV128 } from "../src/features/play/wallet/wilds-wallet-resource-source-controller-v128";
import type { WildsResourceJournalV128 } from "../src/lib/receiz/wilds-resource-journal-v128";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { compileWildsLivingOperation } from "../src/features/play/wilds-living-operation";
import { createWildsGroveResourceLot } from "../src/features/play/wilds-resource-lot";
import type { WildsResourcePackageMember } from "../src/features/play/wilds-resource-package";

// Only the external current-source admission port is replaced here. Identity
// signatures, real food genesis/replay, compact admission and IDB transactions
// run normally. These diagnostic source bytes are not production native seals.
async function fixture(mixed = false) {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "fixture-bob", username: "bob" } });
  const database = createMemoryWildzContinuityDatabase(), ownerHandle = "bob.receiz.id";
  const plant = Array.from({ length: 9 }, (_, i) => wildsNourishmentPlantsForTile(i - 4, -4)).flat()[0]!, kai = 100_000_000;
  const replay = await replayWildsResourceGameplayV128({ gameplayOwnerId: "explorer", commands: [{ kind: "food.gather", commandId: "gather:fixture", sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, kai).head, kaiUPulse: kai, player: plant.position, spaceId: "wildz.space.outer.v1" }] });
  const members: WildsResourcePackageMember[] = Object.values(replay.members);
  if (mixed) {
    const source = Array.from({ length: 9 }, (_, i) => projectWildsResourceRegion(i - 4, -4)).flat().find(source => source.kind === "timber")!;
    const material = createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: "alice.receiz.id", actorPosition: source.position, kaiUPulse: kai }).lot;
    const operation = compileWildsLivingOperation({ operationId: "grove:fixture:harvest", category: "ecology", intention: { kind: "grove.harvest-honey", regionId: "region:0:0", featureId: "grove:fixture" }, participants: [{ id: "alice.receiz.id", kind: "player", expectedHead: "1".repeat(64), role: "steward" }], stages: [{ id: "stage:harvest", profession: "harvest-honey", participantIds: ["alice.receiz.id"] }], consequences: { usefulOutput: 2, ecologicalRenewal: 0, publicBenefit: 0, cooperation: 0, durability: 0, extraction: 0, damage: 0, waste: 0, restorationDebt: 0 }, kaiUPulse: kai, expiresAtKaiUPulse: kai + 1_000_000, semanticIdempotencyKey: "wildz:grove:fixture:harvest" });
    const honey = createWildsGroveResourceLot({ operation, ownerReceizId: "alice.receiz.id", sourceGrove: { groveId: "grove:fixture", head: `sha256:${"c".repeat(64)}`, honey: 2 }, admittedGrove: { groveId: "grove:fixture", head: `sha256:${"d".repeat(64)}`, parentHead: `sha256:${"c".repeat(64)}`, honey: 1 } })!;
    members.push({ kind: "material", id: material.lotId, materialLot: material }, { kind: "resource", id: honey.lotId, resourceLot: honey });
  }
  const packageProof = createWildsResourcePackage({ ownerReceizId: "alice.receiz.id", commandId: "fixture:package", createdKaiUPulse: kai, members });
  const legId = `staged:${"1".repeat(64)}:0`;
  const leg = { kind: "asset" as const, legId, attemptId: legId, senderHandle: "alice.receiz.id", recipientHandle: ownerHandle, request: { attemptId: legId, recipientHandle: ownerHandle, asset: { kind: "inventory" as const, foodItemIds: packageProof.members.filter(m => m.kind === "food").map(m => m.id), materialLotIds: packageProof.members.filter(m => m.kind === "material").map(m => m.id), resourceLotIds: packageProof.members.filter(m => m.kind === "resource").map(m => m.id) } } };
  const original = { schema: "receiz.sealed-artifact-bytes.v124" as const, artifactSha256: "a".repeat(64), payloadSha256: "b".repeat(64), exactBytesB64u: "eA", filename: "diagnostic.receizbundle", mimeType: "application/vnd.receiz.bundle+json" };
  const proof = { schema: "wildz.resource-source-proof.v128" as const, custodyArtifact: original, sourceArtifacts: [original] };
  let state: WildsResourceJournalV128 = { ...initialWildsResourceJournalV128(), packages: { [packageProof.packageId]: { package: packageProof, ownerReceizId: ownerHandle, recipientHandle: "bob", status: "claimed", custodyAppendId: "fixture:claim", claimAppendId: "fixture:claim" } } };
  let binding = { keyId: keyFile.keyId, ownerHandle }, admissions = 0, keyReads = 0;
  const value: WildsWalletResourceProjectionV128 = { kind: "received", leg, package: packageProof, source: original, proof };
  const store = () => createWildsWalletResourceProjectionStoreV128({ keyId: keyFile.keyId, ownerHandle, currentIdentity: () => binding, openRuntime: async () => { throw Error("fixture source port only"); } }, {
    database: async () => database, withLock: async (_name, action) => action(), readIdentity: async () => { keyReads++; return keyFile; },
    qualify: async input => { admissions++; assert.deepEqual(input.source, original); return { package: packageProof, state, proof, events: [{ event: { schema: "wildz.resource-command.v128", kind: "claim", ownerReceizId: ownerHandle, packageId: packageProof.packageId, attemptId: "fixture:claim", artifact: original }, appendId: "fixture:claim", head: "c".repeat(64), kaiUPulse: kai, sealKai: "100" }], currentHead: "c".repeat(64) }; },
  });
  return { store, database, value, keyFile, counts: () => ({ admissions, keyReads }), switchOwner: () => { binding = { ...binding, ownerHandle: "charlie.receiz.id" }; }, unpack() {
    const id = packageProof.packageId;
    state = { ...state, packages: { [id]: { ...state.packages[id]!, status: "unpacked" } }, imports: { [id]: { ownerReceizId: ownerHandle, package: packageProof, kaiUPulse: kai, unpackAppendId: "fixture:unpack", sourceArtifactSha256: original.artifactSha256 } }, looseMembers: Object.fromEntries(packageProof.members.map(member => [member.id, { ownerReceizId: ownerHandle, packageId: id, member }])) };
  }, transferAway() { state = { ...state, packages: { [packageProof.packageId]: { ...state.packages[packageProof.packageId]!, ownerReceizId: "charlie.receiz.id" } }, looseMembers: {} }; }, spend() { const id = packageProof.members[0]!.id; state = { ...state, looseMembers: {}, spentMembers: { [id]: "spent:real-source-command" } }; } };
}

test("cold cache load opens no source or private key and packed received members stay locked", async () => {
  const f = await fixture(); assert.deepEqual(await f.store().listCached(), []); assert.deepEqual(f.counts(), { admissions: 0, keyReads: 0 });
  await f.store().retain(f.value); const prior = f.counts(); const rows = await f.store().listCached(); assert.deepEqual(f.counts(), prior);
  assert.equal(rows.length, 1); assert.equal(rows[0]!.kind, "received");
  const display = projectWildsWalletResourceProjectionsV128(rows);
  assert.equal(display.cards[0]!.unpackable, true); assert.equal(display.cards[0]!.transferable, true); assert.equal(display.availableMembers.length, 0);
  assert.deepEqual([...display.lockedMemberIds], f.value.package.members.map(m => m.id));
  assert.ok(JSON.stringify(rows).length < 5000); assert.doesNotMatch(JSON.stringify(rows), /"(?:sourceArtifacts|exactBytesB64u|nourishment)":/);
});

test("exact signed cache refs reject member or owner substitution", async () => {
  const f = await fixture(); await f.store().retain(f.value);
  const entry = f.database.dump().meta.find(([, raw]) => (raw as { schema?: string }).schema === "wildz.wallet.resource-projection-index.v128")!;
  const index = structuredClone(entry[1]) as { entries: { row: { ownerHandle: string; memberRefs: { id: string }[] } }[] };
  index.entries[0]!.row.memberRefs[0]!.id = "invented-food";
  await f.database.transaction(["meta"], "readwrite", tx => tx.put("meta", index, entry[0]));
  assert.deepEqual(await f.store().listCached(), []);
});

test("presentation retention preserves the source controller's exact unpack continuation", async () => {
  const f = await fixture(), key = JSON.stringify(["wildz.resource-package-original.v128", "bob.receiz.id", f.value.package.packageId]);
  const held = { schema: "wildz.resource-package-original.v128", packageId: f.value.package.packageId, source: f.value.source, leg: f.value.leg, descriptor: { legId: f.value.leg.legId, packageId: f.value.package.packageId }, authority: { diagnostic: "actual full approval is owned and verified by the source port" } };
  await f.database.transaction(["artifacts"], "readwrite", tx => tx.put("artifacts", held, key));
  await f.store().retain(f.value);
  assert.deepEqual(await f.database.read("artifacts", key), held);
  f.unpack(); await f.store().reopen(f.value.package.packageId);
  assert.deepEqual(await f.database.read("artifacts", key), held, "Refresh contents also preserves the independent exact source continuation");
});

test("full proof and compact cache commit together or neither survives a quota failure", async () => {
  const f = await fixture(); f.database.failNextTransactionAfterPuts(1);
  await assert.rejects(f.store().retain(f.value), /transaction_failed_after_put/);
  assert.deepEqual(await f.store().listCached(), []); assert.equal(f.database.dump().artifacts.length, 0);
});

test("reopen uses current source; stale received callbacks cannot resurrect unpacked or sent packages", async () => {
  const f = await fixture(); await f.store().retain(f.value); f.unpack();
  const opened = await f.store().reopen(f.value.package.packageId); assert.equal(opened.row.kind, "unpacked"); assert.equal(opened.availableMembers.length, 1);
  assert.deepEqual(opened.package, f.value.package); assert.equal(opened.package.ownerReceizId, "alice.receiz.id");
  await f.store().retain(f.value); let display = projectWildsWalletResourceProjectionsV128(await f.store().listCached());
  assert.equal(display.availableMembers.length, 1); assert.equal(display.lockedMemberIds.size, 0); assert.equal(display.cards[0]!.unpackable, true); assert.equal(display.cards[0]!.unpackLabel, "Refresh contents"); assert.equal(display.cards[0]!.resourceUnits, 0);
  f.transferAway(); await f.store().retain(f.value); display = projectWildsWalletResourceProjectionsV128(await f.store().listCached());
  assert.equal(display.availableMembers.length, 0); assert.equal(display.cards[0]!.transferable, false); assert.equal(display.cards[0]!.kind, "sent");
});

test("spent imported food remains unavailable after proof replay and late callback", async () => {
  const f = await fixture(); await f.store().retain(f.value); f.unpack(); await f.store().reopen(f.value.package.packageId); f.spend();
  const opened = await f.store().reopen(f.value.package.packageId); assert.equal(opened.availableMembers.length, 0);
  const display = projectWildsWalletResourceProjectionsV128(await f.store().listCached()); assert.equal(display.availableMembers.length, 0); assert.equal(display.lockedMemberIds.size, 1);
  assert.equal(display.cards[0]!.unpackable, true); assert.equal(display.cards[0]!.unpackLabel, "Refresh contents"); assert.equal(display.cards[0]!.resourceUnits, 0);
});

test("identity change during qualification cannot write another Explorer's projection", async () => {
  const f = await fixture(); const pending = f.store().retain(f.value); f.switchOwner(); await assert.rejects(pending, /Explorer changed/);
  assert.equal(f.database.dump().meta.length, 0); assert.equal(f.database.dump().artifacts.length, 0);
});

test("changed full retained proof is rejected before current-source use", async () => {
  const f = await fixture(); await f.store().retain(f.value); const before = f.counts();
  const [key, raw] = f.database.dump().artifacts.find(([, value]) => (value as { schema?: string }).schema === "wildz.resource-source-proof.v128")!;
  const originalProof = structuredClone(raw) as typeof f.value.proof;
  const proof = { ...originalProof, sourceArtifacts: [{ ...originalProof.sourceArtifacts[0]!, payloadSha256: "f".repeat(64) }] };
  await f.database.transaction(["artifacts"], "readwrite", tx => tx.put("artifacts", proof, key));
  await assert.rejects(f.store().reopen(f.value.package.packageId), /retained resource proof changed/); assert.deepEqual(f.counts(), before);
});

test("production admission rejects fabricated source bytes before writing a display row", async () => {
  const f = await fixture(), sdk = createReceizClient({ applicationId: "wildz" });
  const runtime = { sdk, keyId: f.keyFile.keyId, ownerReceizId: "bob.receiz.id", exchange: { async verifyProjection() { throw Error("current source must not be read for a fabricated Original"); } } } as unknown as WildsResourceExchangeBrowserRuntimeV128;
  const store = createWildsWalletResourceProjectionStoreV128({ keyId: f.keyFile.keyId, ownerHandle: "bob.receiz.id", currentIdentity: () => ({ keyId: f.keyFile.keyId, ownerHandle: "bob.receiz.id" }), openRuntime: async () => runtime }, { database: async () => f.database, withLock: async (_name, action) => action(), readIdentity: async () => f.keyFile });
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("x")))].map(n => n.toString(16).padStart(2, "0")).join("");
  await assert.rejects(store.retain({ ...f.value, source: { ...f.value.source, artifactSha256: digest } }), /artifact|bundle|seal|verification|original/i);
  assert.deepEqual(await store.listCached(), []); assert.equal(f.database.dump().artifacts.length, 0);
});

test("one current unpacked member can return through a new package without old package locks or duplicate counts", async () => {
  const f = await fixture(); await f.store().retain(f.value); f.unpack(); await f.store().reopen(f.value.package.packageId);
  const row = (await f.store().listCached())[0]!, id = row.memberRefs[0]!.id;
  const past = { ...row, packageId: `wildz:package:${"2".repeat(64)}`, availableMemberIds: [], kind: "sent" as const, currentOwnerHandle: "charlie.receiz.id" };
  const oldUnpacked = { ...row, packageId: `wildz:package:${"3".repeat(64)}`, availableMemberIds: [] };
  const display = projectWildsWalletResourceProjectionsV128([past, oldUnpacked, row]);
  assert.equal(display.availableMembers.length, 1); assert.equal(display.lockedMemberIds.has(id), false);
  assert.equal(display.resourceUnitCounts["wild-berries"], 1);
  const stale = projectWildsWalletResourceProjectionsV128([{ ...past, currentHead: "f".repeat(64) }, row]);
  assert.equal(stale.availableMembers.length, 0); assert.equal(stale.lockedMemberIds.has(id), true);
});

test("mixed food, timber and Honey retain their immutable genesis while current keeper counts appear", async () => {
  const f = await fixture(true); await f.store().retain(f.value);
  let display = projectWildsWalletResourceProjectionsV128(await f.store().listCached());
  assert.deepEqual(display.resourceUnitCounts, { "wild-berries": 1, timber: 1, "living-honey": 1 }); assert.equal(display.lockedMemberIds.size, 3);
  assert.equal(display.cards[0]!.resourceUnits, 3);
  f.unpack(); const reopened = await f.store().reopen(f.value.package.packageId);
  assert.deepEqual(reopened.availableMembers, f.value.package.members); assert.deepEqual(reopened.package, f.value.package);
  assert.equal(reopened.availableMembers.find(member => member.kind === "material")!.materialLot.ownerReceizId, "alice.receiz.id");
  assert.equal(reopened.availableMembers.find(member => member.kind === "resource")!.resourceLot.ownerReceizId, "alice.receiz.id");
  display = projectWildsWalletResourceProjectionsV128(await f.store().listCached()); assert.equal(display.availableMembers.length, 3); assert.equal(display.lockedMemberIds.size, 0);
  const materialRef = display.availableMembers.find(member => member.kind === "material")!, honeyRef = display.availableMembers.find(member => member.kind === "resource")!;
  assert.deepEqual(materialRef.materialLot, f.value.package.members.find(member => member.kind === "material")!.materialLot);
  assert.deepEqual(honeyRef.resourceLot, f.value.package.members.find(member => member.kind === "resource")!.resourceLot);
  assert.ok(materialRef.materialLot!.quality >= 1); assert.ok(honeyRef.resourceLot!.quality >= 1);
  assert.equal("nourishment" in display.availableMembers.find(member => member.kind === "food")!, false);
});
