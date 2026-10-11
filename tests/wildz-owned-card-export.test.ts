import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdentityKeyFile } from "@receiz/sdk";
import { matchesWildzOwnedCardExport } from "../src/lib/receiz/wildz-owned-card-export";
import { createWildzIdentityBoundPlayerVault } from "../src/lib/receiz/wildz-identity-vault-binding";
import { embedPortableVaultInPng } from "../src/features/play/card-export";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { initialPlayState } from "../src/features/play/game-state";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

test("retained signed card matches only its full current card, owner and signing identity", async () => {
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "saved-card-test", username: "keeper" } });
  const asset = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "saved-card-test", capturedAt: "2026-07-15T21:00:00.000Z" }), "2026-07-15T21:00:00.000Z");
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-07-15T21:01:00.000Z", playState: { ...initialPlayState, inventory: [asset] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const bytes = await createWildzIdentityBoundPlayerVault({ keyFile: identity.keyFile, vaultBytes: embedPortableVaultInPng(png, [asset], player) });
  const current = { asset, keyId: identity.keyFile.keyId, ownerReceizId: "keeper" };
  assert.equal(await matchesWildzOwnedCardExport(bytes, current), true);
  assert.equal(await matchesWildzOwnedCardExport(bytes, { ...current, ownerReceizId: "next_keeper" }), false);
  assert.equal(await matchesWildzOwnedCardExport(bytes, { ...current, keyId: "different-key" }), false);
  await assert.rejects(matchesWildzOwnedCardExport(bytes, { ...current, asset: { ...asset, manifest: { ...asset.manifest, name: "Changed card" } } }));
  const corrupt = bytes.slice(); corrupt[40] ^= 1;
  await assert.rejects(matchesWildzOwnedCardExport(corrupt, current));
});

// These ports exercise preparation/caching, not cryptographic verification.
// Canonical verification is tested separately with the real SDK.
async function preparationFixture() {
  const { createWildzIdentityOwnedCardPreparer } = await import("../src/lib/receiz/wildz-identity-adapter");
  const { createMemoryWildzContinuityDatabase } = await import("./support/memory-wildz-continuity-database");
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "prepared-native-card", username: "keeper" } });
  const asset = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "native-save", capturedAt: "2026-07-15T21:00:00.000Z" }), "2026-07-15T21:00:00.000Z");
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-07-15T21:01:00.000Z", playState: { ...initialPlayState, inventory: [asset] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const session = { keyId: identity.keyFile.keyId, username: "keeper", actorId: "keeper", localAuthority: "verified" } as Parameters<ReturnType<typeof createWildzIdentityOwnedCardPreparer>>[0];
  const counts = { render: 0, seal: 0, verify: 0, open: 0 };
  let payload = new Uint8Array();
  const exact = new TextEncoder().encode("opaque SDK artifact test double");
  let failSeal = false, failVerify = false;
  const dependencies: Parameters<typeof createWildzIdentityOwnedCardPreparer>[0] = {
    database: createMemoryWildzContinuityDatabase(),
    sources: { read: async () => null, locateAsset: async () => { throw new Error("no source scan"); }, retain: async () => { throw new Error("unused"); } },
    renderCard: async () => { counts.render++; return new Blob([png], { type: "image/png" }); },
    sign: async (_key, action) => action(identity.keyFile),
    seal: async blob => {
      counts.seal++;
      if (failSeal) throw new Error("test_seal_failed");
      payload = new Uint8Array(await blob.arrayBuffer());
      return { bytes: exact, filename: "card.receized.png", mimeType: "image/png" };
    },
    verifySeal: async (bytes, expected) => {
      counts.verify++;
      if (failVerify) throw new Error("test_verification_failed");
      assert.deepEqual(bytes, exact); assert.deepEqual(expected, payload);
    },
    openSeal: async input => {
      counts.open++; assert.deepEqual(input.bytes, exact);
      return { artifactBytes: exact, artifactSha256: "a".repeat(64), payloadBytes: payload,
        payloadSha256: "b".repeat(64), filename: "card.receized.png", mimeType: "image/png",
        ownerReceizId: "keeper.receiz.id", claimId: "test", verifyPath: "/v/test", recordId: "test",
        compatibility: "current-native" };
    }
  };
  return { dependencies, counts, asset, player, session, exact, identity,
    prepare: createWildzIdentityOwnedCardPreparer(dependencies),
    reopen: () => createWildzIdentityOwnedCardPreparer(dependencies),
    failSeal: (value: boolean) => { failSeal = value; }, failVerify: (value: boolean) => { failVerify = value; } };
}

