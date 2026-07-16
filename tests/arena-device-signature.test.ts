import assert from "node:assert/strict";
import test from "node:test";
import {
  createArenaDeviceIdentity,
  MemoryArenaKeyStore,
  signArenaPendingReceipt,
  verifyArenaPendingReceipt,
} from "../src/features/play/arena/device-signature.js";

const basis = {
  schema: "receiz.wilds.arena_pending_basis.v1" as const,
  id: "pending:match-1",
  actorId: "player-1",
  parentDigests: ["sha256:" + "1".repeat(64)],
  payload: { receiptDigest: "sha256:" + "2".repeat(64), xp: 12 },
};

test("P-256 identities retain a non-exportable private key and expose only public verification material", async () => {
  const store = new MemoryArenaKeyStore();
  const identity = await createArenaDeviceIdentity("device-a", store);
  const stored = await store.load("device-a");
  assert.equal(identity.algorithm, "ECDSA-P256-SHA256");
  assert.equal(stored?.privateKey.extractable, false);
  assert.equal(identity.publicJwk.d, undefined);
  const signed = await signArenaPendingReceipt(identity.id, basis, store);
  assert.equal(await verifyArenaPendingReceipt(signed), true);
  assert.match(signed.contentDigest, /^sha256:[a-f0-9]{64}$/);
});

test("pending signatures reject content, digest, identity, and signature tampering", async () => {
  const store = new MemoryArenaKeyStore();
  await createArenaDeviceIdentity("device-a", store);
  const signed = await signArenaPendingReceipt("device-a", basis, store);
  assert.equal(await verifyArenaPendingReceipt({ ...signed, basis: { ...basis, actorId: "attacker" } }), false);
  assert.equal(await verifyArenaPendingReceipt({ ...signed, contentDigest: "sha256:" + "0".repeat(64) }), false);
  assert.equal(await verifyArenaPendingReceipt({ ...signed, signature: signed.signature.slice(0, -2) + "aa" }), false);
});

test("an imported Vault can create a new signing identity without discarding old public identities", async () => {
  const store = new MemoryArenaKeyStore();
  const oldIdentity = await createArenaDeviceIdentity("device-old", store);
  const oldReceipt = await signArenaPendingReceipt(oldIdentity.id, basis, store);
  const newIdentity = await createArenaDeviceIdentity("device-new", store);
  assert.notDeepEqual(newIdentity.publicJwk, oldIdentity.publicJwk);
  assert.equal(await verifyArenaPendingReceipt(oldReceipt), true);
  assert.deepEqual(store.publicIdentities().map((identity) => identity.id), ["device-new", "device-old"]);
});
