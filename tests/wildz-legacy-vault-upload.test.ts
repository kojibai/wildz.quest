import assert from "node:assert/strict";
import test from "node:test";
import { createReceizIdentityKeyFile, serializeReceizIdentityArtifact } from "@receiz/sdk";
import { embedPortableVaultInPng } from "../src/features/play/card-export";
import { initialPlayState } from "../src/features/play/game-state";
import { portableCardBaseProofAsset, sealCollectedCard } from "../src/features/play/portable-card";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { restoreWildzArtifactForSurface, wildzVaultUploadDisposition } from "../src/features/identity/wildz-restore";
import { createWildzArtifactCodec } from "../src/lib/receiz/wildz-artifact-codec";
import { createWildzIdentityRepository, type WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";
import { createWildzIdentityPlayerVaultPreparer } from "../src/lib/receiz/wildz-prepared-player-vault";
import { inspectReceizCommerceVault } from "../src/lib/receiz/receiz-commerce-vault";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

test("verified older portable cards restore locally into a different active Vault without native bearer claiming", async () => {
  const source = await createReceizIdentityKeyFile({ owner: { uid: "legacy-source", username: "legacyowner" } });
  const destination = await createReceizIdentityKeyFile({ owner: { uid: "legacy-destination", username: "recipient" } });
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "legacyowner", encounterId: "legacy-upload", capturedAt: "2026-09-12T12:00:00.000Z" });
  const player = createWildsPlayerVault({ playerId: "legacyowner", exportedAt: "2026-09-12T12:00:00.000Z", playState: { ...initialPlayState, inventory: [card] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const prepare = createWildzIdentityPlayerVaultPreparer({
    render: async (assets, state) => new Blob([embedPortableVaultInPng(png, assets, state)], { type: "image/png" }),
    sign: async (_keyId, action) => action(source.keyFile)
  });
  const artifact = await prepare({ keyId: source.keyFile.keyId, username: "legacyowner", actorId: "legacyowner", localAuthority: "verified" } as WildzIdentitySession, [card], player);
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const codec = createWildzArtifactCodec({ identityRepository: repository, commerceVaultReader: { inspect: inspectReceizCommerceVault } });
  await repository.bootstrap();
  await restoreWildzArtifactForSurface({ surface: "genesis", bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(destination.keyFile)), mimeType: "application/json", name: "identity.json", codec, repository, database, confirmCardOnly: true });
  const fetcher = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Portable restore must not request native claim or remote sealing"); };
  try {
    const inspection = await codec.inspect({ bytes: artifact.bytes, mimeType: "image/png", name: "older-card.png" });
    assert.equal(inspection.kind, "card-vault");
    if (inspection.kind !== "card-vault") throw new Error("card required");
    assert.equal(inspection.proofObject, null);
    assert.equal(wildzVaultUploadDisposition(inspection, "recipient"), "restore-portable");
    const restored = await restoreWildzArtifactForSurface({ surface: "card-vault", preserveActiveIdentity: true, bytes: artifact.bytes, mimeType: "image/png", name: "older-card.png", inspection, codec, repository, database, confirmCardOnly: true });
    assert.equal(restored.session.keyId, destination.keyFile.keyId);
    const copies = restored.playState.inventory.filter(asset => asset.id === card.id);
    assert.equal(copies.length, 1);
    assert.deepEqual(portableCardBaseProofAsset(copies[0]!), card);
    assert.equal(inspection.proofObject, null, "restoration must not fabricate native custody evidence");
  } finally { globalThis.fetch = fetcher; }
});
