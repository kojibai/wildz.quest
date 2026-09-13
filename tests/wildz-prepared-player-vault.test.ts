import assert from "node:assert/strict";
import test from "node:test";
import { createReceizIdentityKeyFile } from "@receiz/sdk";
import { createWildzIdentityPlayerVaultPreparer, savePreparedWildzIdentityPlayerVault } from "../src/lib/receiz/wildz-prepared-player-vault";
import { requireWildzIdentityBindingFromEnvelope } from "../src/lib/receiz/wildz-identity-binding";
import { splitWildzPngEnvelope } from "../src/lib/receiz/wildz-png-envelope";
import { embedPortableVaultInPng, readPortableVaultFromPng, readWildzPlayerVaultAppendFromPng, verifyPortableVaultPng } from "../src/features/play/card-export";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { initialPlayState } from "../src/features/play/game-state";
import type { WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

async function fixture() {
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "full-vault-save", username: "keeper" } });
  const assets = ["first", "second"].map(encounterId => sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId, capturedAt: "2026-09-13T18:00:00.000Z" }));
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-09-13T18:01:00.000Z", playState: { ...initialPlayState, inventory: assets },
    settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const session = { keyId: identity.keyFile.keyId, username: "keeper", actorId: "keeper", localAuthority: "verified" } as WildzIdentitySession;
  return { identity, assets, player, session };
}

test("full Vault prepares once locally and preserves every captured card and signed player payload", async () => {
  const { identity, assets, player, session } = await fixture();
  let renders = 0, signatures = 0;
  const prepare = createWildzIdentityPlayerVaultPreparer({
    render: async (cards, state) => { renders++; return new Blob([embedPortableVaultInPng(png, cards, state)], { type: "image/png" }); },
    sign: async (_key, action) => { signatures++; return action(identity.keyFile); }
  });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Save must not call Record, Seal, or a remote verifier"); };
  try {
    const first = prepare(session, assets, player, { allowPrompt: false });
    assert.equal(prepare(session, assets, player), first);
    const saved = await first;
    assert.equal(await prepare(session, assets, player), saved);
    assert.deepEqual({ renders, signatures }, { renders: 1, signatures: 1 });
    const binding = await requireWildzIdentityBindingFromEnvelope(saved.bytes);
    assert.equal(binding.keyId, session.keyId);
    const { pngBasis } = splitWildzPngEnvelope(saved.bytes);
    assert.equal(verifyPortableVaultPng(pngBasis).ok, true);
    assert.deepEqual(readPortableVaultFromPng(pngBasis).assets.map(card => card.id), assets.map(card => card.id));
    assert.equal(readWildzPlayerVaultAppendFromPng(pngBasis).player.payloadDigest, player.payloadDigest);
    const { payloadDigest: _payloadDigest, schema: _schema, ...playerInput } = player;
    const later = createWildsPlayerVault({ ...playerInput, exportedAt: "2026-09-13T18:02:00.000Z" });
    assert.equal(await prepare(session, assets, later), saved);
    assert.deepEqual({ renders, signatures }, { renders: 1, signatures: 1 });
    const changed = createWildsPlayerVault({ ...playerInput, playState: { ...player.playState, player: { x: 9, z: 9 } } });
    assert.notEqual(await prepare(session, assets, changed), saved);
    assert.deepEqual({ renders, signatures }, { renders: 2, signatures: 2 });
  } finally { globalThis.fetch = oldFetch; }
});

test("full Vault refuses a substituted player or signing identity", async () => {
  const { identity, assets, player, session } = await fixture();
  const other = await createReceizIdentityKeyFile({ owner: { uid: "other-vault", username: "other" } });
  const wrongKey = createWildzIdentityPlayerVaultPreparer({
    render: async (cards, state) => new Blob([embedPortableVaultInPng(png, cards, state)]),
    sign: async (_key, action) => action(other.keyFile)
  });
  await assert.rejects(wrongKey(session, assets, player), /key_id_mismatch/);
  const { payloadDigest: _payloadDigest, schema: _schema, ...playerInput } = player;
  const changed = createWildsPlayerVault({ ...playerInput, exportedAt: "2026-09-13T18:05:00.000Z" });
  const wrongPayload = createWildzIdentityPlayerVaultPreparer({
    render: async cards => new Blob([embedPortableVaultInPng(png, cards, changed)]),
    sign: async (_key, action) => action(identity.keyFile)
  });
  await assert.rejects(wrongPayload(session, assets, player), /export_proof_invalid/);
});

test("a saved full Vault restores every captured card into the same active Receiz ID", async () => {
  const { identity, assets, player, session } = await fixture();
  const prepare = createWildzIdentityPlayerVaultPreparer({
    render: async (cards, state) => new Blob([embedPortableVaultInPng(png, cards, state)]),
    sign: async (_key, action) => action(identity.keyFile)
  });
  const saved = await prepare(session, assets, player);
  const { createMemoryWildzContinuityDatabase } = await import("./support/memory-wildz-continuity-database");
  const { createWildzArtifactCodec } = await import("../src/lib/receiz/wildz-artifact-codec");
  const { createWildzIdentityRepository } = await import("../src/lib/receiz/wildz-identity-repository");
  const { inspectReceizCommerceVault } = await import("../src/lib/receiz/receiz-commerce-vault");
  const { restoreWildzArtifactForSurface, wildzVaultUploadDisposition } = await import("../src/features/identity/wildz-restore");
  const { serializeReceizIdentityArtifact } = await import("@receiz/sdk");
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const codec = createWildzArtifactCodec({ identityRepository: repository, commerceVaultReader: { inspect: inspectReceizCommerceVault } });
  const opened = await codec.inspect({ bytes: saved.bytes, mimeType: saved.mimeType, name: saved.filename });
  assert.equal(opened.kind, "card-vault");
  assert.equal(wildzVaultUploadDisposition(opened, "keeper"), "merge-owned");
  await repository.bootstrap();
  await restoreWildzArtifactForSurface({ surface: "genesis", bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(identity.keyFile)),
    mimeType: "application/json", name: "keeper.receiz-key.json", codec, repository, database, confirmCardOnly: true });
  const restored = await restoreWildzArtifactForSurface({ surface: "card-vault", preserveActiveIdentity: true, bytes: saved.bytes,
    mimeType: saved.mimeType, name: saved.filename, codec, repository, database, confirmCardOnly: true });
  assert.equal(restored.session.keyId, session.keyId);
  for (const asset of assets) {
    assert.equal(restored.playState.inventory.filter(card => card.id === asset.id).length, 1);
  }
});

test("a prepared Vault invokes native file sharing synchronously with the exact bytes", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let invoked = false;
  let file: File | undefined;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    canShare: () => true,
    share: async (data: ShareData) => { invoked = true; file = data.files?.[0]; }
  } });
  try {
    const saving = savePreparedWildzIdentityPlayerVault({ bytes: png, filename: "vault.png", mimeType: "image/png", keyId: "test", ownerReceizId: "keeper", playerPayloadDigest: "test" });
    assert.equal(invoked, true);
    assert.equal(await saving, "native-share");
    assert.deepEqual(new Uint8Array(await file!.arrayBuffer()), png);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
