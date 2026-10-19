import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendReceizIdentityArtifactTrailerToPng,
  createReceizIdentityKeyFile,
  projectReceizIdentityAccount,
  sha256ReceizBytes,
  signReceizIdentityLoginProof
} from "@receiz/sdk";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { withWildzPngPayloadChunk } from "../src/features/play/card-export";
import { canonicalPortableCardJson, sealCollectedCard } from "../src/features/play/portable-card";
import {
  loadWildzRestoredOwnerState,
  restoreWildzArtifactForSurface,
  saveWildzRestoredPlayState
} from "../src/features/identity/wildz-restore";
import { createWildzArtifactCodec } from "../src/lib/receiz/wildz-artifact-codec";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

test("the July 9 Receiz writer's sealed PNG plus identity trailer authenticates after gameplay was saved", async () => {
  const target = setup();
  const original = await target.repository.bootstrap();
  const currentPlayState = { ...createOwnerBoundInitialPlayState(original.actorId), player: { x: 75, z: 125 } };
  await saveWildzRestoredPlayState({ ...target, session: original, playState: currentPlayState });
  const identity = await createReceizIdentityKeyFile({ issuedAt: "2026-07-09T12:00:00.000Z",
    owner: { uid: "july-identity", username: "july_keeper" }, portableState: null });
  // Match the unsegmented signed portable state used by the historical writer.
  const state = { schema: "receiz.account.state.v3", exportedAt: "2026-07-09T12:00:00.000Z", snapshot: { profile: { username: "july_keeper" } } };
  const canonicalState = canonicalPortableCardJson(state);
  const signed = await signReceizIdentityLoginProof({ keyFile: identity.keyFile, challengeText: canonicalState });
  identity.keyFile.portableState = { ...state, proof: { method: "ed25519.jcs.v1",
    digestSha256Hex: await sha256ReceizBytes(new TextEncoder().encode(canonicalState)), signatureB64u: signed.signatureB64Url, signedAt: state.exportedAt } };
  assert.equal((await projectReceizIdentityAccount(identity.keyFile)).portableStateStatus, "verified");
  // The historical Receiz writer sealed the artwork first, then appended the
  // owner-only Key after IEND. The document does not bind the appended Key.
  const sealedPng = withWildzPngPayloadChunk(BASE_PNG, "receiz.proof_bundle", "document-proof-fixture");
  const originalSeal = appendReceizIdentityArtifactTrailerToPng(sealedPng, identity.keyFile);
  const codec = createWildzArtifactCodec({ identityRepository: target.repository, commerceVaultReader: { inspect: async () => null },
    // The existing SDK document verifier is its own crypto boundary. Exercise
    // the codec with an admitted document while keeping real identity crypto.
    documentOpener: async input => {
      assert.deepEqual(input.bytes, sealedPng, "the document verifier must receive its exact PNG, without the independent identity trailer");
      return { payloadBytes: BASE_PNG, payloadFilename: "identity_record.png", payloadMimeType: "image/png",
        payloadSha256: "a".repeat(64), sealedArtifactSha256: "b".repeat(64), exactSealedArtifactBytes: sealedPng };
    } });
  const outcome = await restoreWildzArtifactForSurface({ ...target, codec, surface: "card-vault", bytes: originalSeal,
    mimeType: "image/png", confirmCardOnly: false, carryCurrentVault: true, currentPlayState });
  assert.equal(outcome.session.actorId, "july_keeper");
  assert.equal(outcome.session.portableStateStatus, "verified");
  assert.deepEqual(outcome.playState.player, { x: 75, z: 125 });
  assert.deepEqual(outcome.playState.inventory.map(card => card.id), currentPlayState.inventory.map(card => card.id));
  assert.equal((await target.repository.active())?.keyId, identity.keyId);
});

