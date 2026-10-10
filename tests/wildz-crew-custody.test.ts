import assert from "node:assert/strict";
import { test } from "node:test";
import { embedPortableCardInPng } from "../src/features/play/card-export";
import { sealCollectedCard, evolvePortableCard } from "../src/features/play/portable-card";
import { createWildzArtifactCodec, readWildzArtifactCrewCustody, canOperateWildzCrewCard, mergeWildzCrewCustody, wildzCrewCustodySources,
  retainWildzCrewCustodyMemory, restoreWildzCrewCustodyMemory, readWildzNativeBearerCrewCustody } from "../src/lib/receiz/wildz-artifact-codec";
import { prepareWildsIncomingInventory } from "../src/features/play/wilds-incoming-inventory";
import { retainWildzInventoryMemory, restoreWildzInventoryMemory, wildzInventoryMemoryKey } from "../src/features/identity/wildz-inventory-memory";
import { reopenWildzCrewCustodyOffThread } from "../src/lib/receiz/wildz-crew-custody-client";
import { reopenWildzCrewCustody } from "../src/lib/receiz/wildz-crew-custody-source";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { createWildsCrewExpeditionGuard } from "../src/features/play/use-wilds-crew-expeditions";
import { setWildsCrewPreference } from "../src/features/play/wilds-crew-preferences";
import type { WildzArtifactHistoryEntry } from "../src/lib/receiz/wildz-artifact-history";
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "original", encounterId: "received-crew", capturedAt: "2026-07-15T12:00:00.000Z" });
const sourceBytes = new TextEncoder().encode(JSON.stringify({ kind: "receiz.bundle.v1" }));
const sourceSha = "a".repeat(64);
function fixture() {
  let opens = 0;
  const codec = createWildzArtifactCodec({ identityRepository: createWildzIdentityRepository({ database: createMemoryWildzContinuityDatabase() }),
    commerceVaultReader: { async inspect() { return null; } }, artifactOpener: { async open() { opens++;
      return { artifactBytes: sourceBytes, artifactSha256: sourceSha, payloadBytes: embedPortableCardInPng(png, card), payloadSha256: "b".repeat(64),
        filename: "card.receiz", mimeType: "image/png", ownerReceizId: "keeper", claimId: "claim", verifyPath: "/verify", recordId: "record", compatibility: "current-native" as const };
    } } });
  const history = { async read(): Promise<WildzArtifactHistoryEntry> { return { schema: "receiz.wildz.artifact_history.v119", artifactSha256: sourceSha, payloadSha256: "b".repeat(64), artifactBytes: sourceBytes,
    filename: "card.receiz", mimeType: "application/json", ownerReceizId: "keeper", claimId: "claim", verifyPath: "/verify", recordId: "record", compatibility: "current-native" }; } };
  return { codec, history, opens: () => opens };
}

test("received-card custody reopens from its authenticated exact head without inspecting the original Seal", async () => {
  const f = fixture(), database = createMemoryWildzContinuityDatabase(), owner = { keyId: "keeper-key", actorId: "keeper" };
  const token = readWildzArtifactCrewCustody(await f.codec.inspect({ bytes: sourceBytes, mimeType: "application/json" }));
  const grown = evolvePortableCard({ previous: card, nextFormId: "mintcub-2", evolvedAt: "2026-07-15T13:00:00.000Z" });
  const inventory = await prepareWildsIncomingInventory([grown]);
  await retainWildzInventoryMemory(database, owner, inventory);
  await retainWildzCrewCustodyMemory(database, owner, token, inventory);
  const cold = await restoreWildzInventoryMemory(database, owner, structuredClone(inventory));
  assert.ok(cold);
  const restored = await restoreWildzCrewCustodyMemory(database, owner, cold);
  assert.equal(canOperateWildzCrewCard(cold[0]!, owner.actorId, restored), true);
  assert.deepEqual(wildzCrewCustodySources(restored), [{ artifactSha256: sourceSha, assetIds: [grown.id] }]);
  assert.equal(f.opens(), 1);
  assert.equal(await restoreWildzCrewCustodyMemory(database, { ...owner, actorId: "other" }, cold), null);
  const changed = await prepareWildsIncomingInventory([{ ...grown, status: "listed" }]);
  assert.equal(await restoreWildzCrewCustodyMemory(database, owner, changed), null, "a different exact head requires its normal custody source");
});

