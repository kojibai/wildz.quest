import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReceizDeviceIdentity } from "@receiz/sdk";
import {
  ensureWildzIdentity,
  parseStoredWildzIdentity,
  publicWildzIdentity,
  WILDZ_IDENTITY_STORAGE_KEY
} from "../src/features/identity/wildz-identity";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
}

function identity(): ReceizDeviceIdentity {
  return {
    schema: "receiz.device.identity.v1",
    createdAt: "2026-07-15T12:00:00.000Z",
    updatedAt: "2026-07-15T12:00:00.000Z",
    localUid: "local-wildz",
    username: "trail-seed",
    displayName: "Trail Seed",
    deviceName: "Wildz",
    keyFile: {
      schema: "receiz.key.v1",
      name: "Receiz Key",
      version: 1,
      issuedAt: "2026-07-15T12:00:00.000Z",
      keyId: "rz_test_key_123456",
      alg: "Ed25519",
      owner: { uid: "local-wildz", email: null, username: "trail-seed", displayName: "Trail Seed" },
      crypto: {
        publicKeyRawB64u: "public",
        privateKeyPkcs8CiphertextB64u: "private-ciphertext",
        kdf: { name: "PBKDF2-SHA256", iterations: 1, saltB64u: "salt" },
        cipher: { name: "AES-GCM-256", ivB64u: "iv", aad: "aad" }
      },
      attestation: null,
      portableState: null
    }
  };
}

test("first landing creates one Receiz identity and later loads reuse it", async () => {
  const storage = memoryStorage();
  let calls = 0;
  const create = async () => { calls += 1; return identity(); };

  const first = await ensureWildzIdentity(storage, create);
  const second = await ensureWildzIdentity(storage, create);

  assert.equal(calls, 1);
  assert.deepEqual(second, first);
  assert.ok(storage.getItem(WILDZ_IDENTITY_STORAGE_KEY));
});

test("invalid stored identity is rejected without throwing", () => {
  assert.equal(parseStoredWildzIdentity("not-json"), null);
  assert.equal(parseStoredWildzIdentity(JSON.stringify({ version: 1 })), null);
});

test("public identity projection excludes Seal secrets", () => {
  const projected = publicWildzIdentity({ version: 1, savedAt: identity().createdAt, identity: identity() });
  const serialized = JSON.stringify(projected);
  assert.match(serialized, /rz_test_key_123456/);
  assert.doesNotMatch(serialized, /private-ciphertext|salt|"crypto"/);
});
