import assert from "node:assert/strict";
import {canonicalPortableCardJson} from "../src/features/play/portable-card";
import { test } from "node:test";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { createWildsWalletResourceSourceAssetPortV128 } from "../src/features/play/wallet/wilds-wallet-resource-source-controller-v128";
import type { WildsWalletResourceSourceMessageV128 } from "../src/features/play/wallet/wilds-wallet-resource-source-messaging-v128";
import { replayWildsResourceGameplayV128 } from "../src/lib/receiz/wilds-resource-gameplay-v128";
import { wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment";
import { createWildsResourcePackage } from "../src/features/play/wilds-resource-package";
import type { WildsWalletStagedTradeAssetAuthority, WildsWalletStagedTradeResourceSourceHead } from "../src/features/play/wallet/wilds-wallet-staged-trade-types";
import type { WildsResourceExchangeBrowserRuntimeV128 } from "../src/features/play/wallet/wilds-wallet-resource-source-controller-v128";

// Boundary-port fixtures are not production native seals. The separate source
// verifier tests exercise actual SDK preparation and device signatures.
async function fixture(ownerHandle = "alice.receiz.id") {
  const plant = Array.from({length:9},(_,i)=>wildsNourishmentPlantsForTile(i-4,-4)).flat()[0]!, kai = 100_000_000;
  const replay = await replayWildsResourceGameplayV128({ gameplayOwnerId: "explorer", commands: [{ kind: "food.gather", commandId: "gather:fixture", sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, kai).head, kaiUPulse: kai, player: plant.position, spaceId: "wildz.space.outer.v1" }] });
  const packageProof = createWildsResourcePackage({ ownerReceizId: "alice.receiz.id", commandId: "fixture:package", createdKaiUPulse: kai, members: Object.values(replay.members) });
  const tradeId = `staged:${"1".repeat(64)}`, legId = `${tradeId}:0`;
  const leg = { kind: "asset" as const, legId, attemptId: legId, senderHandle: "alice.receiz.id", recipientHandle: "bob.receiz.id", request: { attemptId: legId, recipientHandle: "bob.receiz.id", asset: { kind: "inventory" as const, foodItemIds: packageProof.members.map(m => m.id), materialLotIds: [], resourceLotIds: [] } } };
  const original = { schema: "receiz.sealed-artifact-bytes.v124" as const, artifactSha256: "a".repeat(64), payloadSha256: "b".repeat(64), exactBytesB64u: "eA", filename: "diagnostic.receizbundle", mimeType: "application/vnd.receiz.bundle+json" };
  const descriptor: WildsWalletStagedTradeResourceSourceHead = { protocol: "wildz.resource-source.v128", legId, sourceArtifactSha256: original.artifactSha256, sourcePayloadSha256: original.payloadSha256, packageId: packageProof.packageId, packageHead: packageProof.head, memberIds: packageProof.members.map(m => m.id).sort(), domainId: "world:wildz:resource-custody:v128", custodyAppendId: "fixture:reserve", custodyHead: "c".repeat(64), ownerHandle: leg.senderHandle };
  const proof = { schema: "wildz.resource-source-proof.v128" as const, custodyArtifact: original, sourceArtifacts: [original] };
  const authority = { plan: { tradeId }, approvals: [{}, {}], acceptedNotBeforeKai: "100" } as unknown as WildsWalletStagedTradeAssetAuthority;
  const database = createMemoryWildzContinuityDatabase(), messages: { senderHandle: string; recipientHandle: string; context: unknown }[] = [];
  let prepares = 0, accepts = 0, unpacks = 0, flushes = 0, reads = 0, published = true, failAcceptReply = false, projections = 0, opens=0;
  let acceptedReceipt: Record<string, unknown> | undefined;
  const runtime = { database, ownerReceizId: ownerHandle, keyId: "held-key", applicationId: "registered-client", session: { expiresAtKaiUPulse: Number.MAX_SAFE_INTEGER }, exchange: {
    async prepare() { prepares++; return { package: packageProof, source: original, sourceProof: proof }; },
    async describeOffer() { return descriptor; },
    async verifyOffer(_source: unknown, expected?: unknown) { if (expected && canonicalPortableCardJson(expected) !== canonicalPortableCardJson(descriptor)) throw Error("descriptor changed"); return { bearer: { package: packageProof }, record: { recipientHandle: "bob", ownerReceizId: leg.senderHandle }, descriptor: () => descriptor, proof }; },
    async accept(request: { authorizationDigest: string }) { accepts++; acceptedReceipt = { schema: "wildz.resource-source-receipt.v128", packageId: packageProof.packageId, sourceArtifactSha256: original.artifactSha256, sourcePayloadSha256: original.payloadSha256, acceptedAppendId: "fixture:claim", acceptedHead: "d".repeat(64), acceptedKaiUPulse: 103_000_000, acceptedSealKai: "103", ownerReceizId: leg.recipientHandle, authorizationDigest: request.authorizationDigest, proof }; if (failAcceptReply) { failAcceptReply = false; throw Error("reply lost"); } return { package: packageProof, source: original, proof, receipt: acceptedReceipt }; },
    async observe() { reads++; const fields={package:packageProof,proof,record:{status:unpacks ? "unpacked":"claimed",ownerReceizId:leg.recipientHandle}};return acceptedReceipt ? { status: "accepted", receipt: acceptedReceipt,...fields } : { status: "offered",...fields }; },
    async unpack() { unpacks=1; return { package: packageProof, proof,receipt:{schema:"wildz.resource-unpack-receipt.v128",packageId:packageProof.packageId,ownerReceizId:leg.recipientHandle,unpackedAppendId:"fixture:unpack",unpackedHead:"e".repeat(64),unpackedSealKai:"104"} }; },
  } } as unknown as WildsResourceExchangeBrowserRuntimeV128;
  const port = () => createWildsWalletResourceSourceAssetPortV128({ keyId: "held-key", ownerHandle, currentIdentity: () => ({ keyId: "held-key", ownerHandle }), openRuntime: async () => {opens++;return runtime;}, readMessages: async () => messages,
    publish: async (context: WildsWalletResourceSourceMessageV128, peer: string) => { messages.push({ senderHandle: ownerHandle, recipientHandle: peer, context }); return published; },
    flushGameplay: async () => { flushes++; }, readKai: () => 102_000_000, onProjection: async () => { projections++; },
  }, { database: async () => database, withLock: async (_name, action) => action(), verifyAuthority: async () => "100" });
  return { port, runtime, database, leg, descriptor, authority, original, messages, counts: () => ({ prepares, accepts, unpacks, flushes, reads, projections, opens }), publishPending: () => { published = false; }, loseAcceptReply: () => { failAcceptReply = true; } };
}