test("lookalike custody tokens and edited source coordinates cannot grant retained authority", async () => {
  const f = fixture(), database = createMemoryWildzContinuityDatabase(), owner = { keyId: "keeper-key", actorId: "keeper" };
  const inventory = await prepareWildsIncomingInventory([structuredClone(card)]);
  await retainWildzCrewCustodyMemory(database, owner, { owner: "keeper" }, inventory);
  assert.equal(await restoreWildzCrewCustodyMemory(database, owner, inventory), null);
  const token = readWildzArtifactCrewCustody(await f.codec.inspect({ bytes: sourceBytes, mimeType: "application/json" }));
  await retainWildzCrewCustodyMemory(database, owner, token, inventory);
  const key = wildzInventoryMemoryKey(owner, "crew-custody");
  const memory = await database.read<Record<string, unknown>>("meta", key);
  assert.ok(memory);
  await database.transaction(["meta"], "readwrite", tx => tx.put("meta", { ...memory, coordinates: [JSON.stringify([card.id, "c".repeat(64)])] }, key));
  assert.equal(await restoreWildzCrewCustodyMemory(database, owner, inventory), null);
});

test("received custody memory does not depend on unrelated owner-native creature growth", async () => {
  const { createReceizIdentityKeyFile, serializeReceizIdentityArtifact } = await import("@receiz/sdk");
  const database = createMemoryWildzContinuityDatabase(), owner = { keyId: "mixed-memory-key", actorId: "keeper" };
  const own = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "own-crew", capturedAt: "2026-07-15T12:00:00.000Z" });
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "keeper", username: "keeper", displayName: "Keeper" }, portableState: { snapshot: { cards: [own, card] } } });
  const token = readWildzArtifactCrewCustody(await fixture().codec.inspect({ bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(keyFile)), mimeType: "application/json" }));
  assert.ok(token);
  const grown = evolvePortableCard({ previous: own, nextFormId: "mintcub-2", evolvedAt: "2026-07-15T13:00:00.000Z" });
  // A worker can observe the owner's later durable growth while the rendering
  // thread still holds its bootstrap snapshot. Foreign custody is unchanged.
  await retainWildzCrewCustodyMemory(database, owner, token, await prepareWildsIncomingInventory([grown, card]));
  const bootstrapCards = await prepareWildsIncomingInventory([own, card]);
  const retained = await restoreWildzCrewCustodyMemory(database, owner, bootstrapCards);
  assert.equal(canOperateWildzCrewCard(card, owner.actorId, retained), true);
  assert.equal(canOperateWildzCrewCard(own, owner.actorId, retained), true);
});

test("custody worker success must resolve through an authenticated head and transfers no archive", async () => {
  const f = fixture(), owner = { keyId: "keeper-key", actorId: "keeper" };
  const token = readWildzArtifactCrewCustody(await f.codec.inspect({ bytes: sourceBytes, mimeType: "application/json" }));
  let reads = 0, fallbacks = 0, terminated = 0;
  const worker = { onmessage: null as Worker["onmessage"], onerror: null as Worker["onerror"], onmessageerror: null as Worker["onmessageerror"],
    terminate: () => { terminated++; }, postMessage(value: unknown) {
      assert.deepEqual(value, owner, "only owner coordinates cross into the worker");
      queueMicrotask(() => worker.onmessage?.call(worker as unknown as Worker, { data: { ...owner, ok: true } } as MessageEvent));
    } };
  const restored = await reopenWildzCrewCustodyOffThread({ ...owner, username: "keeper", portableStateStatus: "verified" } as typeof owner, [card], async () => { fallbacks++; return token; }, {
    createWorker: () => worker, readMemory: async () => ++reads === 1 ? null : token
  });
  assert.equal(restored, token); assert.equal(reads, 2); assert.equal(fallbacks, 0); assert.equal(terminated, 1);
  reads = 0;
  assert.equal(await reopenWildzCrewCustodyOffThread(owner, [card], async () => { throw Error("no fallback after a completed read"); }, {
    createWorker: () => worker, readMemory: async () => null
  }), null, "a success flag alone never creates custody");
});

