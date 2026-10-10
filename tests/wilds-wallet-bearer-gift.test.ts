import assert from "node:assert/strict";
import { test } from "node:test";
import { appendReceizPortableAssetOwnership, deriveReceizPortableOwnershipContinuity, receizBase64UrlEncode, serializeReceizPortableAssetDocument, type ReceizOpenedArtifact, type ReceizPortableAssetDocument } from "@receiz/sdk";
import { admitWildsWalletBearerOriginal, verifyWildsWalletBearerGiftSource, verifyWildsWalletBearerGiftAccepted, type WildsWalletBearerOpenPort } from "../src/features/play/wallet/wilds-wallet-bearer-gift-proof";
import { canonicalPortableCardJson, sealCollectedCard, evolvePortableCard, type PortableCardAsset } from "../src/features/play/portable-card";
import { sha256WildzArtifactBytes } from "../src/lib/receiz/wildz-artifact-custody";
import type { WildsWalletStagedTradeLeg } from "../src/features/play/wallet/wilds-wallet-staged-trade-types";
import { createWildsWalletBearerGiftController } from "../src/features/play/wallet/wilds-wallet-bearer-gift-controller";
import type { WildsWalletStagedTradeAssetAuthority } from "../src/features/play/wallet/wilds-wallet-staged-trade-types";
import type { WildsWalletBearerGiftCheckpoint, WildsWalletBearerGiftRecoveryStore, WildsWalletBearerGiftSource } from "../src/features/play/wallet/wilds-wallet-bearer-gift-recovery";
import type { WildsWalletBearerGiftMessage } from "../src/features/play/wallet/wilds-wallet-bearer-gift-messaging";
import { createWildsWalletBearerGiftRecoveryStore } from "../src/features/play/wallet/wilds-wallet-bearer-gift-recovery";
import { prepareWildsPortableDocumentV128 } from "../src/lib/receiz/wilds-portable-document-v128";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const creature = sealCollectedCard({formId:"mintcub-1",ownerReceizId:"alice.receiz.id",encounterId:"bearer-fixture",capturedAt:"2026-07-15T12:00:00.000Z"});
const leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }> = { legId: `staged:${"a".repeat(64)}:0`, attemptId: `staged:${"a".repeat(64)}:0`, senderHandle: "alice.receiz.id", recipientHandle: "bob.receiz.id", kind: "asset", request: { attemptId: `staged:${"a".repeat(64)}:0`, recipientHandle: "bob.receiz.id", asset: { kind: "creature", assetId: creature.id } } };