test("resource port construction is cheap; quota failure occurs before reserving any members", async () => {
  const f = await fixture(); const port = f.port(); assert.equal(f.counts().prepares, 0); f.database.failNextTransaction();
  await assert.rejects(port.prepareSource(f.leg), /transaction_failed/); assert.equal(f.counts().prepares, 0);
});

test("source reservation is retained once and private sync pending is never Sent", async () => {
  const f = await fixture(); const port = f.port();
  assert.deepEqual(await port.prepareSource(f.leg), f.descriptor); assert.deepEqual(await f.port().prepareSource(f.leg), f.descriptor); assert.equal(f.counts().prepares, 1);
  f.publishPending(); const result = await port.sendSource(f.leg, f.descriptor, f.authority); assert.equal(result.status, "pending");
  await port.sendSource(f.leg, f.descriptor, f.authority); assert.equal(f.counts().prepares, 1); assert.equal(f.counts().accepts, 0);
});

test("recipient resolves a dropped CAS reply, retains package, and unpacks it exactly once after reopen", async () => {
  const f = await fixture("bob.receiz.id"), port = f.port();
  f.messages.push({ senderHandle: f.leg.senderHandle, recipientHandle: f.leg.recipientHandle, context: { kind: "trade-resource-source", tradeId: f.authority.plan.tradeId, legId: f.leg.legId, original: f.original } });
  f.loseAcceptReply(); assert.equal((await port.acceptSource(f.leg, f.descriptor, f.authority)).status, "pending");
  const recovered = await f.port().acceptSource(f.leg, f.descriptor, f.authority); assert.equal(recovered.status, "accepted"); assert.equal(f.counts().accepts, 1); assert.equal(f.counts().unpacks, 0);
  assert.equal((await f.port().unpackHeldPackage(f.descriptor.packageId)).status, "accepted");
  const firstProjectionCount=f.counts().projections;
  assert.equal((await f.port().unpackReceivedPackage(f.leg, f.descriptor, f.authority)).status, "accepted"); assert.equal(f.counts().unpacks, 1);
  assert.equal(f.counts().projections,firstProjectionCount+1,'refresh requalifies/reprojects current contents without another spend');
});

test("explicit source actions renew an expired session and receipt locators cannot change root-admitted acceptance",async()=>{
 const f=await fixture(),port=f.port();await port.prepareSource(f.leg);assert.equal(f.counts().opens,1);
 Object.assign(f.runtime.session,{expiresAtKaiUPulse:101_000_000});
 await port.prepareSource(f.leg);assert.equal(f.counts().opens,2,'cached expired grant/session is not reused');
 const recipient=await fixture('bob.receiz.id');recipient.messages.push({senderHandle:recipient.leg.senderHandle,recipientHandle:recipient.leg.recipientHandle,context:{kind:'trade-resource-source',tradeId:recipient.authority.plan.tradeId,legId:recipient.leg.legId,original:recipient.original}});
 const accepted=await recipient.port().acceptSource(recipient.leg,recipient.descriptor,recipient.authority);assert.equal(accepted.status,'accepted');
 await assert.rejects(recipient.port().verifyAccepted(recipient.leg,recipient.descriptor,{...accepted,receipt:{...(accepted.receipt as object),acceptedSealKai:'999'}},recipient.authority),/receipt locator/i);
 assert.equal(recipient.counts().accepts,1);
});

test("receipt JSON and a mismatched selection do not advance or mutate the source", async () => {
  const f = await fixture(); const port = f.port();
  await assert.rejects(port.prepareSource({ ...f.leg, request: { ...f.leg.request, asset: { ...f.leg.request.asset, foodItemIds: ["invented"] } } }), /selected|descriptor|member/i);
  await assert.rejects(port.verifyAccepted(f.leg, f.descriptor, { status: "accepted", receipt: {} }, f.authority), /receipt/i);
  assert.equal(f.counts().accepts, 0); assert.equal(f.counts().unpacks, 0);
});
