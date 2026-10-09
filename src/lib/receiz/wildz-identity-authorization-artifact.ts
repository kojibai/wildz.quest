import {
  receizBase64UrlDecode,
  receizBase64UrlEncode,
  serializeReceizIdentityArtifact,
  sha256ReceizBytes,
  type ReceizKeyFile
} from "@receiz/sdk";

type AuthorizationArtifact = Readonly<{ artifact: string; artifactDigest: string }>;
let cached: Readonly<{ basis: string; operation: Promise<AuthorizationArtifact> }> | null = null;

/** SDK v128 requires a keyfile envelope even when only verifying public signatures. */
export function createWildzIdentityAuthorizationArtifact(keyFile: ReceizKeyFile): Promise<AuthorizationArtifact> {
  const identity = {
    schema: keyFile.schema, name: keyFile.name, version: keyFile.version,
    issuedAt: keyFile.issuedAt, keyId: keyFile.keyId, alg: keyFile.alg,
    owner: { uid: keyFile.owner.uid, email: keyFile.owner.email, username: keyFile.owner.username, displayName: keyFile.owner.displayName },
    publicKeyRawB64u: keyFile.crypto.publicKeyRawB64u
  };
  // One transport-only cache entry. It contains no signer, private key, password,
  // or account archive, and changes when the exact public identity changes.
  const basis = JSON.stringify(identity);
  if (cached?.basis === basis) return cached.operation;
  const operation = (async (): Promise<AuthorizationArtifact> => {
    let crypto: ReceizKeyFile["crypto"];
    if (keyFile.crypto.privateKeyPkcs8CiphertextB64u) {
      crypto = {
        publicKeyRawB64u: identity.publicKeyRawB64u,
        privateKeyPkcs8CiphertextB64u: keyFile.crypto.privateKeyPkcs8CiphertextB64u,
        privateKeyPkcs8B64u: null,
        kdf: { name: "PBKDF2-SHA256", iterations: keyFile.crypto.kdf.iterations, saltB64u: keyFile.crypto.kdf.saltB64u },
        cipher: { name: "AES-GCM-256", ivB64u: keyFile.crypto.cipher.ivB64u, aad: keyFile.crypto.cipher.aad }
      };
    } else {
      if (!keyFile.crypto.privateKeyPkcs8B64u) throw new Error("wildz_identity_authorization_key_unavailable");
      // Fresh SDK identities carry plaintext locally. Wrap the SAME key with a
      // cryptographically random, discarded password; never create a new ID.
      // This mirrors identity.js's PBKDF2/AES-GCM envelope and AAD exactly.
      const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const entropy = globalThis.crypto.getRandomValues(new Uint8Array(32));
      const password = new TextEncoder().encode(receizBase64UrlEncode(entropy));
      const privateBytes = Uint8Array.from(receizBase64UrlDecode(keyFile.crypto.privateKeyPkcs8B64u));
      const iterations = 100_000;
      const aad = `RECEIZ_KEY_V1|${identity.keyId}`;
      try {
        const material = await globalThis.crypto.subtle.importKey("raw", password.buffer, "PBKDF2", false, ["deriveKey"]);
        const encryptionKey = await globalThis.crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt.buffer, iterations }, material,
          { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
        const encrypted = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer, additionalData: new TextEncoder().encode(aad) }, encryptionKey, privateBytes.buffer);
        crypto = {
          publicKeyRawB64u: identity.publicKeyRawB64u,
          privateKeyPkcs8CiphertextB64u: receizBase64UrlEncode(new Uint8Array(encrypted)),
          privateKeyPkcs8B64u: null,
          kdf: { name: "PBKDF2-SHA256", iterations, saltB64u: receizBase64UrlEncode(salt) },
          cipher: { name: "AES-GCM-256", ivB64u: receizBase64UrlEncode(iv), aad }
        };
      } finally {
        entropy.fill(0); password.fill(0); privateBytes.fill(0);
      }
    }
    const { publicKeyRawB64u: _publicKey, ...publicIdentity } = identity;
    const artifact = serializeReceizIdentityArtifact({ ...publicIdentity, crypto, portableState: null, attestation: null });
    return Object.freeze({ artifact, artifactDigest: await sha256ReceizBytes(new TextEncoder().encode(artifact)) });
  })();
  cached = { basis, operation };
  void operation.catch(() => { if (cached?.operation === operation) cached = null; });
  return operation;
}