test("retained custody avoids workers and unavailable transport preserves source recovery", async () => {
  const f = fixture(), owner = { keyId: "keeper-key", actorId: "keeper" };
  const token = readWildzArtifactCrewCustody(await f.codec.inspect({ bytes: sourceBytes, mimeType: "application/json" }));
  assert.equal(await reopenWildzCrewCustodyOffThread(owner, [card], async () => { throw Error("retained head already exists"); }, {
    createWorker: () => { throw Error("a retained head must not start a worker"); }, readMemory: async () => token
  }), token);
  let recoveries = 0;
  assert.equal(await reopenWildzCrewCustodyOffThread(owner, [card], async () => { recoveries++; return token; }, {
    createWorker: () => { throw Error("worker transport unavailable"); }, readMemory: async () => null
  }), token);
  assert.equal(recoveries, 1);
});
test("native verified inspection admits received keeper and causal growth without another source read", async () => {
  const f = fixture();
  const inspected = await f.codec.inspect({ bytes: sourceBytes, mimeType: "application/json" });
  assert.equal(inspected.kind, "card-vault");
  const custody = readWildzArtifactCrewCustody(inspected);
  assert.ok(custody);
  assert.equal(canOperateWildzCrewCard(card, "keeper", custody), true);
  assert.equal(canOperateWildzCrewCard(card, "other", custody), false);
  assert.equal(canOperateWildzCrewCard(card, "keeper", { owner: "keeper" }), false);
  const grown = evolvePortableCard({ previous: card, nextFormId: "mintcub-2", evolvedAt: "2026-07-15T13:00:00.000Z" });
  assert.equal(canOperateWildzCrewCard(grown, "keeper", custody), true);
  const guard = createWildsCrewExpeditionGuard(() => ({ owner: "keeper", cards: [grown], custody }));
  assert.ok(guard.begin(grown.id));
  assert.equal(setWildsCrewPreference(undefined, [grown], "keeper", grown.id, "roam", custody)?.byAssetId[grown.id], "roam");
  assert.equal(setWildsCrewPreference(undefined, [grown], "keeper", grown.id, "follow", custody)?.byAssetId[grown.id], "follow");
  const forged = structuredClone(grown); forged.manifest.name = "forged";
  assert.equal(canOperateWildzCrewCard(forged, "keeper", custody), false);
  assert.equal(mergeWildzCrewCustody("keeper", [custody], []), null);
  assert.equal(f.opens(), 1);
});
test("bootstrap reopens only the recorded foreign source once and never scans original cards", async () => {
  const f = fixture();
  const inspected = await f.codec.inspect({ bytes: sourceBytes, mimeType: "application/json" });
  const refs = wildzCrewCustodySources(readWildzArtifactCrewCustody(inspected));
  const custody = await reopenWildzCrewCustody({ owner: "keeper", cards: [card], sources: [...refs, ...refs], history: f.history, codec: f.codec });
  assert.equal(canOperateWildzCrewCard(card, "keeper", custody), true);
  assert.equal(f.opens(), 2);
  const offline = { async read(): Promise<WildzArtifactHistoryEntry | null> { throw new Error("offline"); } };
  assert.equal(await reopenWildzCrewCustody({ owner: "original", cards: [card], sources: refs, history: offline, codec: f.codec }), null);
  assert.equal(canOperateWildzCrewCard(card, "original", null), true);
  assert.equal(f.opens(), 2);
  assert.equal(await reopenWildzCrewCustody({ owner: "keeper", cards: [card], sources: refs, history: offline, codec: f.codec }), null);
});

