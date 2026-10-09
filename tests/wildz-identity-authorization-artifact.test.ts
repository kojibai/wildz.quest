import assert from "node:assert/strict";
import test from "node:test";
import {
  createReceizIdentityKeyFile,
  createReceizProofAuthorityChallenge,
  createReceizProofAuthorityExchangeV123,
  digestReceizCanonicalV122,
  parseReceizIdentityArtifactText,
  receizBase64UrlDecode,
  receizBase64UrlEncode,
  receizOidcScopesForRails,
  signReceizIdentityLoginProof,
  verifyReceizIdentityLoginProof
} from "@receiz/sdk";
import { createWildzIdentityAuthorizationArtifact } from "../src/lib/receiz/wildz-identity-authorization-artifact";
import { defaultIdentityRepository } from "../src/lib/receiz/wildz-identity-adapter";
import { authorizeWildsLivingWorldOperationWithIdentity } from "../src/features/play/wilds-living-world-authorization";
import { authorizeWildsPortableClaimWithIdentity } from "../src/features/play/wilds-portable-claim-authorization";

test("a fresh identity's safe transport is admitted by the actual SDK proof-authority exchange", async () => {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "safe_transport_fixture", username: "safe_transport_fixture" }, portableState: { snapshot: { privateArchive: "archive stays local" } } });
  const before = JSON.stringify(keyFile);
  const transport = await createWildzIdentityAuthorizationArtifact(keyFile);
  const publicFile = parseReceizIdentityArtifactText(transport.artifact);
  assert.equal(Boolean(publicFile.crypto.privateKeyPkcs8B64u), false);
  assert.ok(publicFile.crypto.privateKeyPkcs8CiphertextB64u);
  assert.equal(publicFile.crypto.cipher.aad, `RECEIZ_KEY_V1|${keyFile.keyId}`);
  assert.equal(publicFile.crypto.kdf.name, "PBKDF2-SHA256");
  assert.equal(publicFile.crypto.kdf.iterations, 100_000);
  assert.equal(publicFile.portableState, null);
  assert.equal(publicFile.keyId, keyFile.keyId);
  assert.equal(publicFile.crypto.publicKeyRawB64u, keyFile.crypto.publicKeyRawB64u);
  assert.deepEqual(publicFile.owner, keyFile.owner);
  assert.equal(transport.artifact.includes(keyFile.crypto.privateKeyPkcs8B64u!), false);
  assert.doesNotMatch(transport.artifact, /archive stays local/);
  const scopes = receizOidcScopesForRails("settlement");
  const created = createReceizProofAuthorityChallenge({ applicationId: "wildz", artifactDigest: transport.artifactDigest, scopes,
    consentStatementDigest: "c".repeat(64), ttlPulses: 60 });
  const proof = await signReceizIdentityLoginProof({ keyFile, challengeB64Url: created.challengeB64Url });
  assert.equal(await verifyReceizIdentityLoginProof({ keyFile: publicFile, challengeB64Url: proof.challengeB64Url, signatureB64Url: proof.signatureB64Url }), true);
  let requests = 0;
  const exchange = createReceizProofAuthorityExchangeV123(async (path, options) => {
    requests++;
    assert.equal(path, "/api/sdk/v1/identity/proof-authority/exchange");
    const wire = options.body.artifact as { exactBytesB64u: string; digest: string };
    const exact = new TextDecoder().decode(receizBase64UrlDecode(wire.exactBytesB64u));
    assert.equal(exact, transport.artifact);
    assert.equal(Boolean(parseReceizIdentityArtifactText(exact).crypto.privateKeyPkcs8B64u), false);
    const basis = {
      schema: "receiz.identity.proof-authority.v123" as const,
      applicationId: "wildz", keyId: keyFile.keyId, artifactDigest: transport.artifactDigest,
      grantedScopes: options.body.scopes as readonly string[], issuedAtKai: created.challenge.issuedAtKai,
      expiresAtKai: created.challenge.expiresAtKai, nonce: created.challenge.nonce, revocationHead: "a".repeat(64),
      tokenType: "Bearer" as const, expiresIn: 120, refreshable: false as const,
      authority: { grantIsIdentityAuthority: false as const, strongerTruth: "receiz-identity-artifact" as const }
    };
    return { ...basis, authorityDigest: await digestReceizCanonicalV122(basis), accessToken: "synthetic-test-only" } as never;
  });
  const admitted = await exchange({ artifact: transport.artifact, challenge: { ...created.challenge, proof }, applicationId: "wildz", scopes });
  assert.equal(admitted.keyId, keyFile.keyId);
  assert.equal(requests, 1);
  assert.equal(JSON.stringify(keyFile), before, "transport preparation leaves original key custody unchanged");
});

