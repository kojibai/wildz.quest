import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReceizOpenedArtifact, ReceizSealedArtifact } from "@receiz/sdk";
import { claimWildsRoamingHandoff, prepareWildsRoamingHandoff, validateWildsRoamingHandoffCard, type WildsRoamingHandoff } from "../src/lib/receiz/wilds-roaming-handoff";
import { openWildzArtifactEvidence } from "../src/lib/receiz/wildz-artifact-custody";
import { embedPortableCardInPng, embedPortableVaultInPng } from "../src/features/play/card-export";
import { sealCollectedCard, evolvePortableCard, type PortableCardAsset } from "../src/features/play/portable-card";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { receizBase64UrlEncode } from "@receiz/sdk";
import { createWildsRoamingBattle, submitWildsRoamingBattleIntent } from "../src/features/play/wilds-roaming-battle";

const at = "2026-09-13T12:00:00.000Z";
const base = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "former", encounterId: "base", capturedAt: at });
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const payload = embedPortableCardInPng(png, base);
const originalBytes = new TextEncoder().encode("original-artifact");
const claimedBytes = new TextEncoder().encode("claimed-artifact");

async function digest(bytes: Uint8Array) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)).toString("hex");
}

async function sealed(bytes: Uint8Array, ownerReceizId: string): Promise<ReceizSealedArtifact> {
  const payloadSha256 = await digest(payload);
  const claimId = `claim-${ownerReceizId}`;
  const ownershipWitness = ownerReceizId === "keeper.receiz.id" ? {
    state: "verified",
    carrier: "portable_asset",
    artifactId: payloadSha256,
    headReference: claimId,
    ownerReceizId,
    namespace: `receiz.native-proof:${payloadSha256}`,
    priorHeadReference: "claim-former.receiz.id",
    genesisOwnerReceizId: "former.receiz.id",
    historyDigestSha256: "c".repeat(64),
    appendCount: 1,
    historyComplete: true,
    history: [
      {
        schema: "receiz.native_ownership_genesis.v1",
        index: 0,
        ownerReceizId: "former.receiz.id",
        headReference: "claim-former.receiz.id",
        historyDigestSha256: "b".repeat(64)
      },
      {
        schema: "receiz.native_ownership_transfer.v1",
        index: 1,
        fromOwnerReceizId: "former.receiz.id",
        toOwnerReceizId: ownerReceizId,
        priorHeadReference: "claim-former.receiz.id",
        sourceArtifactSha256: "a".repeat(64),
        headReference: claimId,
        historyDigestSha256: "c".repeat(64)
      }
    ]
  } : undefined;
  return {
    kind: "receiz.native-record-seal",
    artifact: new Blob([bytes.slice().buffer], { type: "application/vnd.receiz.artifact" }),
    filename: "owned.receized",
    mimeType: "application/json",
    artifactSha256: await digest(bytes),
    payloadSha256,
    continuity: {
      carrier: "native-record-seal",
      ownerReceizId,
      recordId: "record-owned",
      claimId,
      verifyPath: `/v/claim-${ownerReceizId}`,
      signatureVersion: 4
    },
    verification: {
      ok: true,
      integrity: { ok: true, errors: [] },
      kind: "bundle",
      errors: [],
      warnings: [],
      bundle: ownerReceizId === "keeper.receiz.id" ? {
        kaiPulseEternal: "13661156000000",
        ts: "2026-08-16T04:24:45.768Z",
        nativeRecordSeal: {
          ownershipContinuity: {
            schema: "receiz.native_ownership_continuity.v1",
            artifactId: payloadSha256,
            namespace: `receiz.native-proof:${payloadSha256}`,
            genesisOwnerReceizId: "former.receiz.id",
            ownerReceizId,
            headReference: claimId,
            historyDigestSha256: "c".repeat(64),
            appendCount: 1
          }
        }
      } : {},
      assetContinuity: ownershipWitness
    }
  } as unknown as ReceizSealedArtifact;
}

async function opened(value: ReceizSealedArtifact): Promise<ReceizOpenedArtifact> {
  return {
    sealedArtifact: value,
    verifiedPayload: {
      bytes: payload.slice(),
      filename: "payload.json",
      mimeType: "application/json",
      sha256: await digest(payload)
    },
    verification: value.verification,
    legacyCompatibility: "current-native"
  } as unknown as ReceizOpenedArtifact;
}