test("account reopening uses the Identity Seal only for crew missing verified source custody", async () => {
  const f = fixture();
  const inspected = await f.codec.inspect({ bytes: sourceBytes, mimeType: "application/json" });
  const sealCustody = readWildzArtifactCrewCustody(inspected);
  let sealReads = 0;
  const input = { owner: "keeper", cards: [card], sources: [], history: f.history, codec: f.codec,
    readIdentitySeal: async () => { sealReads++; return sealCustody; } };
  const restored = await reopenWildzCrewCustody(input);
  assert.equal(canOperateWildzCrewCard(card, "keeper", restored), true);
  assert.equal(sealReads, 1);

  sealReads = 0;
  const fromSources = await reopenWildzCrewCustody({ ...input, sources: wildzCrewCustodySources(sealCustody) });
  assert.equal(canOperateWildzCrewCard(card, "keeper", fromSources), true);
  assert.equal(sealReads, 0, "verified retained source already authorizes this exact crew card");

  const originalOwner = await reopenWildzCrewCustody({ ...input, owner: "original" });
  assert.equal(canOperateWildzCrewCard(card, "original", originalOwner), true);
  assert.equal(sealReads, 0, "original-owner crew never needs the embedded Vault reopened");
});

test("a claimed custody token cannot suppress needed Identity Seal verification", async () => {
  const f = fixture();
  let sealReads = 0;
  const input = { owner: "keeper", cards: [card], sources: [], history: f.history, codec: f.codec,
    readIdentitySeal: async () => { sealReads++; return { owner: "keeper" }; } };
  const restored = await reopenWildzCrewCustody(input);
  assert.equal(canOperateWildzCrewCard(card, "keeper", restored), false);
  assert.equal(sealReads, 1);
});

test("unavailable Identity Seal custody leaves foreign crew unavailable without losing original cards", async () => {
  const f = fixture();
  let sealReads = 0;
  const input = { owner: "keeper", cards: [card], sources: [], history: f.history, codec: f.codec,
    readIdentitySeal: async () => { sealReads++; throw new Error("offline"); } };
  const restored = await reopenWildzCrewCustody(input);
  assert.equal(canOperateWildzCrewCard(card, "keeper", restored), false);
  assert.equal(canOperateWildzCrewCard(card, "original", restored), true);
  assert.equal(sealReads, 1);
});

test("successful restore persists its exact admitted source atomically and saved removal clears that reference", async () => {
  const { createReceizIdentityKeyFile } = await import("@receiz/sdk");
  const { restoreWildzArtifactForSurface, saveWildzRestoredPlayState } = await import("../src/features/identity/wildz-restore");
  const { wildzCrewCustodySourceKey } = await import("../src/lib/receiz/wildz-crew-custody-source");
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "keeper-user", username: "keeper", displayName: "Keeper" }, portableState: null });
  const prepared = await repository.prepare(identity.keyFile);
  await database.transaction(["identities", "meta"], "readwrite", tx => repository.writePrepared(tx, prepared, true));
  const f = fixture();
  const inspection = await f.codec.inspect({ bytes: sourceBytes, mimeType: "application/json" });
  const sidecar = evolvePortableCard({ previous: card, nextFormId: "mintcub-2", evolvedAt: "2026-07-15T13:00:00.000Z" });
  const forged = structuredClone(sidecar); forged.manifest.name = "forged";
  await assert.rejects(restoreWildzArtifactForSurface({ surface: "card-vault", bytes: sourceBytes, mimeType: "application/json", inspection,
    codec: f.codec, repository, database, confirmCardOnly: true, preserveActiveIdentity: true, roamingCaptureCard: forged }), /wildz_roaming_sidecar_invalid/);
  const restored = await restoreWildzArtifactForSurface({ surface: "card-vault", bytes: sourceBytes, mimeType: "application/json", inspection,
    codec: f.codec, repository, database, confirmCardOnly: true, preserveActiveIdentity: true, roamingCaptureCard: sidecar });
  assert.equal(canOperateWildzCrewCard(restored.playState.inventory[0]!, "keeper", restored.crewCustody), true);
  assert.deepEqual(restored.playState.inventory[0], sidecar);
  const key = wildzCrewCustodySourceKey(prepared.session.keyId, prepared.session.actorId);
  const sources = await database.read("meta", key);
  assert.deepEqual(sources, [{ artifactSha256: sourceSha, assetIds: [card.id] }]);
  const reloaded = await reopenWildzCrewCustody({ owner: "keeper", cards: restored.playState.inventory, sources, codec: f.codec, history: f.history });
  assert.equal(canOperateWildzCrewCard(restored.playState.inventory[0]!, "keeper", reloaded), true);
  await saveWildzRestoredPlayState({ database, session: restored.session, playState: { ...restored.playState, inventory: [], selectedAssetId: "", selectedCardId: "" } });
  assert.deepEqual(await database.read("meta", key), []);
});