test("background preparation and Save share one seal and download only exact sealed bytes", async () => {
  const f = await preparationFixture();
  const [background, save] = await Promise.all([f.prepare(f.session, f.asset, f.player), f.prepare(f.session, f.asset, f.player)]);
  assert.equal(background, save);
  assert.deepEqual(save.bytes, f.exact);
  assert.deepEqual(f.counts, { render: 1, seal: 1, verify: 1, open: 1 });
  const reopened = await f.reopen()(f.session, f.asset, f.player);
  assert.deepEqual(reopened.bytes, f.exact);
  assert.equal(f.counts.seal, 1);
  assert.equal(f.counts.open, 2, "persisted artifact is independently reopened");
});

test("seal or verification failure cannot produce a downloadable card; a retry may succeed", async () => {
  const f = await preparationFixture();
  f.failSeal(true);
  await assert.rejects(f.prepare(f.session, f.asset, f.player), /test_seal_failed/);
  f.failSeal(false); f.failVerify(true);
  await assert.rejects(f.prepare(f.session, f.asset, f.player), /test_verification_failed/);
  f.failVerify(false);
  assert.deepEqual((await f.prepare(f.session, f.asset, f.player)).bytes, f.exact);
  assert.equal(f.counts.seal, 3);
});

test("old raw signed cache is not accepted as a prepared proof object", async () => {
  const f = await preparationFixture();
  const legacyKey = JSON.stringify(["wildz.prepared-local-card.v1", f.session.keyId, "keeper", f.asset.id]);
  await f.dependencies.database.transaction(["meta"], "readwrite", tx => tx.put("meta", { bytes: png, filename: "old.png", mimeType: "image/png" }, legacyKey));
  assert.deepEqual((await f.prepare(f.session, f.asset, f.player)).bytes, f.exact);
  assert.equal(f.counts.seal, 1);
  await assert.rejects(f.prepare(f.session, f.asset, { ...f.player, playerId: "someone_else" }), /owner_mismatch/);
});


test("locked background misses reject before card raster and can retry after unlock", async () => {
  const f = await preparationFixture();
  const unlocked = f.identity.keyFile;
  const locked = { ...unlocked, crypto: { ...unlocked.crypto, privateKeyPkcs8B64u: undefined, privateKeyPkcs8CiphertextB64u: "locked" } };
  let keyReads = 0;
  f.dependencies.sign = async (_key, action) => { keyReads++; return action(locked); };
  for (let i = 0; i < 3; i++) await assert.rejects(f.prepare(f.session, f.asset, f.player, { allowPrompt: false }), /passphrase_required/);
  assert.equal(f.counts.render, 0);
  assert.equal(f.counts.seal, 0);
  assert.equal(keyReads, 3);
  f.dependencies.sign = async (_key, action) => { keyReads++; return action(unlocked); };
  await f.prepare(f.session, f.asset, f.player);
  assert.equal(f.counts.render, 1);
  assert.equal(f.counts.seal, 1);
  assert.equal(keyReads, 4);
  f.dependencies.sign = async () => { throw new Error("saved artifact must precede key access"); };
  assert.deepEqual((await f.reopen()(f.session, f.asset, f.player, { allowPrompt: false })).bytes, f.exact);
});

test("raw input builds once on a cold miss and warm reuse still checks membership, owner, key and complete card", async () => {
  const f = await preparationFixture();
  let payloadReads = 0;
  const { schema: _schema, payloadDigest: _digest, ...input } = f.player;
  const raw = { ...input, get settings() { payloadReads++; return input.settings; } };
  const first = await f.prepare(f.session, f.asset, raw);
  assert.equal(payloadReads, 1, "one cold payload construction reads the carried settings");
  for (let i = 0; i < 4; i++) assert.equal(await f.prepare(f.session, f.asset, raw), first);
  assert.equal(payloadReads, 1, "warm exact artifact reuse does not construct another payload");
  assert.equal(f.counts.render, 1);
  await assert.rejects(f.prepare(f.session, f.asset, { ...input, playState: { ...input.playState, inventory: [] } }), /owner_mismatch/);
  await assert.rejects(f.prepare({ ...f.session, username: "other_keeper" }, f.asset, raw), /owner_mismatch/);
  await assert.rejects(f.prepare({ ...f.session, keyId: "other_key" }, f.asset, raw), /key_id_mismatch/);
  assert.equal(f.counts.render, 1, "wrong-key miss must reject before raster");
  const { appendLivingCardHistory } = await import("../src/features/play/living-card-proof");
  const changed = appendLivingCardHistory({ asset: f.asset, event: {
    eventId: "pressure-history-change", rulesetVersion: "wildz.progression.v1", occurredAt: "2026-07-15T21:02:00.000Z",
    source: { mode: "training", activityId: "pressure-practice", actorId: "keeper", authority: "local" },
    evidence: {}, effects: [{ kind: "progress", xpDelta: 1, growthEvents: [] }]
  } });
  await assert.rejects(f.prepare(f.session, changed, raw), /owner_mismatch/);
  const next = await f.prepare(f.session, changed, { ...input, playState: { ...input.playState, inventory: [changed] } });
  assert.notEqual(next.cardFingerprint, first.cardFingerprint);
  assert.equal(f.counts.render, 2);
});