// The transport/verifier fixture mocks root opening, while every carried
// document/hash/ownership consequence is derived by the actual released SDK.
async function fixture() {
  const document = await prepareWildsPortableDocumentV128({ assetType: "proof_object", payload: { bytes: new TextEncoder().encode(canonicalPortableCardJson({schema:"wildz.creature-bearer.v128",card:creature,sourceOriginal:{fixture:true}})), mimeType: "image/png" }, ownership: { ownerReceizId: leg.senderHandle, custody: "bearer", proofRef: "genesis" }, provenance: { root: "wildz:creature-one", appends: [] }, settlement: { state: "none" } });
  const sources = new Map<string, ReceizOpenedArtifact>();
  const encode = async (doc: ReceizPortableAssetDocument, head: string, kai = "11") => {
    const payload = serializeReceizPortableAssetDocument(doc), bytes = new TextEncoder().encode(`sealed:${head}:${kai}`);
    const artifactSha256 = await sha256WildzArtifactBytes(bytes), payloadSha256 = await sha256WildzArtifactBytes(payload);
    const derived = await deriveReceizPortableOwnershipContinuity(doc);
    const continuity = { schema: "receiz.native_ownership_continuity.v1", ...derived, headReference: head };
    const verification = { ok: true, integrity: { ok: true, errors: [] }, kind: "bundle", errors: [], warnings: [], bundle: { kaiPulseEternal: kai, nativeRecordSeal: { ownershipContinuity: continuity } }, assetContinuity: { state: "verified", carrier: "portable_asset", ...derived, headReference: head, historyComplete: true, document: doc } };
    const opened = { sealedArtifact: { kind: "receiz.native-record-seal", artifact: new Blob([bytes]), filename: "source.receized", mimeType: "application/json", artifactSha256, payloadSha256, continuity: { carrier: "native-record-seal", ownerReceizId: doc.ownership.ownerReceizId, recordId: head, claimId: head, verifyPath: `/v/${head}`, signatureVersion: 4 }, verification }, verifiedPayload: { bytes: payload, filename: "source.json", mimeType: "application/json", sha256: payloadSha256 }, verification, legacyCompatibility: "current-native" } as unknown as ReceizOpenedArtifact;
    sources.set(artifactSha256, opened);
    return { schema: "receiz.sealed-artifact-bytes.v124" as const, exactBytesB64u: receizBase64UrlEncode(bytes), filename: "source.receized", mimeType: "application/json", artifactSha256, payloadSha256 };
  };
  const original = await encode(document, "source-head", "5");
  const expected = await appendReceizPortableAssetOwnership(document, { ownerReceizId: leg.recipientHandle, priorHeadReference: "source-head", sourceArtifactSha256: original.artifactSha256 });
  const successor = await encode(expected, "successor-head");
  const encodeProjection = async (card:PortableCardAsset=creature,owner=leg.senderHandle,sourceSha=original.artifactSha256,sourceHead="source-head") => {
    const payload=new TextEncoder().encode(canonicalPortableCardJson({schema:"wildz.creature-projection.v128",sourceArtifactSha256:sourceSha,sourceHeadReference:sourceHead,card}));
    const bytes=new TextEncoder().encode(`projection:${await sha256WildzArtifactBytes(payload)}:${owner}`),artifactSha256=await sha256WildzArtifactBytes(bytes),payloadSha256=await sha256WildzArtifactBytes(payload);
    const basis=sources.get(original.artifactSha256)!;
    if(basis.sealedArtifact.kind!=="receiz.native-record-seal")throw Error("fixture native root expected");
    sources.set(artifactSha256,{...basis,verifiedPayload:{...basis.verifiedPayload,bytes:payload,sha256:payloadSha256},sealedArtifact:{...basis.sealedArtifact,artifactSha256,payloadSha256,continuity:{...basis.sealedArtifact.continuity,ownerReceizId:owner}}});
    return {schema:"receiz.sealed-artifact-bytes.v124" as const,exactBytesB64u:receizBase64UrlEncode(bytes),filename:"projection.receized",mimeType:"application/json",artifactSha256,payloadSha256};
  };
  const projectionOriginal=await encodeProjection();
  const artifacts: WildsWalletBearerOpenPort = { async verifyAndOpen(file) { const sha = await sha256WildzArtifactBytes(new Uint8Array(await file.arrayBuffer())); const found = sources.get(sha); if (!found) throw Error("unverified fixture root"); return found; } };
  return { document, original, successor, projectionOriginal, artifacts, encode, encodeProjection };
}

test("modern gift verifies exact SDK ownership append and preserves immutable payload", async () => {
  const f = await fixture();
  const source = await verifyWildsWalletBearerGiftSource({ leg, original: f.original, projectionOriginal:f.projectionOriginal, artifacts: f.artifacts, assertSelection: async (_leg, document) => assert.equal(document.payload.mimeType, "image/png") });
  const accepted = await verifyWildsWalletBearerGiftAccepted({ leg, descriptor: source.descriptor, predecessor: f.original, projectionOriginal:f.projectionOriginal, successor: f.successor, acceptedNotBeforeKai: "10", artifacts: f.artifacts });
  assert.equal(accepted.ownerHandle, leg.recipientHandle);
  assert.equal(accepted.acceptedKai, "11");
  assert.equal(accepted.descriptor.artifactId, source.descriptor.artifactId);
  assert.equal(accepted.descriptor.appendCount, 1);
});

test("modern gift rejects history replay from before or during either approval pulse", async () => {
  const f = await fixture();
  const source = await verifyWildsWalletBearerGiftSource({ leg, original: f.original, projectionOriginal:f.projectionOriginal, artifacts: f.artifacts, assertSelection: async () => undefined });
  for (const barrier of ["11", "12"]) await assert.rejects(verifyWildsWalletBearerGiftAccepted({ leg, descriptor: source.descriptor, predecessor: f.original, projectionOriginal:f.projectionOriginal, successor: f.successor, acceptedNotBeforeKai: barrier, artifacts: f.artifacts }), /approval/);
});

