#!/usr/bin/env node
/** Live, nonfinancial proof probe. Uses fresh test identity/state, never a saved player.
 * Run pnpm test first to compile the actual app export helpers into .test-build.
 * This is evidence of first sealing, not subject admission or crew activation.
 */
import { access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  RECEIZ_DEFAULT_BASE_URL, RECEIZ_RELEASE_VERSION, RECEIZ_RULESET_VERSION,
  createReceizClient, createReceizIdentityKeyFile, verifyReceizArtifact,
  admitReceizArtifact, sha256ReceizBytes, signReceizIdentityLoginProof,
  verifyReceizIdentityLoginProof, digestReceizCanonicalV122
} from "@receiz/sdk";

const arguments_ = process.argv.slice(2);
if (arguments_.length !== 1 || arguments_[0] !== "--live-disposable") {
  console.log("Run pnpm test, then node scripts/receiz-crew-disposable-proof.mjs --live-disposable. This uploads a newly generated test vault to the configured RECEIZ_BASE_URL (default receiz.com). No saved identity, cards, wallet, or credentials are read.");
  process.exit(arguments_.length === 0 || arguments_[0] === "--help" ? 0 : 1);
}

const root = fileURLToPath(new URL("../", import.meta.url));
const base = new URL(process.env.RECEIZ_BASE_URL || RECEIZ_DEFAULT_BASE_URL);
if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash
  || (base.pathname !== "/" && base.pathname !== "")) throw new Error("disposable_seal_base_url_invalid");
const endpoint = new URL("/api/document-seal", base);
const code = (value) => typeof value === "string" && /^[A-Za-z0-9_:-]{1,160}$/.test(value) ? value : "unclassified_failure";
const report = (value) => console.log(JSON.stringify(value));

async function appModule(path) {
  const compiled = resolve(process.env.WILDZ_DISPOSABLE_COMPILED_ROOT || resolve(root, ".test-build"), "src", path);
  try { await access(compiled); } catch { throw new Error("disposable_compiled_helpers_missing_run_pnpm_test"); }
  return import(pathToFileURL(compiled).href);
}

