import assert from "node:assert/strict";
import test from "node:test";
import { prepareWildzProfilePublication } from "../src/lib/receiz/wildz-profile-signing-client";
import type { WildzProfileSigningInput } from "../src/lib/receiz/wildz-profile-signing";

class FakeWorker {
  terminated = false;
  posted: unknown;
  onmessage?: (event: { data: unknown }) => void;
  onerror?: (event: { preventDefault(): void }) => void;
  postMessage(value: unknown) { this.posted = value; }
  terminate() { this.terminated = true; }
}

test("profile worker receives proof input without inline signing and terminates on completion or cancellation", async () => {
  const oldWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  try {
    const input = { profile: { username: "@worker" } } as WildzProfileSigningInput;
    const worker = new FakeWorker();
    const pending = prepareWildzProfilePublication(input, undefined, () => worker as unknown as Worker);
    assert.deepEqual(worker.posted, { input, admittedCards: false });
    const result = { profile: input.profile, body: "signed in worker" };
    worker.onmessage!({ data: { ok: true, result } });
    assert.equal(await pending, result);
    assert.equal(worker.terminated, true);
    const cancelled = new FakeWorker();
    const controller = new AbortController();
    const aborting = prepareWildzProfilePublication(input, controller.signal, () => cancelled as unknown as Worker);
    controller.abort(new Error("profile revision retired"));
    await assert.rejects(aborting, /profile revision retired/);
    assert.equal(cancelled.terminated, true);
    const failed = new FakeWorker();
    const failing = prepareWildzProfilePublication(input, undefined, () => failed as unknown as Worker);
    failed.onmessage!({ data: { ok: false, error: "wildz_public_profile_card_unverified" } });
    await assert.rejects(failing, /card_unverified/);
    assert.equal(failed.terminated, true);
  } finally { globalThis.Worker = oldWorker; }
});

test("admitted profile signing sends neither the account archive nor card histories to its worker", async () => {
  const { createReceizIdIdentity, verifyReceizIdentityLoginProof } = await import("@receiz/sdk");
  const { createOwnerBoundInitialPlayState } = await import("../src/features/play/game-state");
  const { sanitizePublicWildzProfile } = await import("../src/features/profile/public-profile");
  const { signWildzProfilePublication } = await import("../src/lib/receiz/wildz-profile-signing");
  const identity = await createReceizIdIdentity({ username: "compact_worker", displayName: "Keeper" });
  const assets = createOwnerBoundInitialPlayState("compact_worker").inventory;
  const profile = sanitizePublicWildzProfile({ username: "@compact_worker", displayName: "Keeper", vault: assets.map(asset => ({ id: asset.id, name: asset.manifest.name, proofDigest: asset.proof.digest, visibility: "public" })) });
  const input: WildzProfileSigningInput = { profile, assets, keyFile: identity.keyFile, session: { schema: "receiz.wildz.identity_session.v1", keyId: identity.keyFile.keyId, actorId: "compact_worker", username: "compact_worker", displayName: "Keeper", portableStateStatus: "verified", localAuthority: "verified", remoteStatus: "unknown" } };
  const oldWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  try {
    const worker = new FakeWorker();
    const originalArchive = identity.keyFile.portableState;
    const pending = prepareWildzProfilePublication(input, undefined, () => worker as unknown as Worker);
    const posted = worker.posted as { input: WildzProfileSigningInput; admittedCards: boolean };
    assert.equal(posted.admittedCards, true);
    assert.equal(posted.input.assets, undefined);
    assert.equal(posted.input.keyFile.portableState, null);
    assert.equal(input.keyFile.portableState, originalArchive);
    assert.equal(input.assets, assets);
    const result = await signWildzProfilePublication(posted.input, posted.admittedCards);
    const signed = JSON.parse(result.body).signedPublication;
    assert.equal(await verifyReceizIdentityLoginProof({ keyFile: identity.keyFile, challengeB64Url: signed.identityProof.challengeB64Url, signatureB64Url: signed.identityProof.signatureB64Url }), true);
    worker.onmessage!({ data: { ok: true, result } });
    await pending;
    const changed = { ...input, profile: { ...profile, vault: profile.vault.map(entry => ({ ...entry, proofDigest: "changed" })) } };
    await assert.rejects(prepareWildzProfilePublication(changed), /card_unverified/);
  } finally { globalThis.Worker = oldWorker; }
});
