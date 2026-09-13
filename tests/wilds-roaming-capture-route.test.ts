import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { receizBase64UrlEncode } from "@receiz/sdk";
import { createWildsRoamingCaptureHandler } from "../src/lib/receiz/wilds-roaming-capture-route";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { embedPortableCardInPng, embedPortableVaultInPng } from "../src/features/play/card-export";
import type { WildsRoamingEncounter } from "../src/features/play/wilds-roaming-encounter";
import type { WildsRoamingBattle } from "../src/features/play/wilds-roaming-battle";
import type { WildzAdmittedArtifact } from "../src/lib/receiz/wildz-artifact-custody";
import type { WildsRoamingHandoff } from "../src/lib/receiz/wilds-roaming-handoff";
import type { WildsRoamingClaimResult, WildsStoredRoamingHandoff } from "../src/lib/receiz/wilds-roaming-capture-store";
import { KAI_PULSE_DURATION_MS } from "../src/features/play/kai-klok-moment";

const card = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "owner", encounterId: "defender", capturedAt: "2026-09-13T12:00:00.000Z" });
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const payload = embedPortableCardInPng(png, card);
const exact = new TextEncoder().encode("EXACT_CLAIMED_NATIVE_BYTES");
const sourceWire = { exactBytesB64u: receizBase64UrlEncode(new TextEncoder().encode("PRIVATE_ORIGINAL_BEARER")), filename: "source.receized", mimeType: "application/octet-stream" };
const expires = 100 + Math.ceil(120_000 / KAI_PULSE_DURATION_MS * 1_000_000);
function request(action: string, body: unknown = { battleId: "roaming:test" }) {
  return new NextRequest(`https://wildz.quest/api/wilds/roaming/capture?action=${action}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

// Coordinator/native ports are mocked here: these tests verify HTTP authorization,
// privacy, fixed windows and recovery, not SDK cryptographic issuance.
function fixture() {
  let actor = { playerId: "owner", handle: "owner", receizActorId: "receiz:owner", practice: false, accessToken: "test" };
  let now = 101, claims = 0, offers = 0, seals = 0, opens = 0;
  let recovered: WildsRoamingClaimResult | null = null;
  const encounter = { id: "roaming:test", defenderId: "owner", defenderAssetId: card.id, defenderAsset: card, challengerAsset: card,
    challenger: { playerId: "winner", handle: "winner", receizId: "receiz:winner" }, cancelled: false,
    ownerAcknowledgedRevision: 4, session: { outcome: "capture-eligible", revision: 4, kaiUPulse: 100 } as WildsRoamingBattle } as { -readonly [K in keyof WildsRoamingEncounter]: WildsRoamingEncounter[K] };
  const admitted = { artifactBytes: exact, artifactSha256: "a".repeat(64), payloadBytes: payload, payloadSha256: "b".repeat(64), filename: "claimed.receized",
    mimeType: "application/octet-stream", ownerReceizId: "winner.receiz.id", compatibility: "current-native", claimId: "claim", verifyPath: "/v", recordId: "record",
    ownershipWitness: { ownerReceizId: "winner.receiz.id", previousOwnerReceizId: "owner.receiz.id" } } as { -readonly [K in keyof WildzAdmittedArtifact]: WildzAdmittedArtifact[K] };
  const handoff = { schema: "wildz.roaming-handoff.v1", battleId: encounter.id, assetId: card.id, source: { ...sourceWire, artifactSha256: "c".repeat(64) },
    winnerHandle: "winner", previousOwnerHandle: "owner", currentCard: card } as WildsRoamingHandoff;
  const stored: WildsStoredRoamingHandoff = { schema: "wildz.roaming-capture-transport.v1", battleId: encounter.id, ownerPlayerId: "owner",
    winnerPlayerId: "winner", winnerReceizId: "receiz:winner", expiresAtUPulse: expires, handoff };
  type Overrides = NonNullable<Parameters<typeof createWildsRoamingCaptureHandler>[0]>;
  const dependencies: Overrides = {
    resolveWildsMultiplayerActor: async () => actor,
    createReceizCommerceAdapter: (() => ({ client: { assets: {}, artifacts: {}, appState: {} } })) as Overrides["createReceizCommerceAdapter"],
    readWildsRoamingEncounter: async () => encounter,
    recordWildsRoamingCaptureState: async () => encounter,
    observeWildsKaiUPulse: () => now,
    openWildzArtifactEvidence: (async () => { opens++; return { admitted, sealedArtifact: {} }; }) as unknown as Overrides["openWildzArtifactEvidence"],
    prepareWildsRoamingHandoff: async () => handoff,
    storeWildsRoamingHandoff: async (_origin, _owner, value) => { offers++; assert.equal(value.expiresAtUPulse, expires); },
    readWildsStoredRoamingHandoff: async () => stored,
    readWildsRoamingClaimResult: async () => recovered,
    claimWildsRoamingHandoff: async () => { claims++; return { admitted, currentCard: card }; },
    storeWildsRoamingClaimResult: async (_origin, result) => { recovered = result; },
    publishWildzOwnershipSyncProjection: async () => "admitted",
    createWildzExportProofObject: (async () => { seals++; return { admitted }; }) as unknown as Overrides["createWildzExportProofObject"]
  };
  return { dependencies, handler: createWildsRoamingCaptureHandler(dependencies), encounter, admitted, stored,
    setActor: (id: string, receizId = `receiz:${id}`) => { actor = { ...actor, playerId: id, handle: id, receizActorId: receizId }; },
    setNow: (value: number) => { now = value; }, counts: () => ({ claims, offers, seals, opens }) };
}

test("only acknowledged defender win releases offer; HTTP response never includes original bearer bytes", async () => {
  const f = fixture(); f.setActor("winner");
  assert.equal((await f.handler(request("offer", { battleId: f.encounter.id, source: sourceWire, currentCard: card }))).status, 400);
  f.setActor("owner"); f.encounter.ownerAcknowledgedRevision = 3;
  assert.equal((await f.handler(request("offer", { battleId: f.encounter.id, source: sourceWire, currentCard: card }))).status, 400);
  f.encounter.ownerAcknowledgedRevision = 4;
  const response = await f.handler(request("offer", { battleId: f.encounter.id, source: sourceWire, currentCard: card }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, ready: true });
  assert.equal(f.counts().offers, 1); assert.equal(f.counts().claims, 0);
});

test("only exact winning identity claims; successful retry reopens persisted successor without second claim", async () => {
  const f = fixture(); f.setActor("winner", "receiz:imposter");
  assert.equal((await f.handler(request("claim"))).status, 400); assert.equal(f.counts().claims, 0);
  f.setActor("winner"); const first = await f.handler(request("claim"));
  assert.equal(first.status, 200); assert.equal((await first.json()).artifact.exactBytesB64u, receizBase64UrlEncode(exact));
  f.setNow(expires + 1); const retry = await f.handler(request("claim"));
  assert.equal(retry.status, 200); assert.equal(f.counts().claims, 1); assert.equal(f.counts().opens, 1);
});

test("offer and claim expire at fixed final-battle Kai deadline, not request time", async () => {
  const f = fixture(); f.setNow(expires);
  assert.equal((await f.handler(request("offer", { battleId: f.encounter.id, source: sourceWire, currentCard: card }))).status, 409);
  f.setActor("winner"); assert.equal((await f.handler(request("claim"))).status, 409);
  assert.equal(f.counts().claims, 0); assert.equal(f.counts().offers, 0);
});

test("persisted result must still carry matching card history and native winning owner", async () => {
  const f = fixture(); f.setActor("winner"); await f.handler(request("claim"));
  f.admitted.ownerReceizId = "other.receiz.id";
  assert.equal((await f.handler(request("claim"))).status, 400); assert.equal(f.counts().claims, 1);
});

test("prepare rejects a Vault/private payload before SDK sealing; single-card output remains binary", async () => {
  const f = fixture(); const vault = embedPortableVaultInPng(payload, [card]);
  const send = (bytes: Uint8Array) => new NextRequest("https://wildz.quest/api/wilds/roaming/capture?action=prepare", { method: "POST", body: bytes.slice().buffer,
    headers: { "content-type": "image/png", "x-wildz-artifact-filename": "card.png" } });
  assert.equal((await f.handler(send(vault))).status, 400); assert.equal(f.counts().seals, 0);
  const good = await f.handler(send(payload)); assert.equal(good.status, 200); assert.equal(f.counts().seals, 1);
  assert.deepEqual(new Uint8Array(await good.arrayBuffer()), exact);
});

test("native claim failure returns only an error, never the opponent's original source", async () => {
  const f = fixture(); f.setActor("winner");
  const handler = createWildsRoamingCaptureHandler({ ...f.dependencies, claimWildsRoamingHandoff: async () => { throw new Error("native_unavailable"); } });
  const response = await handler(request("claim"));
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: "native_unavailable" });
});

test("captured encounter without retained native successor never issues a second claim", async () => {
  const f = fixture(); f.setActor("winner");
  assert.equal((await f.handler(request("claim"))).status, 200);
  f.encounter.capturePhase = "captured";
  const reloaded = createWildsRoamingCaptureHandler({ ...f.dependencies, readWildsRoamingClaimResult: async () => null });
  const response = await reloaded(request("claim"));
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: "wilds_capture_recovery_pending" });
  assert.equal(f.counts().claims, 1);
});
