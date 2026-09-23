import { assertWildzRemoteSealPayloadSafe } from "../src/lib/receiz/wildz-remote-seal-guard";
import { sealCollectedCard } from "../src/features/play/portable-card";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdentityKeyFile, verifyReceizArtifact, readReceizIdentityArtifact } from "@receiz/sdk";
import { packWildzCardSealPayload, unpackWildzCardSealPayload } from "../src/lib/receiz/wildz-card-seal-payload";
import { withWildzPngPayloadChunk, embedPortableVaultInPng, createReceizProofObjectArtifact } from "../src/features/play/card-export";
import { createWildzIdentityBoundPlayerVault } from "../src/lib/receiz/wildz-identity-vault-binding";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { initialPlayState } from "../src/features/play/game-state";
import { openWildzSealedCard } from "../src/lib/receiz/wildz-sealed-card";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

test("seal payload preserves the complete signed envelope and unknown PNG namespaces byte-for-byte", async () => {
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "seal-payload-test", username: "keeper" } });
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "payload-test", capturedAt: "2026-09-23T21:00:00.000Z" });
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-09-23T21:00:00.000Z", playState: { ...initialPlayState, inventory: [card] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const source = withWildzPngPayloadChunk(png, "other.application", "preserve exactly");
  const signed = await createWildzIdentityBoundPlayerVault({ keyFile: identity.keyFile, vaultBytes: embedPortableVaultInPng(source, [card], player) });
  await assert.rejects(assertWildzRemoteSealPayloadSafe(signed), /private_identity_requires_local_sealing/);
  const originalFetch = globalThis.fetch;
  let uploads = 0;
  globalThis.fetch = async () => { uploads++; throw new Error("unexpected upload"); };
  try {
    await assert.rejects(createReceizProofObjectArtifact(new Blob([signed.slice().buffer], { type: "image/png" }),
      "private-vault.png", "vault"), /wildz_local_signer_storage_unavailable/);
    assert.equal(uploads, 0);
  } finally { globalThis.fetch = originalFetch; }
  await assertWildzRemoteSealPayloadSafe(png);
  const packed = await packWildzCardSealPayload(signed);
  await assert.rejects(assertWildzRemoteSealPayloadSafe(packed), /private_identity_requires_local_sealing/);
  assert.deepEqual(await unpackWildzCardSealPayload(packed), signed);
  assert.equal((await readReceizIdentityArtifact(packed)).keyId, identity.keyFile.keyId, "standard SDK readers can find the carried identity");
  await assert.rejects(packWildzCardSealPayload(packed), /already_packed/);
  const tampered = withWildzPngPayloadChunk(packed, "other.application", "changed");
  await assert.rejects(unpackWildzCardSealPayload(tampered), /binding_invalid/);
  assert.notEqual((await verifyReceizArtifact(packed)).status, "verified-artifact", "packing cannot create a canonical seal");
  await assert.rejects(openWildzSealedCard({ bytes: packed, mimeType: "image/png" }), /verification_failed/);
});
