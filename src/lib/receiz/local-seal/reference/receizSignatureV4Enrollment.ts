import { base64UrlDecode, base64UrlEncode } from "./sha256";
import {
  buildReceizSignatureV4DeviceCertPayload,
  coerceReceizSignatureV4DeviceCert,
  deriveReceizSignatureV4DeviceCertId,
  type ReceizBundleSignatureV4Signer,
  type ReceizSignatureV4DeviceCert,
} from "./receizSignatureV4";
import { pinnedReceizSignatureV4RootPublicKeysForClient } from "./receizSignatureV4Pinned";

const DB_NAME = "receiz.signatureV4.device.v1";
const STORE_NAME = "enrollment";
const ACTIVE_ID = "active";
const ENROLL_ENDPOINT = "/api/receiz/local-signer/enroll";

type StoredEnrollment = Readonly<{
  id: string;
  version: 1;
  createdAtMs: number;
  cert: ReceizSignatureV4DeviceCert;
  publicKeyRawB64u: string;
  privateKey: CryptoKey;
}>;

let openDbPromise: Promise<IDBDatabase> | null = null;

function canUseIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = bytes.buffer;
  if (buffer instanceof ArrayBuffer) {
    if (bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength) return buffer;
    return buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function verifyReceizSignatureV4SignerReadiness(
  signer: ReceizBundleSignatureV4Signer,
  options: Readonly<{ minimumRemainingMs?: number }> = {},
): Promise<boolean> {
  const minimumRemainingMs = Math.max(0, Math.trunc(options.minimumRemainingMs ?? 0));
  if (!isCertActiveNow(signer.cert, minimumRemainingMs)) return false;
  const roots = pinnedReceizSignatureV4RootPublicKeysForClient();
  const root = roots.get(signer.cert.issuerKid);
  if (!root || root.alg !== signer.cert.alg || root.status !== "active") return false;
  const expectedCertId = await deriveReceizSignatureV4DeviceCertId({
    version: signer.cert.version,
    certType: signer.cert.certType,
    issuerKid: signer.cert.issuerKid,
    alg: signer.cert.alg,
    subjectPublicKeyRawB64u: signer.cert.subjectPublicKeyRawB64u,
    issuedAtMs: signer.cert.issuedAtMs,
    expiresAtMs: signer.cert.expiresAtMs,
  });
  if (expectedCertId !== signer.cert.certId) return false;
  try {
    const rootKey = await crypto.subtle.importKey(
      "raw", toArrayBuffer(base64UrlDecode(root.publicKeyRawB64u)), { name: "Ed25519" }, false, ["verify"],
    );
    const certPayload = new TextEncoder().encode(buildReceizSignatureV4DeviceCertPayload({
      version: signer.cert.version,
      certType: signer.cert.certType,
      certId: signer.cert.certId,
      issuerKid: signer.cert.issuerKid,
      alg: signer.cert.alg,
      subjectPublicKeyRawB64u: signer.cert.subjectPublicKeyRawB64u,
      issuedAtMs: signer.cert.issuedAtMs,
      expiresAtMs: signer.cert.expiresAtMs,
    }));
    if (!await crypto.subtle.verify(
      "Ed25519", rootKey, toArrayBuffer(base64UrlDecode(signer.cert.sig)), toArrayBuffer(certPayload),
    )) return false;
    const probe = new TextEncoder().encode("receiz.signature-v4.signer-readiness.v1");
    const signature = await signer.sign(probe);
    if (!signature?.byteLength) return false;
    const subjectKey = await crypto.subtle.importKey(
      "raw", toArrayBuffer(base64UrlDecode(signer.cert.subjectPublicKeyRawB64u)),
      { name: "Ed25519" }, false, ["verify"],
    );
    return crypto.subtle.verify("Ed25519", subjectKey, toArrayBuffer(signature), toArrayBuffer(probe));
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error("indexeddb_unavailable"));
  }
  if (openDbPromise) return openDbPromise;

  openDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb_open_failed"));
  });

  return openDbPromise;
}

async function readStoredEnrollment(): Promise<StoredEnrollment | null> {
  const db = await openDb();
  return await new Promise<StoredEnrollment | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(ACTIVE_ID);

    req.onsuccess = () => {
      const row = req.result as
        | {
            id?: unknown;
            version?: unknown;
            createdAtMs?: unknown;
            cert?: unknown;
            publicKeyRawB64u?: unknown;
            privateKey?: unknown;
          }
        | undefined;
      if (!row || row.id !== ACTIVE_ID || row.version !== 1) {
        resolve(null);
        return;
      }
      const createdAtMsRaw = Number(row.createdAtMs);
      const createdAtMs = Number.isFinite(createdAtMsRaw) ? Math.trunc(createdAtMsRaw) : Number.NaN;
      const cert = coerceReceizSignatureV4DeviceCert(row.cert);
      const publicKeyRawB64u = typeof row.publicKeyRawB64u === "string" ? row.publicKeyRawB64u.trim() : "";
      const privateKey = row.privateKey;

      if (!Number.isFinite(createdAtMs) || !cert || !publicKeyRawB64u) {
        resolve(null);
        return;
      }

      if (!privateKey || typeof privateKey !== "object") {
        resolve(null);
        return;
      }

      resolve({
        id: ACTIVE_ID,
        version: 1,
        createdAtMs,
        cert,
        publicKeyRawB64u,
        privateKey: privateKey as CryptoKey,
      });
    };
    req.onerror = () => reject(req.error ?? new Error("indexeddb_read_failed"));
  });
}