test("modern gift rejects replacement payload, wrong receiver, changed history and signed source descriptor", async () => {
  const f = await fixture();
  const source = await verifyWildsWalletBearerGiftSource({ leg, original: f.original, projectionOriginal:f.projectionOriginal, artifacts: f.artifacts, assertSelection: async () => undefined });
  for (const document of [f.document, await appendReceizPortableAssetOwnership(f.document, { ownerReceizId: "eve.receiz.id", priorHeadReference: "source-head", sourceArtifactSha256: f.original.artifactSha256 }), await appendReceizPortableAssetOwnership(f.document, { ownerReceizId: leg.recipientHandle, priorHeadReference: "other-head", sourceArtifactSha256: f.original.artifactSha256 })]) {
    const successor = await f.encode(document, "wrong-head");
    await assert.rejects(verifyWildsWalletBearerGiftAccepted({ leg, descriptor: source.descriptor, predecessor: f.original, projectionOriginal:f.projectionOriginal, successor, acceptedNotBeforeKai: "10", artifacts: f.artifacts }), /successor/);
  }
  await assert.rejects(verifyWildsWalletBearerGiftAccepted({ leg, descriptor: { ...source.descriptor, sourceArtifactSha256: "f".repeat(64) }, predecessor: f.original, projectionOriginal:f.projectionOriginal, successor: f.successor, acceptedNotBeforeKai: "10", artifacts: f.artifacts }), /descriptor/);
});

test("Original wire rejects oversized/noncanonical/private JSON and production root verification rejects forged bytes", async () => {
  const f = await fixture();
  assert.throws(() => admitWildsWalletBearerOriginal({ ...f.original, exactBytesB64u: "a".repeat(2_000_001) }), /bounded/);
  assert.throws(() => admitWildsWalletBearerOriginal({ ...f.original, secret: "never transported" }), /bounded/);
  await assert.rejects(verifyWildsWalletBearerGiftSource({ leg, original: f.original, projectionOriginal:f.projectionOriginal, assertSelection: async () => undefined }), /verif|artifact|seal|bundle/i);
});

const authority = { plan: { tradeId: leg.legId.slice(0, leg.legId.lastIndexOf(":")) }, approvals: [], acceptedNotBeforeKai: "10" } as unknown as WildsWalletStagedTradeAssetAuthority;
function memoryStore() {
  const attempts = new Map<string, WildsWalletBearerGiftCheckpoint>(), originals = new Map<string, WildsWalletBearerGiftSource>();
  const store: WildsWalletBearerGiftRecoveryStore = { async readAttempt(owner, key, id) { return structuredClone(attempts.get(`${owner}:${key}:${id}`) ?? null); }, async saveAttempt(value) { attempts.set(`${value.ownerHandle}:${value.keyId}:${value.leg.legId}`, structuredClone(value)); }, async readSource(owner, key, sha) { return structuredClone(originals.get(`${owner}:${key}:${sha}`) ?? null); }, async retainSource(owner, key, source) { originals.set(`${owner}:${key}:${source.original.artifactSha256}`, structuredClone(source)); } };
  return { store, attempts, originals };
}
async function protocolFixture() {
  const f = await fixture(), state = memoryStore(), messages: WildsWalletBearerGiftMessage[] = [];
  let ownerHandle = leg.recipientHandle, claims = 0, restores = 0, publication = true, throwClaim = false, throwRestore = false;
  const descriptor = (await verifyWildsWalletBearerGiftSource({ leg, original: f.original, projectionOriginal:f.projectionOriginal, artifacts: f.artifacts, assertSelection: async () => undefined })).descriptor;
  const source: WildsWalletBearerGiftMessage = { kind: "trade-bearer-source", tradeId: authority.plan.tradeId, legId: leg.legId, original: f.original, projectionOriginal:f.projectionOriginal, originProof: { fixture: true } };
  const input = { keyId: "held-key", ownerHandle: leg.recipientHandle, currentIdentity: () => ({ keyId: "held-key", ownerHandle }), sourceFor: async () => ({ original: f.original, projectionOriginal:f.projectionOriginal, originProof: source.originProof }), assertSelection: async () => undefined, verifyOrigin: async () => undefined, readMessages: async () => [{ senderHandle: leg.senderHandle, recipientHandle: leg.recipientHandle, context: source }], publish: async (message: WildsWalletBearerGiftMessage) => { messages.push(message); return publication; }, store: state.store, artifacts: f.artifacts, verifyAuthority: async () => "10", withLock: async <T>(_name: string, action: () => Promise<T>) => action(), claim: async ({ source }: { source: WildsWalletBearerGiftSource }) => { claims++; assert.equal(source.original.exactBytesB64u, f.original.exactBytesB64u); if (throwClaim) throw Error("lost response"); return f.successor; }, restoreAccepted: async () => { restores++; if (throwRestore) throw Error("projection quota"); } };
  return { f, input, state, messages, descriptor, get claims() { return claims; }, get restores() { return restores; }, setOwner(value: string) { ownerHandle = value; }, setPublication(value: boolean) { publication = value; }, setClaimFailure(value: boolean) { throwClaim = value; }, setRestoreFailure(value: boolean) { throwRestore = value; } };
}