// Native-rail mocks exercise application bindings, not cryptographic issuance.
async function fixture(claimedOwner = "keeper.receiz.id") {
  const original = await sealed(originalBytes, "former.receiz.id"), claimed = await sealed(claimedBytes, claimedOwner);
  let claims = 0;
  const port = { artifacts: {
    async verifyAndOpen(file: Blob) { return opened(new Uint8Array(await file.arrayBuffer()).length === originalBytes.length ? original : claimed); },
    async download(artifact: ReceizSealedArtifact) { return { ok: true as const, filename: artifact.filename, mimeType: artifact.mimeType,
      size: artifact.artifact.size, artifactSha256: artifact.artifactSha256 }; }
  }, ownership: { async claimBearerAsset(input: { artifact: ReceizOpenedArtifact["sealedArtifact"] }) { assert.equal(input.artifact, original); claims++; return claimed; } } };
  const handoff: WildsRoamingHandoff = { schema: "wildz.roaming-handoff.v1", battleId: "battle", winnerHandle: "keeper", previousOwnerHandle: "former",
    assetId: base.id, source: { exactBytesB64u: receizBase64UrlEncode(originalBytes), artifactSha256: await digest(originalBytes), filename: original.filename,
      mimeType: original.mimeType }, currentCard: admitLegacyCard(base, at) };
  return { original, claimed, port, handoff, claims: () => claims };
}

test("single source accepts exact card and causal sidecar, rejecting unrelated cards and Vault payloads", () => {
  assert.equal(validateWildsRoamingHandoffCard(payload, base).id, base.id);
  const descendant = admitLegacyCard(base, at);
  assert.equal(validateWildsRoamingHandoffCard(payload, descendant).proof.digest, base.proof.digest);
  const unrelated = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "former", encounterId: "unrelated", capturedAt: at });
  assert.throws(() => validateWildsRoamingHandoffCard(payload, unrelated), /history_mismatch/);
  assert.throws(() => validateWildsRoamingHandoffCard(embedPortableVaultInPng(payload, [base]), descendant), /card_invalid|not_single_card/);
});

test("source stays unreleased until a legal replayed win; handoff carries exact source and whole descendant", async () => {
  const f = await fixture(); const source = (await openWildzArtifactEvidence(f.original.artifact, f.original.filename, f.port.artifacts)).admitted;
  let challenger: PortableCardAsset = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "keeper", encounterId: "challenger", capturedAt: at });
  challenger = evolvePortableCard({ previous: challenger, nextFormId: "voltray-2", evolvedAt: at });
  challenger = evolvePortableCard({ previous: challenger, nextFormId: "voltray-3", evolvedAt: at });
  const assets = { challengerAsset: challenger, defenderAsset: base };
  let battle = createWildsRoamingBattle({ ...assets, challengerId: "keeper", defenderId: "former", sessionId: "roaming:test", kaiUPulse: 100, at });
  const input = { source, currentCard: f.handoff.currentCard, ownerHandle: "former", winnerHandle: "keeper", ...assets };
  await assert.rejects(prepareWildsRoamingHandoff({ ...input, battle }), /not_eligible/);
  while (battle.outcome === "active") battle = submitWildsRoamingBattleIntent(battle, { ...assets, sessionId: battle.sessionId, actorId: "keeper",
    expectedTurn: battle.battle.turn, expectedRevision: battle.revision, intentId: `turn:${battle.revision}`, intent: { type: "ability", slot: 1 }, kaiUPulse: battle.kaiUPulse + 1, at });
  assert.equal(battle.outcome, "capture-eligible");
  const handoff = await prepareWildsRoamingHandoff({ ...input, battle });
  assert.equal(handoff.source.exactBytesB64u, receizBase64UrlEncode(originalBytes));
  assert.deepEqual(handoff.currentCard, f.handoff.currentCard);
  await assert.rejects(prepareWildsRoamingHandoff({ ...input, battle, winnerHandle: "intruder" }), /not_eligible/);
});

test("claim reopens original native source and exact successor, preserving original payload and living sidecar", async () => {
  const f = await fixture(); const result = await claimWildsRoamingHandoff({ handoff: f.handoff, winnerHandle: "keeper", port: f.port });
  assert.equal(f.claims(), 1); assert.deepEqual(result.admitted.artifactBytes, claimedBytes);
  assert.deepEqual(result.admitted.payloadBytes, payload); assert.deepEqual(result.currentCard, f.handoff.currentCard);
  assert.equal(result.admitted.ownershipWitness?.ownerReceizId, "keeper.receiz.id");
});