async function writeStoredEnrollment(record: StoredEnrollment): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("indexeddb_write_failed"));
  });
}

async function generateDeviceSignerKeys(): Promise<{
  publicKeyRawB64u: string;
  privateKey: CryptoKey;
}> {
  if (!globalThis.crypto?.subtle) throw new Error("webcrypto_unavailable");

  const generated = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey));
  const privatePkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", generated.privateKey));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    toArrayBuffer(privatePkcs8),
    { name: "Ed25519" },
    false,
    ["sign"]
  );

  privatePkcs8.fill(0);
  return {
    publicKeyRawB64u: base64UrlEncode(publicRaw),
    privateKey,
  };
}

function isCertActiveNow(cert: ReceizSignatureV4DeviceCert, minimumRemainingMs = 0): boolean {
  const now = Date.now();
  return cert.issuedAtMs <= now && now + Math.max(0, Math.trunc(minimumRemainingMs)) <= cert.expiresAtMs;
}

export async function activeReceizSignatureV4SignerFromEnrollment(options: Readonly<{
  minimumRemainingMs?: number;
}> = {}): Promise<ReceizBundleSignatureV4Signer | null> {
  try {
    const stored = await readStoredEnrollment();
    if (!stored) return null;
    if (!isCertActiveNow(stored.cert, options.minimumRemainingMs)) return null;

    return {
      cert: stored.cert,
      sign: async (payloadBytes: Uint8Array): Promise<Uint8Array | null> => {
        try {
          const sig = await crypto.subtle.sign("Ed25519", stored.privateKey, toArrayBuffer(payloadBytes));
          return new Uint8Array(sig);
        } catch {
          return null;
        }
      },
    };
  } catch {
    return null;
  }
}

export async function hasActiveReceizSignatureV4Enrollment(options: Readonly<{
  minimumRemainingMs?: number;
}> = {}): Promise<boolean> {
  const signer = await activeReceizSignatureV4SignerFromEnrollment(options);
  return Boolean(signer);
}

export async function enrollReceizSignatureV4DeviceFromServer(options: Readonly<{
  minimumRemainingMs?: number;
}> = {}): Promise<{
  enrolled: boolean;
  reason?: string;
}> {
  if (typeof window === "undefined") return { enrolled: false, reason: "browser_only" };
  if (!globalThis.crypto?.subtle) return { enrolled: false, reason: "webcrypto_unavailable" };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { enrolled: false, reason: "offline" };
  }

  const existing = await activeReceizSignatureV4SignerFromEnrollment(options);
  if (existing) return { enrolled: false, reason: "already_active" };

  let keys: { publicKeyRawB64u: string; privateKey: CryptoKey };
  try {
    keys = await generateDeviceSignerKeys();
  } catch {
    return { enrolled: false, reason: "keygen_failed" };
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const challengeB64u = base64UrlEncode(challenge);
  let challengeSigB64u = "";
  try {
    const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", keys.privateKey, toArrayBuffer(challenge)));
    challengeSigB64u = base64UrlEncode(sig);
  } catch {
    return { enrolled: false, reason: "challenge_sign_failed" };
  }

  let payload: unknown;
  try {
    const res = await fetch(ENROLL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      credentials: "same-origin",
      body: JSON.stringify({
        publicKeyRawB64u: keys.publicKeyRawB64u,
        challengeB64u,
        challengeSigB64u,
      }),
    });

    payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const reason =
        payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
          ? String((payload as { error?: unknown }).error)
          : "enroll_failed";
      return { enrolled: false, reason };
    }
  } catch {
    return { enrolled: false, reason: "network_failed" };
  }

  if (!payload || typeof payload !== "object") return { enrolled: false, reason: "invalid_response" };
  const cert = coerceReceizSignatureV4DeviceCert((payload as { cert?: unknown }).cert);
  if (!cert) return { enrolled: false, reason: "invalid_cert" };
  if (cert.subjectPublicKeyRawB64u !== keys.publicKeyRawB64u) {
    return { enrolled: false, reason: "cert_subject_mismatch" };
  }

  if (!await verifyReceizSignatureV4SignerReadiness({ cert, sign: async bytes => new Uint8Array(await crypto.subtle.sign("Ed25519", keys.privateKey, toArrayBuffer(bytes))) }))
    return { enrolled: false, reason: "untrusted_cert" };

  try {
    await writeStoredEnrollment({
      id: ACTIVE_ID,
      version: 1,
      createdAtMs: Date.now(),
      cert,
      publicKeyRawB64u: keys.publicKeyRawB64u,
      privateKey: keys.privateKey,
    });
  } catch {
    return { enrolled: false, reason: "persist_failed" };
  }

  return { enrolled: true };
}