for (const failure of ["wildz_artifact_verification_failed", "wildz_document_native_custody_required"]) {
  test(`a historical Identity trailer cannot bypass ${failure}`, async () => {
    const target = setup();
    const original = await target.repository.bootstrap();
    const identity = await createReceizIdentityKeyFile({ owner: { uid: "trailer-identity", username: "trailer_keeper" } });
    const sealedPng = withWildzPngPayloadChunk(BASE_PNG, "receiz.proof_bundle", "document-proof-fixture");
    const codec = createWildzArtifactCodec({ identityRepository: target.repository, commerceVaultReader: { inspect: async () => null },
      documentOpener: async () => { throw new Error(failure); } });
    await assert.rejects(restoreWildzArtifactForSurface({ ...target, codec, surface: "card-vault",
      bytes: appendReceizIdentityArtifactTrailerToPng(sealedPng, identity.keyFile), mimeType: "image/png", confirmCardOnly: false }), /wildz_restore_/);
    assert.equal((await target.repository.active())?.keyId, original.keyId);
    assert.equal(target.database.dump().identities.length, 1);
  });
}

function setup() {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const codec = createWildzArtifactCodec({ identityRepository: repository, commerceVaultReader: { inspect: async () => null } });
  return { database, repository, codec };
}

for (const shape of ["wide", "deep"] as const) {
  test(`a signed Receiz account with ${shape} non-Wildz history still activates and imports its verified cards`, async () => {
    const target = setup();
    const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "external_history", encounterId: `external-${shape}`, capturedAt: "2025-01-01T12:00:00.000Z" });
    let history: unknown = Array.from({ length: 10_001 }, (_, index) => ({ eventId: `receiz-event-${index}` }));
    if (shape === "deep") {
      history = { eventId: "nested-receiz-event" };
      for (let index = 0; index < 20; index += 1) history = { predecessor: history };
    }
    const identity = await createReceizIdentityKeyFile({
      issuedAt: "2025-01-01T12:00:00.000Z",
      owner: { uid: "external-history", username: "external_history" },
      portableState: { snapshot: { schema: "receiz.account.state.v3", actionLedger: history, cards: [card] } }
    });
    const bytes = appendReceizIdentityArtifactTrailerToPng(BASE_PNG, identity.keyFile);
    const outcome = await restoreWildzArtifactForSurface({ ...target, surface: "genesis", bytes, mimeType: "image/png", confirmCardOnly: false });
    assert.equal(outcome.session.actorId, "external_history");
    assert.equal(outcome.session.portableStateStatus, "verified");
    assert.deepEqual(outcome.verifiedAssetIds, [card.id]);
    assert.deepEqual(outcome.playState.inventory.map(asset => asset.id), [card.id]);
  });
}

for (const invalidProof of ["wrong-digest", "malformed-signature", "malformed-digest"] as const) {
test(`a Receiz Seal with ${invalidProof} still fails without changing saved gameplay`, async () => {
  const target = setup();
  const original = await target.repository.bootstrap();
  const playState = { ...createOwnerBoundInitialPlayState(original.actorId), worldMastery: 37 };
  await saveWildzRestoredPlayState({ ...target, session: original, playState });
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "invalid-external", username: "invalid_external" }, portableState: { snapshot: { profile: {} } } });
  if (invalidProof === "malformed-signature") identity.keyFile.portableState!.proof!.signatureB64u = "!";
  else identity.keyFile.portableState!.proof!.digestSha256Hex = invalidProof === "malformed-digest" ? "0" : "0".repeat(64);
  await assert.rejects(restoreWildzArtifactForSurface({ ...target, surface: "card-vault",
    bytes: new TextEncoder().encode(JSON.stringify(identity.keyFile)), mimeType: "application/json",
    confirmCardOnly: false, carryCurrentVault: true, currentPlayState: playState }), /wildz_restore_portable_signature_invalid/);
  assert.equal((await target.repository.active())?.keyId, original.keyId);
  assert.equal((await loadWildzRestoredOwnerState({ ...target, session: original }))?.playState.worldMastery, 37);
});
}