test("claim is explicit and cold recovery retries exactly one predecessor after a lost reply", async () => {
  const f = await protocolFixture();
  const initial = createWildsWalletBearerGiftController(f.input);
  assert.equal(f.claims, 0);
  assert.equal((await initial.observeSource(leg, f.descriptor, undefined, authority)).status, "offered");
  assert.equal(f.claims, 0);
  f.setClaimFailure(true);
  assert.equal((await initial.acceptSource(leg, f.descriptor, authority)).status, "pending");
  assert.equal([...f.state.attempts.values()][0]?.state, "submitted");
  f.setClaimFailure(false);
  const resumed = createWildsWalletBearerGiftController(f.input);
  const accepted = await resumed.acceptSource(leg, f.descriptor, authority);
  assert.equal(accepted.status, "accepted"); assert.equal(f.claims, 2);
  await resumed.verifyAccepted(leg, f.descriptor, accepted, authority);
  assert.equal(f.claims, 2);
});

test("quota/readback failures and switched identity cause zero native claims", async () => {
  const f = await protocolFixture();
  const throwing = { ...f.input.store, async saveAttempt() { throw Error("QuotaExceededError"); } };
  assert.equal((await createWildsWalletBearerGiftController({ ...f.input, store: throwing }).acceptSource(leg, f.descriptor, authority)).status, "pending");
  assert.equal(f.claims, 0);
  const brokenReadback = { ...f.input.store, async readAttempt() { return null; } };
  assert.equal((await createWildsWalletBearerGiftController({ ...f.input, store: brokenReadback }).acceptSource(leg, f.descriptor, authority)).status, "pending");
  assert.equal(f.claims, 0);
  f.setOwner("eve.receiz.id");
  assert.equal((await createWildsWalletBearerGiftController(f.input).acceptSource(leg, f.descriptor, authority)).status, "pending"); assert.equal(f.claims, 0);
});

test("accepted projection/publication retries use saved successor and never claim twice", async () => {
  const f = await protocolFixture(); f.setRestoreFailure(true);
  const accepted = await createWildsWalletBearerGiftController(f.input).acceptSource(leg, f.descriptor, authority);
  assert.equal(accepted.status, "accepted"); assert.equal("projectionPending" in accepted && accepted.projectionPending, true); assert.equal(f.claims, 1);
  assert.equal(f.messages[0]?.kind, "trade-bearer-accepted");
  f.setRestoreFailure(false); f.setPublication(false);
  assert.equal((await createWildsWalletBearerGiftController(f.input).acceptSource(leg, f.descriptor, authority)).status, "pending"); assert.equal(f.claims, 1);
  f.setPublication(true);
  assert.equal((await createWildsWalletBearerGiftController(f.input).acceptSource(leg, f.descriptor, authority)).status, "accepted"); assert.equal(f.claims, 1);
  assert.equal(f.restores, 2);
});

test("recipient observation repairs a saved accepted projection after reload without another native claim",async()=>{
 const f=await protocolFixture();f.setRestoreFailure(true);
 const accepted=await createWildsWalletBearerGiftController(f.input).acceptSource(leg,f.descriptor,authority);
 assert.equal(accepted.status,"accepted");assert.equal(accepted.projectionPending,true);assert.equal(f.claims,1);
 f.setRestoreFailure(false);
 const repaired=await createWildsWalletBearerGiftController(f.input).observeSource(leg,f.descriptor,accepted.receipt,authority);
 assert.equal(repaired.status,"accepted");assert.equal(repaired.projectionPending,undefined);assert.equal(f.claims,1);assert.equal(f.restores,2);
});

test("prepared sender source is not reported delivered and unknown publication retries the exact private carrier",async()=>{
 const f=await protocolFixture();f.setOwner(leg.senderHandle);
 const input={...f.input,ownerHandle:leg.senderHandle,readMessages:async()=>[]},sender=createWildsWalletBearerGiftController(input);
 const descriptor=await sender.prepareSource(leg);
 assert.equal((await sender.observeSource(leg,descriptor,undefined,authority)).status,"none");assert.equal(f.messages.length,0);
 f.setPublication(false);assert.equal((await sender.sendSource(leg,descriptor,authority)).status,"pending");
 assert.equal((await createWildsWalletBearerGiftController(input).observeSource(leg,descriptor,undefined,authority)).status,"pending");
 f.setPublication(true);assert.equal((await createWildsWalletBearerGiftController(input).observeSource(leg,descriptor,undefined,authority)).status,"offered");
 assert.equal(f.claims,0);assert.equal(f.messages.length,3);
 for(const message of f.messages){assert.equal(message.kind,"trade-bearer-source");assert.equal(message.original.exactBytesB64u,f.f.original.exactBytesB64u);assert.deepEqual(message,f.messages[0]);}
});