async function run() {
  if (RECEIZ_RELEASE_VERSION !== "126.0.0" || RECEIZ_RULESET_VERSION !== "126.0.0")
    throw new Error("disposable_sdk126_required");
  const [{ embedPortableVaultInPng }, { createOwnerBoundInitialPlayState }, { createWildsPlayerVault },
    { createWildzIdentityBoundPlayerVault }, { requireWildzIdentityBindingFromEnvelope }] = await Promise.all([
    appModule("features/play/card-export.js"), appModule("features/play/game-state.js"),
    appModule("features/play/wilds-player-vault.js"), appModule("lib/receiz/wildz-identity-vault-binding.js"),
    appModule("lib/receiz/wildz-identity-binding.js")
  ]);
  const username = `crew_test_${crypto.randomUUID().slice(0, 8)}`;
  const passphrase = crypto.randomUUID();
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: crypto.randomUUID(), username }, passphrase
  });
  const playState = createOwnerBoundInitialPlayState(username);
  const player = createWildsPlayerVault({ playerId: username, exportedAt: new Date().toISOString(), playState,
    settings: { avatarStyle: "female", movementMode: "walk", audio: {}, cardOrder: "rarity" },
    personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const payload = await createWildzIdentityBoundPlayerVault({ keyFile: identity.keyFile, passphrase,
    vaultBytes: embedPortableVaultInPng(png, playState.inventory, player) });
  const binding = await requireWildzIdentityBindingFromEnvelope(payload);
  if (binding.keyId !== identity.keyId || binding.playerId !== username)
    throw new Error("disposable_signed_owner_mismatch");
  const ownerReceizId = `${binding.playerId}.receiz.id`;
  const payloadDigest = await sha256ReceizBytes(payload);
  const form = new FormData();
  form.set("file", new File([payload], "wildz-crew-disposable.png", { type: "image/png" }));
  form.set("visualStamp", "0");
  // PNG reconstruction may normalize or omit post-IEND Identity trailers.
  // The enclosing bundle must carry the exact signed payload without rewriting.
  form.set("forceBundleEnvelope", "1");
  form.set("nativeOwnership", "1");
  // A fresh fixture only: never reuse this as migration of an existing creature.
  form.set("nativeRecordSeal", JSON.stringify({ ownerReceizId, recordId: `wildz:crew-disposable:${payloadDigest}` }));
  report({ stage: "upload", endpoint: endpoint.href, disposable: true, sdk: RECEIZ_RELEASE_VERSION });
  const response = await fetch(endpoint, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    report({ stage: "seal", ok: false, httpStatus: response.status, code: code(body?.error) });
    process.exitCode = 1;
    return;
  }
  const sealed = new Uint8Array(await response.arrayBuffer());
  const verification = await verifyReceizArtifact(sealed);
  if (verification.status !== "verified-artifact") throw new Error("disposable_enclosing_proof_invalid");
  const admission = await admitReceizArtifact(verification, { profile: "document" });
  if (admission.verdict !== "verified-document" || admission.ownerReceizId !== ownerReceizId
    || admission.payloadSha256 !== payloadDigest || verification.continuity.state !== "verified"
    || verification.continuity.ownerReceizId !== ownerReceizId || verification.continuity.historyComplete !== true)
    throw new Error("disposable_native_source_binding_invalid");
  // Demonstrate retained test-key custody without claiming this substitutes for
  // source-family PBI verification or owner confirmation of an actual mandate.
  const challengeText = await digestReceizCanonicalV122({ schema: "wildz.crew.disposable-proof-confirmation.v1",
    artifactSha256: admission.artifactSha256 });
  const signature = await signReceizIdentityLoginProof({ keyFile: identity.keyFile, passphrase, challengeText });
  const signed = await verifyReceizIdentityLoginProof({ keyFile: identity.keyFile,
    challengeB64Url: signature.challengeB64Url, signatureB64Url: signature.signatureB64Url });
  if (!signed) throw new Error("disposable_test_signature_invalid");
  report({ stage: "seal", ok: true, httpStatus: response.status, bytes: sealed.length,
    verifiedDocument: true, verifiedNativeOwner: true, completeNativeHistory: true,
    testKeySignatureVerified: true, mandateConfirmationVerified: false });
  const [{ createWildzArtifactCodec }, { createWildzIdentityRepository }, { createMemoryWildzContinuityDatabase },
    { inspectReceizCommerceVault }, { openWildzArtifact }, { verifyWildzSealedExport, openWildzSealedDocument },
    { restoreWildzArtifactForSurface }, { verifyProofSealedWildzVault }, { createWildzProofSourceRepository }] = await Promise.all([
    appModule("lib/receiz/wildz-artifact-codec.js"), appModule("lib/receiz/wildz-identity-repository.js"),
    appModule("../tests/support/memory-wildz-continuity-database.js"), appModule("lib/receiz/receiz-commerce-vault.js"),
    appModule("lib/receiz/wildz-artifact-custody.js"), appModule("lib/receiz/wildz-sealed-document.js"),
    appModule("features/identity/wildz-restore.js"), appModule("lib/receiz/wildz-proof-sealed-vault.js"),
    appModule("lib/receiz/wildz-proof-source-repository.js")
  ]);
  const offlineClient = createReceizClient({ fetchImpl: async () => { throw new Error("disposable_restore_network_disabled"); } });
  const database = createMemoryWildzContinuityDatabase();
  const identityRepository = createWildzIdentityRepository({ database });
  const sourceRepository = createWildzProofSourceRepository(database);
  const codec = createWildzArtifactCodec({
    identityRepository,
    sealedDocumentStore: sourceRepository,
    commerceVaultReader: { inspect: inspectReceizCommerceVault },
    artifactOpener: { open: (input) => openWildzArtifact(new File([input.bytes], input.name || "test.receizbundle",
      { type: input.mimeType }), input.name || "test.receizbundle", offlineClient.artifacts) }
  });
  async function restoreExactly(artifactBytes, mimeType, stage) {
    await verifyWildzSealedExport(artifactBytes, payload);
    if (stage === "document") await openWildzSealedDocument({ bytes: artifactBytes, mimeType, name: "test.receizbundle" });
    const restored = await codec.inspect({ bytes: artifactBytes, mimeType, name: "test.receizbundle" });
    if (restored.kind !== "card-vault" || restored.identity?.session.username !== username
      || restored.playerBinding !== "identity-v3-binding" || restored.player?.payloadDigest !== player.payloadDigest
      || JSON.stringify(restored.assets.map((card) => [card.id, card.proof.digest]))
        !== JSON.stringify(playState.inventory.map((card) => [card.id, card.proof.digest])))
      { report({ stage, restoredKind: restored.kind, code: restored.kind === "invalid" ? restored.code : null });
        throw new Error(`disposable_${stage}_restore_failed`); }
    await verifyProofSealedWildzVault({ bytes: artifactBytes, mimeType, name: "test.receizbundle", codec,
      verifier: { verifyArtifact: async () => { throw new Error("disposable_verifier_network_disabled"); } } });
    await restoreWildzArtifactForSurface({ surface: "genesis", bytes: artifactBytes, mimeType, name: "test.receizbundle",
      inspection: restored, codec, database, repository: identityRepository, confirmCardOnly: false });
    if ((await identityRepository.active())?.keyId !== identity.keyId) throw new Error("disposable_local_identity_activation_failed");
    if (stage === "document") {
      const retained = await sourceRepository.read(await sha256ReceizBytes(artifactBytes));
      if (retained.artifact.exactBytesB64u !== Buffer.from(artifactBytes).toString("base64url"))
        throw new Error("disposable_restored_source_not_retained");
    }
    report({ stage, exactIdentityAndCardsRestored: true, localIdentityActivated: true, networkEnabled: false });
  }
  await restoreExactly(sealed, response.headers.get("content-type") || "application/vnd.receiz.bundle+json", "native");
  // The production export path preserves existing ownership rather than creating
  // new native genesis. Verify that its ordinary enclosing document restores too.
  form.delete("nativeOwnership");
  form.delete("nativeRecordSeal");
  const documentResponse = await fetch(endpoint, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
  if (!documentResponse.ok) throw new Error(`disposable_document_seal_http_${documentResponse.status}`);
  await restoreExactly(new Uint8Array(await documentResponse.arrayBuffer()),
    documentResponse.headers.get("content-type") || "application/vnd.receiz.bundle+json", "document");
  // Deliberately no environment token fallback: this generated identity has no
  // delegated subject access grant. Report the real SDK boundary honestly.
  try {
    const result = await createReceizClient({ baseUrl: base.origin, applicationId: "wildz",
      fetchImpl: async () => { throw new Error("disposable_subject_network_disabled"); }
    }).subjects.admit({
      proofObject: { exactBytes: sealed, filename: "wildz-crew-disposable.receized.png", mimeType: response.headers.get("content-type") || "image/png" },
      ownerReceizId, idempotencyKey: `wildz:crew-disposable:${admission.artifactSha256}`, expectedAbsent: true
    });
    report({ stage: "subjectAdmissionPreflight", ok: result.ok, code: result.ok ? "unexpected_local_result" : code(result.code), networkEnabled: false, crewLive: false });
  } catch (error) {
    report({ stage: "subjectAdmissionPreflight", ok: false, code: code(error?.code || error?.message), networkEnabled: false, crewLive: false });
  }
  // All generated private signing material dies with this process. No fixture
  // keys, passphrases, payloads or returned artifact bytes are written or logged.
}

run().catch((error) => { report({ ok: false, code: code(error?.code || error?.message) }); process.exitCode = 1; });
