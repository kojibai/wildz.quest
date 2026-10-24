import assert from "node:assert/strict";
import test from "node:test";
import { prepareWildzProfilePublication } from "../src/lib/receiz/wildz-profile-signing-client";
import type { WildzProfileSigningInput } from "../src/lib/receiz/wildz-profile-signing";
import { createWildzProfileSigningReceiver, type WildzProfileSigningRequest } from "../src/lib/receiz/wildz-profile-signing-protocol";

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

test("admitted profile signing delivers public cards individually without cloning the account or whole Vault", async () => {
  const { createReceizIdIdentity, verifyReceizIdentityLoginProof } = await import("@receiz/sdk");
  const { createOwnerBoundInitialPlayState } = await import("../src/features/play/game-state");
  const { sanitizePublicWildzProfile } = await import("../src/features/profile/public-profile");
  const identity = await createReceizIdIdentity({ username: "compact_worker", displayName: "Keeper" });
  const assets = createOwnerBoundInitialPlayState("compact_worker").inventory;
  const profile = sanitizePublicWildzProfile({ username: "@compact_worker", displayName: "Keeper", vault: assets.map(asset => ({ id: asset.id, name: asset.manifest.name, proofDigest: asset.proof.digest, visibility: "public" })) });
  const input: WildzProfileSigningInput = { profile, assets, keyFile: identity.keyFile, session: { schema: "receiz.wildz.identity_session.v1", keyId: identity.keyFile.keyId, actorId: "compact_worker", username: "compact_worker", displayName: "Keeper", portableStateStatus: "verified", localAuthority: "verified", remoteStatus: "unknown" } };
  const oldWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  try {
    class SigningWorker extends FakeWorker {
      messages: WildzProfileSigningRequest[] = [];
      receive = createWildzProfileSigningReceiver(data => this.onmessage?.({ data }));
      postMessage(value: WildzProfileSigningRequest) { super.postMessage(value); this.messages.push(value); this.receive(value); }
    }
    const worker = new SigningWorker();
    const originalArchive = identity.keyFile.portableState;
    const pending = prepareWildzProfilePublication(input, undefined, () => worker as unknown as Worker);
    const posted = worker.posted as { input: WildzProfileSigningInput; admittedCards: boolean };
    assert.equal(posted.admittedCards, true);
    assert.equal(posted.input.assets, undefined);
    assert.equal(posted.input.keyFile.portableState, null);
    assert.equal(input.keyFile.portableState, originalArchive);
    assert.equal(input.assets, assets);
    const result = await pending;
    const signed = JSON.parse(result.body).signedPublication;
    assert.ok(signed.storeStateRecord.vaultPacket, "the normal admitted-card path must deliver its exact public cards instead of forcing new Original reads");
    assert.equal(await verifyReceizIdentityLoginProof({ keyFile: identity.keyFile, challengeB64Url: signed.identityProof.challengeB64Url, signatureB64Url: signed.identityProof.signatureB64Url }), true);
    assert.equal(worker.messages.length, profile.vault.length + 1);
    assert.deepEqual(worker.messages.slice(1), assets.map(card => ({ card })));
    assert.equal(worker.terminated, true);
    const fallback = await prepareWildzProfilePublication(input, undefined, () => { throw Error("workers unavailable"); });
    assert.ok(JSON.parse(fallback.body).signedPublication.storeStateRecord.vaultPacket, "the fallback must retain the complete delivery too");
    const cancelled = new FakeWorker(), controller = new AbortController();
    const aborting = prepareWildzProfilePublication(input, controller.signal, () => cancelled as unknown as Worker);
    const firstMessage = cancelled.posted;
    controller.abort(new Error("profile revision retired"));
    await assert.rejects(aborting, /profile revision retired/);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(cancelled.posted, firstMessage, "cancelled card delivery must not post another chunk");
    const changed = { ...input, profile: { ...profile, vault: profile.vault.map(entry => ({ ...entry, proofDigest: "changed" })) } };
    await assert.rejects(prepareWildzProfilePublication(changed), /card_unverified/);
  } finally { globalThis.Worker = oldWorker; }
});

test("the signing receiver rejects a different card revision before it can sign a delivery", () => {
  const replies: unknown[] = [], receive = createWildzProfileSigningReceiver(value => replies.push(value));
  const input = { profile: { vault: [{ id: "wilds:expected", proofDigest: "expected" }] } } as WildzProfileSigningInput;
  receive({ input, admittedCards: true, cardCount: 1 });
  receive({ card: { id: "wilds:expected", proof: { digest: "changed" } } as never });
  assert.deepEqual(replies, [{ ok: false, error: "wildz_public_profile_card_unverified" }]);
  receive({ input, admittedCards: true, cardCount: 2 });
  assert.equal(replies.length, 2);
});
