import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";

export type ArenaDeviceIdentity = Readonly<{
  id: string;
  algorithm: "ECDSA-P256-SHA256";
  publicJwk: JsonWebKey;
}>;
export type ArenaStoredDeviceIdentity = Readonly<{ identity: ArenaDeviceIdentity; privateKey: CryptoKey }>;
export interface ArenaKeyStore {
  load(identityId: string): Promise<ArenaStoredDeviceIdentity | null>;
  save(value: ArenaStoredDeviceIdentity): Promise<void>;
}
export type ArenaPendingReceiptBasis = Readonly<{
  schema: "receiz.wilds.arena_pending_basis.v1";
  id: string;
  actorId: string;
  parentDigests: readonly string[];
  payload: unknown;
}>;
export type ArenaPendingReceipt = Readonly<{
  schema: "receiz.wilds.arena_pending_receipt.v1";
  basis: ArenaPendingReceiptBasis;
  identity: ArenaDeviceIdentity;
  contentDigest: string;
  signature: string;
}>;

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const identityPattern = /^[a-z0-9:._-]{1,160}$/i;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function signedBytes(basis: ArenaPendingReceiptBasis, identity: ArenaDeviceIdentity, contentDigest: string) {
  return new TextEncoder().encode(canonicalPortableCardJson({ basis, identity, contentDigest }));
}

function validateBasis(basis: ArenaPendingReceiptBasis) {
  if (basis.schema !== "receiz.wilds.arena_pending_basis.v1"
    || !identityPattern.test(basis.id)
    || !identityPattern.test(basis.actorId)
    || basis.parentDigests.length > 64
    || basis.parentDigests.some((value) => !digestPattern.test(value))) {
    throw new Error("arena_pending_basis_invalid");
  }
}

export class MemoryArenaKeyStore implements ArenaKeyStore {
  readonly #identities = new Map<string, ArenaStoredDeviceIdentity>();

  async load(identityId: string) { return this.#identities.get(identityId) ?? null; }
  async save(value: ArenaStoredDeviceIdentity) {
    if (this.#identities.has(value.identity.id)) throw new Error("arena_device_identity_exists");
    this.#identities.set(value.identity.id, value);
  }
  publicIdentities() {
    return [...this.#identities.values()].map(({ identity }) => identity).sort((left, right) => left.id.localeCompare(right.id));
  }
}

export class IndexedDbArenaKeyStore implements ArenaKeyStore {
  readonly #databaseName: string;
  constructor(databaseName = "receiz-wilds-arena-keys") { this.#databaseName = databaseName; }
  async #database() {
    if (typeof indexedDB === "undefined") throw new Error("arena_device_indexeddb_unavailable");
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.#databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("identities", { keyPath: "identity.id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("arena_device_indexeddb_open_failed"));
    });
  }
  async load(identityId: string) {
    const database = await this.#database();
    return new Promise<ArenaStoredDeviceIdentity | null>((resolve, reject) => {
      const transaction = database.transaction("identities", "readonly");
      const request = transaction.objectStore("identities").get(identityId);
      request.onsuccess = () => resolve((request.result as ArenaStoredDeviceIdentity | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("arena_device_identity_load_failed"));
      transaction.oncomplete = () => database.close();
    });
  }
  async save(value: ArenaStoredDeviceIdentity) {
    const database = await this.#database();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("identities", "readwrite");
      transaction.objectStore("identities").add(value);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("arena_device_identity_save_failed")); };
    });
  }
}

export async function createArenaDeviceIdentity(id: string, store: ArenaKeyStore): Promise<ArenaDeviceIdentity> {
  if (!identityPattern.test(id)) throw new Error("arena_device_identity_invalid");
  if (await store.load(id)) throw new Error("arena_device_identity_exists");
  const generated = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const identity: ArenaDeviceIdentity = { id, algorithm: "ECDSA-P256-SHA256", publicJwk };
  await store.save({ identity, privateKey });
  return identity;
}

export async function signArenaPendingReceipt(
  identityId: string,
  basis: ArenaPendingReceiptBasis,
  store: ArenaKeyStore,
): Promise<ArenaPendingReceipt> {
  validateBasis(basis);
  const stored = await store.load(identityId);
  if (!stored || stored.privateKey.extractable || stored.privateKey.type !== "private") throw new Error("arena_device_private_key_unavailable");
  const contentDigest = sha256PortableBasis(canonicalPortableCardJson(basis));
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    stored.privateKey,
    signedBytes(basis, stored.identity, contentDigest),
  );
  return {
    schema: "receiz.wilds.arena_pending_receipt.v1",
    basis,
    identity: stored.identity,
    contentDigest,
    signature: bytesToBase64Url(new Uint8Array(signature)),
  };
}

export async function verifyArenaPendingReceipt(receipt: ArenaPendingReceipt): Promise<boolean> {
  try {
    validateBasis(receipt.basis);
    if (receipt.schema !== "receiz.wilds.arena_pending_receipt.v1"
      || receipt.identity.algorithm !== "ECDSA-P256-SHA256"
      || !identityPattern.test(receipt.identity.id)
      || sha256PortableBasis(canonicalPortableCardJson(receipt.basis)) !== receipt.contentDigest) return false;
    const publicKey = await crypto.subtle.importKey(
      "jwk", receipt.identity.publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"],
    );
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      base64UrlToBytes(receipt.signature),
      signedBytes(receipt.basis, receipt.identity, receipt.contentDigest),
    );
  } catch {
    return false;
  }
}