test("bootstrap paints before optional custody reopening and inventory updates cannot trigger network scans", async () => {
  const { readFileSync } = await import("node:fs");
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  const bootstrap = adapter.slice(adapter.indexOf("export async function bootstrapWildzContinuity("), adapter.indexOf("export async function reopenWildzContinuityCrewCustody("));
  assert.doesNotMatch(bootstrap, /await reopenWildzCrewCustody/);
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const start = shell.indexOf("void reopenWildzContinuityCrewCustody(snapshot)");
  const effect = shell.slice(start, shell.indexOf("\n\n", start));
  assert.match(effect, /current\.session\.keyId !== snapshot\.session\.keyId/);
  assert.match(effect, /current\.restoreEpoch !== snapshot\.restoreEpoch/);
  assert.match(effect, /\[worldPainted, identity\?\.keyId, identity\?\.actorId, continuity\?\.restoreEpoch, acceptSnapshot\]/);
  assert.doesNotMatch(effect, /inventory\]/);
});

test("roaming restore verifies before downloading the exact claimed artifact and never claims or reseals", async () => {
  const { readFileSync } = await import("node:fs");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const start = shell.indexOf("const restoreRoamingCapture = useCallback");
  const callback = shell.slice(start, shell.indexOf("const activateIdentitySeal", start));
  assert.ok(callback.indexOf("downloadBlob(") > callback.indexOf("await openWildzArtifactSameOrigin("));
  assert.match(callback, /opened\.ownershipWitness\.ownerReceizId/);
  assert.match(callback, /validateWildsRoamingHandoffCard\(opened\.payloadBytes, sidecar\)/);
  assert.match(callback, /defaultWildzProofSourceRepository\.retain/);
  assert.match(callback, /"merge-vault", prepared, sidecar/);
  assert.doesNotMatch(callback, /claimBearer|createProofObject|prepareWildzIdentityOwnedCard|savePreparedWildzIdentityOwnedCard/);
});

test("roaming restore fences post-commit shell acceptance and merges the latest same-account state", async () => {
  const { readFileSync } = await import("node:fs");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const start = shell.indexOf("const restoreArtifact = useCallback");
  const callback = shell.slice(start, shell.indexOf("const restoreRoamingCapture", start));
  const awaited = callback.indexOf("await restoreWildzFileForSurface(");
  const guard = callback.indexOf("if (roamingCaptureCard)", awaited);
  assert.ok(guard > awaited && guard < callback.indexOf("acceptSnapshot(next)"));
  assert.match(callback.slice(guard), /latest\.session\.keyId !== current\.session\.keyId/);
  assert.match(callback.slice(guard), /latest\.restoreEpoch !== current\.restoreEpoch/);
  assert.match(shell, /restoreArtifact\(file, "card-vault", true, latest\.playState \?\? currentPlayState, "merge-vault", prepared, sidecar\)/);
});

