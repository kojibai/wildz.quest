import assert from "node:assert/strict";
import { test } from "node:test";
import { embedPortableCardInPng } from "../src/features/play/card-export";
import { sealCollectedCard, evolvePortableCard } from "../src/features/play/portable-card";
import { createWildzArtifactCodec, readWildzArtifactCrewCustody, canOperateWildzCrewCard, mergeWildzCrewCustody, wildzCrewCustodySources } from "../src/lib/receiz/wildz-artifact-codec";
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
  assert.match(effect, /\[identity\?\.keyId, identity\?\.actorId, continuity\?\.restoreEpoch, acceptSnapshot\]/);
  assert.doesNotMatch(effect, /inventory\]/);
});

test("roaming restore downloads the existing claimed artifact before any validation and never claims or reseals", async () => {
  const { readFileSync } = await import("node:fs");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const start = shell.indexOf("const restoreRoamingCapture = useCallback");
  const callback = shell.slice(start, shell.indexOf("const activateIdentitySeal", start));
  assert.ok(callback.indexOf("downloadBlob(") < callback.indexOf("await openWildzArtifactSameOrigin("));
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