test("an encrypted cold card can prompt and sign after a rejected nonprompt warmup", async () => {
  const f = await preparationFixture();
  const encrypted = await createReceizIdentityKeyFile({ owner: { uid: "passphrase-retry", username: "keeper" }, passphrase: "disposable fixture password" });
  const session = { ...f.session, keyId: encrypted.keyFile.keyId };
  let prompts = 0, reads = 0;
  f.dependencies.sign = async (_key, action) => { reads++; return action(encrypted.keyFile); };
  await assert.rejects(f.prepare(session, f.asset, f.player, { allowPrompt: false }), /passphrase_required/);
  assert.equal(f.counts.render, 0);
  const prepared = await f.prepare(session, f.asset, f.player, { requestPassphrase: () => { prompts++; return "disposable fixture password"; } });
  assert.equal(prepared.keyId, session.keyId);
  assert.deepEqual({ prompts, reads, renders: f.counts.render, seals: f.counts.seal }, { prompts: 1, reads: 2, renders: 1, seals: 1 });
});

test("Campaign background whole Vault checks a locked key before creating identity artwork", async () => {
  const { defaultIdentityRepository, prepareWildzBackgroundPlayerVault } = await import("../src/lib/receiz/wildz-identity-adapter");
  const f = await preparationFixture();
  const locked = { ...f.identity.keyFile, crypto: { ...f.identity.keyFile.crypto, privateKeyPkcs8B64u: undefined, privateKeyPkcs8CiphertextB64u: "locked" } };
  const original = defaultIdentityRepository.withKeyFile;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  let rasters = 0, reads = 0;
  defaultIdentityRepository.withKeyFile = async (_key, action) => { reads++; return action(locked); };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement() { rasters++; throw new Error("unexpected identity raster"); } } });
  try {
    for (let i = 0; i < 3; i++) await assert.rejects(prepareWildzBackgroundPlayerVault(f.session, [f.asset], f.player), /passphrase_required/);
    assert.deepEqual({ rasters, reads }, { rasters: 0, reads: 3 });
  } finally { defaultIdentityRepository.withKeyFile = original;
    if (descriptor) Object.defineProperty(globalThis, "document", descriptor); else Reflect.deleteProperty(globalThis, "document"); }
});

for (const firstAllowsPrompt of [true, false]) {
  test(`queued owned-card Save ${firstAllowsPrompt ? "retains" : "promotes"} its required passphrase callback across explicit joins`, async () => {
    const f = await preparationFixture();
    const password = "disposable queued save password";
    const encrypted = await createReceizIdentityKeyFile({ owner: { uid: "queued-passphrase", username: "keeper" }, passphrase: password });
    const session = { ...f.session, keyId: encrypted.keyFile.keyId };
    const other = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "queued-save", capturedAt: "2026-07-15T21:00:00.000Z" }), "2026-07-15T21:00:00.000Z");
    const player = { ...f.player, playState: { ...f.player.playState, inventory: [f.asset, other] } };
    let release!: () => void, entered!: () => void, reads = 0;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    f.dependencies.sign = async (_key, action) => { if (++reads === 1) { entered(); await gate; } return action(encrypted.keyFile); };
    const active = f.prepare(session, f.asset, player, { passphrase: password });
    await started;
    const prompts: string[] = [];
    const prompt = { speculative: false, requestPassphrase: () => { prompts.push(firstAllowsPrompt ? "original" : "promoted"); return password; } };
    const nonprompt = { speculative: false, allowPrompt: false };
    const requested = f.prepare(session, other, player, firstAllowsPrompt ? prompt : nonprompt);
    const joined = f.prepare(session, other, player, firstAllowsPrompt ? nonprompt : prompt);
    release();
    const [, saved, shared] = await Promise.all([active, requested, joined]);
    assert.equal(shared, saved);
    assert.equal(saved.assetId, other.id);
    assert.deepEqual(prompts, [firstAllowsPrompt ? "original" : "promoted"]);
    assert.deepEqual({ reads, renders: f.counts.render, seals: f.counts.seal }, { reads: 2, renders: 2, seals: 2 });
  });
}