test("a verified identity snapshot admits received crew without admitting unsigned sidecars", async () => {
  const { createReceizIdentityKeyFile, serializeReceizIdentityArtifact } = await import("@receiz/sdk");
  const { verifyAndAdmitWildsCard } = await import("../src/features/play/admitted-inventory");
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "keeper", username: "keeper", displayName: "Keeper" }, portableState: { snapshot: { cards: [card] } } });
  const f = fixture();
  const inspected = await f.codec.inspect({ bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(identity.keyFile)), mimeType: "application/json" });
  assert.equal(inspected.kind, "identity-seal");
  const custody = readWildzArtifactCrewCustody(inspected);
  assert.ok(custody);
  const admitted = structuredClone(card);
  assert.equal(verifyAndAdmitWildsCard(admitted), true);
  for (let i = 0; i < 100; i++) assert.equal(canOperateWildzCrewCard(admitted, "keeper", custody), true);
  const unrelated = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "original", encounterId: "not-in-snapshot", capturedAt: "2026-07-15T12:00:00.000Z" });
  assert.equal(canOperateWildzCrewCard(unrelated, "keeper", custody), false);
  const mutable = structuredClone(card);
  assert.equal(canOperateWildzCrewCard(mutable, "keeper", custody), true);
  mutable.manifest.name = "tampered after first check";
  assert.equal(canOperateWildzCrewCard(mutable, "keeper", custody), false);
  assert.ok(createWildsCrewExpeditionGuard(() => ({ owner: "keeper", cards: [admitted], custody })).begin(admitted.id));
});


test("native crew recovery rejects unsigned memory, another held key, edited admission and forged root Originals",async()=>{
 const {receizBase64UrlEncode,sha256ReceizBytes}=await import("@receiz/sdk");
 const {canonicalPortableCardJson}=await import("../src/features/play/portable-card");
 const database=createMemoryWildzContinuityDatabase(),bytes=new TextEncoder().encode("unsigned forged native gift"),sha=await sha256ReceizBytes(bytes);
 const original={schema:"receiz.sealed-artifact-bytes.v124",exactBytesB64u:receizBase64UrlEncode(bytes),filename:"forged.receizbundle",mimeType:"application/json",artifactSha256:sha,payloadSha256:sha};
 const source={schema:"wildz.native-bearer-crew-source.v128",keyId:"held-key",applicationId:"registered-client",original,originProof:{accepted:true},projectionOriginal:original};
 const sourceKey=JSON.stringify(["wildz.native-bearer-crew-source.v128",sha]),memoryKey=JSON.stringify(["wildz.native-bearer-crew-admission.v128",sha]);
 await database.transaction(["artifacts"],"readwrite",tx=>tx.put("artifacts",source,sourceKey));
 assert.equal(await readWildzNativeBearerCrewCustody(database,sha,{keyId:"held-key",actorId:"keeper.receiz.id"}),null);
 await assert.rejects(readWildzNativeBearerCrewCustody(database,sha,{keyId:"another-key",actorId:"keeper.receiz.id"}),/binding/);
 const key=await crypto.subtle.generateKey({name:"HMAC",hash:"SHA-256",length:256},false,["sign","verify"]);
 const digest=async(value:unknown)=>sha256ReceizBytes(new TextEncoder().encode(canonicalPortableCardJson(value)));
 const basis={schema:"wildz.native-bearer-crew-admission.v128",keyId:source.keyId,applicationId:source.applicationId,ownerHandle:"keeper.receiz.id",artifactSha256:sha,originProofDigest:await digest(source.originProof),projectionArtifactSha256:sha,sourceDigest:await digest(source)};
 const signature=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(canonicalPortableCardJson(basis)).buffer));
 await database.transaction(["wrappingKeys","meta"],"readwrite",async tx=>{await tx.put("wrappingKeys",key,"wildz.native-bearer-crew-admission-key.v128");await tx.put("meta",{...basis,signature},memoryKey);});
 // Even a correctly authenticated local cache cannot turn fake root bytes into
 // an SDK-admitted native successor or mint a crew token.
 await assert.rejects(readWildzNativeBearerCrewCustody(database,sha,{keyId:"held-key",actorId:"keeper.receiz.id"}),/artifact|verif|seal|bundle/i);
 await database.transaction(["meta"],"readwrite",tx=>tx.put("meta",{...basis,applicationId:"edited-client",signature},memoryKey));
 assert.equal(await readWildzNativeBearerCrewCustody(database,sha,{keyId:"held-key",actorId:"keeper.receiz.id"}),null);
 assert.equal(await readWildzNativeBearerCrewCustody(database,sha,{keyId:"held-key",actorId:"another.receiz.id"}),null);
});