test("safe identity transport cache is bounded to one exact public identity and ignores private archives", async () => {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "cache_transport_fixture", username: "cache_transport_fixture" } });
  const first = createWildzIdentityAuthorizationArtifact(keyFile);
  const same = createWildzIdentityAuthorizationArtifact({ ...keyFile, portableState: null });
  assert.equal(first, same, "read and send join one preparation without repeating encryption");
  const original = await first;
  assert.equal((await same).artifact, original.artifact);
  const renamed = await createWildzIdentityAuthorizationArtifact({ ...keyFile, owner: { ...keyFile.owner, displayName: "New public display" } });
  assert.notEqual(renamed.artifactDigest, original.artifactDigest);
  assert.equal(parseReceizIdentityArtifactText(renamed.artifact).owner.displayName, "New public display");
});

test("the genuine transport ciphertext decrypts through the SDK to the same original signing key", async () => {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "cipher_roundtrip_fixture" } });
  const originalCrypto = globalThis.crypto;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  let entropy: Uint8Array | null = null;
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: {
    subtle: originalCrypto.subtle,
    getRandomValues<T extends ArrayBufferView>(bytes: T): T {
      const result = originalCrypto.getRandomValues(bytes);
      if (bytes.byteLength === 32) entropy = Uint8Array.from(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
      return result;
    }
  } });
  let artifact: string;
  try {
    artifact = (await createWildzIdentityAuthorizationArtifact(keyFile)).artifact;
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor); else Reflect.deleteProperty(globalThis, "crypto");
  }
  assert.ok(entropy, "the synthetic test captures only its freshly generated wrapping entropy");
  try {
    const transportFile = parseReceizIdentityArtifactText(artifact);
    const proof = await signReceizIdentityLoginProof({ keyFile: transportFile, passphrase: receizBase64UrlEncode(entropy), challengeB64Url: "c3ludGhldGljLWNoYWxsZW5nZQ" });
    assert.equal(await verifyReceizIdentityLoginProof({ keyFile, challengeB64Url: proof.challengeB64Url, signatureB64Url: proof.signatureB64Url }), true);
  } finally {
    (entropy as Uint8Array).fill(0);
  }
});

test("already encrypted SDK identities retain real ciphertext while transport drops every plaintext key", async () => {
  const { keyFile } = await createReceizIdentityKeyFile({ passphrase: "synthetic fixture password", owner: { uid: "encrypted_transport_fixture" } });
  const transport = await createWildzIdentityAuthorizationArtifact(keyFile);
  const publicFile = parseReceizIdentityArtifactText(transport.artifact);
  assert.equal(publicFile.crypto.privateKeyPkcs8CiphertextB64u, keyFile.crypto.privateKeyPkcs8CiphertextB64u);
  assert.equal(Boolean(publicFile.crypto.privateKeyPkcs8B64u), false);
  const proof = await signReceizIdentityLoginProof({ keyFile, passphrase: "synthetic fixture password", challengeB64Url: "c3ludGhldGljLWNoYWxsZW5nZQ" });
  assert.equal(await verifyReceizIdentityLoginProof({ keyFile: publicFile, challengeB64Url: proof.challengeB64Url, signatureB64Url: proof.signatureB64Url }), true);
});

test("failed secure encryption produces no transport artifact and safely retires its cache entry", async () => {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "unavailable_transport_fixture" } });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues() { throw new Error("secure encryption unavailable"); } } });
  try {
    await assert.rejects(createWildzIdentityAuthorizationArtifact(keyFile), /secure encryption unavailable/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor); else Reflect.deleteProperty(globalThis, "crypto");
  }
  const transport = await createWildzIdentityAuthorizationArtifact(keyFile);
  assert.equal(Boolean(parseReceizIdentityArtifactText(transport.artifact).crypto.privateKeyPkcs8B64u), false);
});

test("living-world and portable-claim default consent paths also keep the original signing key local", async () => {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "operation_transport_fixture" }, portableState: { snapshot: { privateArchive: "local-only archive" } } });
  const originalRead = defaultIdentityRepository.withKeyFile;
  defaultIdentityRepository.withKeyFile = async (keyId, operation) => {
    assert.equal(keyId, keyFile.keyId);
    return operation(keyFile);
  };
  try {
    const results = [
      await authorizeWildsLivingWorldOperationWithIdentity(keyFile.keyId, { operationId: "synthetic-operation", planDigest: "a".repeat(64), semanticIdempotencyKey: "synthetic-idempotency", amountPhiMicro: "1" }),
      await authorizeWildsPortableClaimWithIdentity(keyFile.keyId, { claimId: `wildz-claim:${"b".repeat(64)}`, exactPlanDigest: "c".repeat(64), kind: "phi" })
    ];
    for (const result of results) {
      const publicFile = parseReceizIdentityArtifactText(result.artifact);
      assert.equal(Boolean(publicFile.crypto.privateKeyPkcs8B64u), false);
      assert.equal(JSON.stringify(result).includes(keyFile.crypto.privateKeyPkcs8B64u!), false);
      assert.equal(publicFile.portableState, null);
      const proof = result.challenge.proof!;
      assert.equal(await verifyReceizIdentityLoginProof({ keyFile: publicFile, challengeB64Url: proof.challengeB64Url, signatureB64Url: proof.signatureB64Url }), true);
    }
  } finally {
    defaultIdentityRepository.withKeyFile = originalRead;
  }
});