test("both approval descriptors preserve current causal creature history and reject another keeper/source/projection",async()=>{
 const f=await fixture(),grown=evolvePortableCard({previous:creature,nextFormId:"mintcub-2",evolvedAt:"2026-07-15T13:00:00.000Z"});
 const projectionOriginal=await f.encodeProjection(grown);
 const source=await verifyWildsWalletBearerGiftSource({leg,original:f.original,projectionOriginal,artifacts:f.artifacts,assertSelection:async()=>undefined});
 const accepted=await verifyWildsWalletBearerGiftAccepted({leg,descriptor:source.descriptor,predecessor:f.original,successor:f.successor,projectionOriginal,acceptedNotBeforeKai:"10",artifacts:f.artifacts});
 assert.equal(canonicalPortableCardJson(accepted.projection.card),canonicalPortableCardJson(grown));assert.equal(accepted.projection.card.manifest.ownerReceizId,creature.manifest.ownerReceizId);
 assert.equal(accepted.descriptor.projectionCardDigest,source.descriptor.projectionCardDigest);
 for(const bad of [await f.encodeProjection(grown,"eve.receiz.id"),await f.encodeProjection(grown,leg.senderHandle,"f".repeat(64)),await f.encodeProjection(grown,leg.senderHandle,f.original.artifactSha256,"another-native-head")])await assert.rejects(verifyWildsWalletBearerGiftSource({leg,original:f.original,projectionOriginal:bad,artifacts:f.artifacts,assertSelection:async()=>undefined}),/keeper|source/);
 await assert.rejects(verifyWildsWalletBearerGiftAccepted({leg,descriptor:source.descriptor,predecessor:f.original,successor:f.successor,projectionOriginal:f.projectionOriginal,acceptedNotBeforeKai:"10",artifacts:f.artifacts}),/descriptor/);
});

test("durable exact source/projection reconstruction fails closed on quota/readback and never replaces an earlier snapshot",async()=>{
 const f=await fixture(),database=createMemoryWildzContinuityDatabase(),store=createWildsWalletBearerGiftRecoveryStore(database);
 const source={original:f.original,originProof:{fixture:true},projectionOriginal:f.projectionOriginal};
 database.failNextTransaction(new Error("QuotaExceededError"));await assert.rejects(store.retainSource(leg.senderHandle,"held-key",source),/Quota/);
 assert.equal(await store.readSource(leg.senderHandle,"held-key",source.original.artifactSha256,source.projectionOriginal.artifactSha256),null);
 await store.retainSource(leg.senderHandle,"held-key",source);
 const next={...source,projectionOriginal:await f.encodeProjection(evolvePortableCard({previous:creature,nextFormId:"mintcub-2",evolvedAt:"2026-07-15T13:00:00.000Z"}))};
 await store.retainSource(leg.senderHandle,"held-key",next);
 const cold=createWildsWalletBearerGiftRecoveryStore(database);
 assert.deepEqual(await cold.readSource(leg.senderHandle,"held-key",source.original.artifactSha256,source.projectionOriginal.artifactSha256),source);
 assert.deepEqual(await cold.readSource(leg.senderHandle,"held-key",next.original.artifactSha256,next.projectionOriginal.artifactSha256),next);
 assert.equal(await cold.readSource("eve.receiz.id","held-key",source.original.artifactSha256,source.projectionOriginal.artifactSha256),null);
 await assert.rejects(cold.retainSource(leg.senderHandle,"held-key",{...source,originProof:{edited:true}}),/different provenance/);
 const missingReadback=createWildsWalletBearerGiftRecoveryStore({...database,read:async()=>null});await assert.rejects(missingReadback.retainSource(leg.senderHandle,"held-key",source),/could not be saved/);
});

test("resource descriptors never reach a native creature claim",async()=>{
 const f=await protocolFixture(),resourceLeg={...leg,request:{...leg.request,asset:{kind:"package" as const,packageId:`wildz:package:${"c".repeat(64)}`}}};
 const receiver=createWildsWalletBearerGiftController(f.input);
 assert.equal((await receiver.acceptSource(resourceLeg,f.descriptor,authority)).status,"pending");assert.equal(f.claims,0);
});