test("recipient mismatch or substituted source fails before native claim", async () => {
  const f = await fixture();
  await assert.rejects(claimWildsRoamingHandoff({ handoff: f.handoff, winnerHandle: "intruder", port: f.port }), /binding_invalid/);
  await assert.rejects(claimWildsRoamingHandoff({ handoff: { ...f.handoff, source: { ...f.handoff.source, exactBytesB64u: "eA" } }, winnerHandle: "keeper", port: f.port }), /digest_mismatch/);
  assert.equal(f.claims(), 0);
});

test("reverified native successor for another owner cannot satisfy winner claim", async () => {
  const f = await fixture(); const handoff = { ...f.handoff, winnerHandle: "other" };
  await assert.rejects(claimWildsRoamingHandoff({ handoff, winnerHandle: "other", port: f.port }), /claim_binding_invalid/);
});

test("browser first seal uses same-origin verification and retains exact bytes before returning", async () => {
  const { createWildsRoamingOwnerFilePreparer } = await import("../src/lib/receiz/wilds-roaming-source-browser");
  const f = await fixture(); const openedSource = (await openWildzArtifactEvidence(f.original.artifact, f.original.filename, f.port.artifacts)).admitted;
  let creates = 0, retained = 0;
  const prepare = createWildsRoamingOwnerFilePreparer({
    sources: { locateAsset: async () => ({ artifactSha256s: [], nextCursor: null }), read: async () => null,
      retain: async input => { assert.deepEqual(input.bytes, originalBytes); retained++; return { schema: "receiz.sealed-artifact-bytes.v124", artifactSha256: openedSource.artifactSha256, payloadSha256: openedSource.payloadSha256, exactBytesB64u: receizBase64UrlEncode(input.bytes), filename: input.filename, mimeType: input.mimeType }; } },
    renderCard: async () => new Blob([payload.slice().buffer], { type: "image/png" }),
    fetch: async url => {
      if (String(url).includes("action=prepare")) { creates++; return new Response(originalBytes.slice().buffer); }
      const { artifactBytes: _artifactBytes, payloadBytes: _payloadBytes, ...coordinates } = openedSource;
      return Response.json({ ...coordinates, payloadBase64Url: receizBase64UrlEncode(payload) });
    }
  });
  const [a, b] = await Promise.all([prepare(base, "former"), prepare(base, "former")]);
  assert.equal(a, b); assert.equal(creates, 1); assert.equal(retained, 1); assert.deepEqual(a.artifactBytes, originalBytes);
});

test("browser missing retained source fails closed without minting a replacement", async () => {
  const { createWildsRoamingOwnerFilePreparer } = await import("../src/lib/receiz/wilds-roaming-source-browser");
  let creates = 0;
  const prepare = createWildsRoamingOwnerFilePreparer({ sources: {
    locateAsset: async () => ({ artifactSha256s: ["a".repeat(64)], nextCursor: null }), read: async () => null,
    retain: async () => { throw new Error("must not retain"); }
  }, fetch: async () => { creates++; throw new Error("must not create"); } });
  await assert.rejects(prepare(base, "former"), /source_missing/); assert.equal(creates, 0);
});

test("owner release cannot roll current living state back behind the battle's pinned defender", async () => {
  const f = await fixture(); const source = (await openWildzArtifactEvidence(f.original.artifact, f.original.filename, f.port.artifacts)).admitted;
  let challenger: PortableCardAsset = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "keeper", encounterId: "challenger", capturedAt: at });
  challenger = evolvePortableCard({ previous: challenger, nextFormId: "voltray-2", evolvedAt: at });
  challenger = evolvePortableCard({ previous: challenger, nextFormId: "voltray-3", evolvedAt: at });
  const assets = { challengerAsset: challenger, defenderAsset: admitLegacyCard(base, at) };
  let battle = createWildsRoamingBattle({ ...assets, challengerId: "keeper", defenderId: "former", sessionId: "roaming:test", kaiUPulse: 100, at });
  while (battle.outcome === "active") battle = submitWildsRoamingBattleIntent(battle, { ...assets, sessionId: battle.sessionId, actorId: "keeper",
    expectedTurn: battle.battle.turn, expectedRevision: battle.revision, intentId: `turn:${battle.revision}`, intent: { type: "ability", slot: 1 }, kaiUPulse: battle.kaiUPulse + 1, at });
  assert.equal(battle.outcome, "capture-eligible");
  await assert.rejects(prepareWildsRoamingHandoff({ source, currentCard: base, ownerHandle: "former", winnerHandle: "keeper", battle, ...assets }), /battle_history_mismatch/);
});
