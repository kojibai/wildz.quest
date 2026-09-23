import { jcsCanonicalize } from "./jcs";
import { base64UrlDecode, base64UrlEncode, sha256Hex } from "./sha256";
import type { ReceizProofBundle } from "./receizProofBundle";

type KeyStatus = "active" | "retired";

export type ReceizSignatureV4RootPublicKey = Readonly<{
  kid: string;
  alg: "Ed25519";
  publicKeyRawB64u: string;
  status: KeyStatus;
  activeFromPulse?: string;
  retiredAtPulse?: string;
}>;

export type ReceizSignatureV4DeviceCert = Readonly<{
  version: 1;
  certType: "receiz.device.v1";
  certId: string;
  issuerKid: string;
  alg: "Ed25519";
  subjectPublicKeyRawB64u: string;
  issuedAtMs: number;
  expiresAtMs: number;
  sig: string;
}>;

type ReceizSignatureV4DeviceCertIdentity = Omit<ReceizSignatureV4DeviceCert, "certId" | "sig">;

export type ReceizBundleSignatureV4 = Readonly<{
  version: 1;
  alg: "Ed25519";
  cert: ReceizSignatureV4DeviceCert;
  sig: string;
  payloadHashSha256: string;
  signedAtMs: number;
}>;

export type ReceizBundleSignatureV4Signer = Readonly<{
  cert: ReceizSignatureV4DeviceCert;
  sign: (payloadBytes: Uint8Array) => Promise<Uint8Array | null>;
}>;

export type ReceizBundleSignatureV4Verification = Readonly<{
  state: "missing" | "verified" | "invalid" | "unavailable";
  error?: string;
  issuerKid?: string;
  certId?: string;
}>;

const HEX64_RE = /^[0-9a-f]{64}$/;
const HEX32_RE = /^[0-9a-f]{32}$/;
const B64U_RE = /^[A-Za-z0-9_-]+$/;
const B64U_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const KID_RE = /^[a-z0-9._:-]{3,64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
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

function asKid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const kid = value.trim();
  if (!KID_RE.test(kid)) return null;
  return kid;
}

function asB64u(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || !B64U_RE.test(text)) return null;
  const remainder = text.length % 4;
  if (remainder === 1) return null;
  const finalSextet = B64U_ALPHABET.indexOf(text.at(-1)!);
  if (
    (remainder === 2 && (finalSextet & 0b1111) !== 0)
    || (remainder === 3 && (finalSextet & 0b11) !== 0)
  ) return null;
  return text;
}

function asPulseString(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!/^\d+$/.test(text)) return null;
    try {
      return BigInt(text).toString();
    } catch {
      return null;
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return BigInt(value).toString();
  }
  return null;
}

function parseStatus(value: unknown): KeyStatus {
  return value === "retired" ? "retired" : "active";
}

function normalizeRootPublicKey(value: unknown): ReceizSignatureV4RootPublicKey | null {
  if (!isRecord(value)) return null;
  const kid = asKid(value.kid);
  const alg = value.alg === "Ed25519" ? "Ed25519" : null;
  const publicKeyRawB64u = asB64u(value.publicKeyRawB64u);
  const activeFromPulse = asPulseString(value.activeFromPulse);
  const retiredAtPulse = asPulseString(value.retiredAtPulse);
  if (!kid || !alg || !publicKeyRawB64u) return null;
  if (
    activeFromPulse !== null &&
    retiredAtPulse !== null &&
    BigInt(retiredAtPulse) < BigInt(activeFromPulse)
  ) {
    return null;
  }
  return {
    kid,
    alg,
    publicKeyRawB64u,
    status: parseStatus(value.status),
    ...(activeFromPulse !== null ? { activeFromPulse } : {}),
    ...(retiredAtPulse !== null ? { retiredAtPulse } : {}),
  };
}

export function buildReceizSignatureV4DeviceCertPayload(cert: Omit<ReceizSignatureV4DeviceCert, "sig">): string {
  const canonical = {
    version: cert.version,
    certType: cert.certType,
    certId: cert.certId,
    issuerKid: cert.issuerKid,
    alg: cert.alg,
    subjectPublicKeyRawB64u: cert.subjectPublicKeyRawB64u,
    issuedAtMs: cert.issuedAtMs,
    expiresAtMs: cert.expiresAtMs,
  } as const;
  return jcsCanonicalize(canonical);
}

export function buildReceizSignatureV4DeviceCertIdentityPayload(cert: ReceizSignatureV4DeviceCertIdentity): string {
  const canonical = {
    version: cert.version,
    certType: cert.certType,
    issuerKid: cert.issuerKid,
    alg: cert.alg,
    subjectPublicKeyRawB64u: cert.subjectPublicKeyRawB64u,
    issuedAtMs: cert.issuedAtMs,
    expiresAtMs: cert.expiresAtMs,
  } as const;
  return jcsCanonicalize(canonical);
}

export async function deriveReceizSignatureV4DeviceCertId(cert: ReceizSignatureV4DeviceCertIdentity): Promise<string> {
  const payload = buildReceizSignatureV4DeviceCertIdentityPayload(cert);
  const payloadBytes = new TextEncoder().encode(payload);
  return (await sha256Hex(payloadBytes)).slice(0, 32).toLowerCase();
}

export function buildReceizSignatureV4SignedPayloadForBundle(
  bundle: Omit<ReceizProofBundle, "signatureV3" | "signatureV4">,
): string {
  const canonical = {
    kind: bundle.kind,
    payloadVersion: bundle.payloadVersion,
    createdAtMs: bundle.createdAtMs,
    ts: bundle.ts,
    tsDisplay: bundle.tsDisplay ?? "",
    tzMinutesEast: typeof bundle.tzMinutesEast === "number" ? bundle.tzMinutesEast : null,
    code: bundle.code,
    slug: bundle.slug,
    verifyPath: bundle.verifyPath,
    verifyUrl: bundle.verifyUrl,
    kaiPulseEternal: bundle.kaiPulseEternal,
    kaiKlok: bundle.kaiKlok,
    signerKeyId: bundle.signerKeyId ?? "",
    anchorId: bundle.anchorId ?? "",
    receizClaimId: bundle.receizClaimId,
    sigilClaimSeed: bundle.sigilClaimSeed,
    zkPoseidonHash: bundle.zkPoseidonHash ?? "",
    groth16ProofDigest: bundle.groth16ProofDigest ?? "",
    artifactSha256Basis: bundle.artifactSha256Basis ?? "",
    ...(bundle.artifactBasis ? { artifactBasis: bundle.artifactBasis } : {}),
    ...(bundle.nativeCapture ? { nativeCapture: bundle.nativeCapture } : {}),
    ...(bundle.nativeCaptureSource ? { nativeCaptureSource: bundle.nativeCaptureSource } : {}),
    ...(bundle.nativeCaptureClaim ? { nativeCaptureClaim: bundle.nativeCaptureClaim } : {}),
    ...(bundle.pbiAuthorshipHistory ? { pbiAuthorshipHistory: bundle.pbiAuthorshipHistory } : {}),
    ...(bundle.nativeRecordSeal ? { nativeRecordSeal: bundle.nativeRecordSeal } : {}),
    wireproof: bundle.wireproof ?? null,
  } as const;
  return jcsCanonicalize(canonical);
}

async function signedPayloadHashForBundle(
  bundle: Omit<ReceizProofBundle, "signatureV3" | "signatureV4">,
): Promise<string> {
  const payload = buildReceizSignatureV4SignedPayloadForBundle(bundle);
  const payloadBytes = new TextEncoder().encode(payload);
  return (await sha256Hex(payloadBytes)).toLowerCase();
}

export async function deriveReceizSignatureV4PayloadHashSha256ForBundle(
  bundle: Omit<ReceizProofBundle, "signatureV3" | "signatureV4">,
): Promise<string> {
  return signedPayloadHashForBundle(bundle);
}

function normalizeDeviceCert(value: unknown): ReceizSignatureV4DeviceCert | null {
  if (!isRecord(value)) return null;
  const version = value.version === 1 ? 1 : null;
  const certType = value.certType === "receiz.device.v1" ? "receiz.device.v1" : null;
  const certIdRaw = typeof value.certId === "string" ? value.certId.trim().toLowerCase() : "";
  const certId = HEX32_RE.test(certIdRaw) ? certIdRaw : null;
  const issuerKid = asKid(value.issuerKid);
  const alg = value.alg === "Ed25519" ? "Ed25519" : null;
  const subjectPublicKeyRawB64u = asB64u(value.subjectPublicKeyRawB64u);
  const issuedAtMsRaw = Number(value.issuedAtMs);
  const expiresAtMsRaw = Number(value.expiresAtMs);
  const issuedAtMs = Number.isFinite(issuedAtMsRaw) ? Math.trunc(issuedAtMsRaw) : Number.NaN;
  const expiresAtMs = Number.isFinite(expiresAtMsRaw) ? Math.trunc(expiresAtMsRaw) : Number.NaN;
  const sig = asB64u(value.sig);

  if (
    !version ||
    !certType ||
    !certId ||
    !issuerKid ||
    !alg ||
    !subjectPublicKeyRawB64u ||
    !Number.isFinite(issuedAtMs) ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= issuedAtMs ||
    !sig
  ) {
    return null;
  }

  return {
    version,
    certType,
    certId,
    issuerKid,
    alg,
    subjectPublicKeyRawB64u,
    issuedAtMs,
    expiresAtMs,
    sig,
  };
}

function normalizeSignatureV4(value: unknown): ReceizBundleSignatureV4 | null {
  if (!isRecord(value)) return null;
  const version = value.version === 1 ? 1 : null;
  const alg = value.alg === "Ed25519" ? "Ed25519" : null;
  const cert = normalizeDeviceCert(value.cert);
  const sig = asB64u(value.sig);
  const payloadHashSha256 =
    typeof value.payloadHashSha256 === "string" ? value.payloadHashSha256.trim().toLowerCase() : "";
  const signedAtMsRaw = Number(value.signedAtMs);
  const signedAtMs = Number.isFinite(signedAtMsRaw) ? Math.trunc(signedAtMsRaw) : Number.NaN;
  if (!version || !alg || !cert || !sig || !HEX64_RE.test(payloadHashSha256) || !Number.isFinite(signedAtMs) || signedAtMs < 0) {
    return null;
  }
  return { version, alg, cert, sig, payloadHashSha256, signedAtMs };
}

const importedEd25519PublicKeys =
  new Map<string, Promise<CryptoKey | null>>();
const verifiedDeviceCertificates =
  new Map<string, Promise<boolean>>();
const MAX_VERIFIED_DEVICE_CERTIFICATES = 256;
const MAX_IMPORTED_ED25519_PUBLIC_KEYS = 256;

function rememberDeviceCertificateVerification(
  key: string,
  verify: () => Promise<boolean>,
): Promise<boolean> {
  const existing = verifiedDeviceCertificates.get(key);
  if (existing) {
    verifiedDeviceCertificates.delete(key);
    verifiedDeviceCertificates.set(key, existing);
    return existing;
  }
  while (verifiedDeviceCertificates.size >= MAX_VERIFIED_DEVICE_CERTIFICATES) {
    const oldest = verifiedDeviceCertificates.keys().next().value;
    if (typeof oldest !== "string") break;
    verifiedDeviceCertificates.delete(oldest);
  }
  const pending = verify();
  verifiedDeviceCertificates.set(key, pending);
  void pending.then(
    (valid) => {
      if (!valid && verifiedDeviceCertificates.get(key) === pending) {
        verifiedDeviceCertificates.delete(key);
      }
    },
    () => {
      if (verifiedDeviceCertificates.get(key) === pending) {
        verifiedDeviceCertificates.delete(key);
      }
    },
  );
  return pending;
}

async function importEd25519PublicKeyRawB64u(publicKeyRawB64u: string): Promise<CryptoKey | null> {
  const existing = importedEd25519PublicKeys.get(publicKeyRawB64u);
  if (existing) {
    importedEd25519PublicKeys.delete(publicKeyRawB64u);
    importedEd25519PublicKeys.set(publicKeyRawB64u, existing);
    return existing;
  }
  while (
    importedEd25519PublicKeys.size >= MAX_IMPORTED_ED25519_PUBLIC_KEYS
  ) {
    const oldest = importedEd25519PublicKeys.keys().next().value;
    if (typeof oldest !== "string") break;
    importedEd25519PublicKeys.delete(oldest);
  }
  const imported = (async () => {
    try {
      const publicKeyRaw = base64UrlDecode(publicKeyRawB64u);
      return await crypto.subtle.importKey("raw", toArrayBuffer(publicKeyRaw), { name: "Ed25519" }, false, ["verify"]);
    } catch {
      return null;
    }
  })();
  importedEd25519PublicKeys.set(publicKeyRawB64u, imported);
  void imported.then(
    (key) => {
      if (!key && importedEd25519PublicKeys.get(publicKeyRawB64u) === imported) {
        importedEd25519PublicKeys.delete(publicKeyRawB64u);
      }
    },
    () => {
      if (importedEd25519PublicKeys.get(publicKeyRawB64u) === imported) {
        importedEd25519PublicKeys.delete(publicKeyRawB64u);
      }
    },
  );
  return imported;
}

export function coerceReceizBundleSignatureV4(value: unknown): ReceizBundleSignatureV4 | null {
  return normalizeSignatureV4(value);
}

export function coerceReceizSignatureV4DeviceCert(value: unknown): ReceizSignatureV4DeviceCert | null {
  return normalizeDeviceCert(value);
}

export function coerceReceizSignatureV4RootPublicKeys(value: unknown): ReadonlyMap<string, ReceizSignatureV4RootPublicKey> {
  if (!Array.isArray(value)) return new Map();
  const out = new Map<string, ReceizSignatureV4RootPublicKey>();
  for (const entry of value) {
    const key = normalizeRootPublicKey(entry);
    if (!key) continue;
    out.set(key.kid, key);
  }
  return out;
}

export async function maybeSignReceizBundleV4(
  bundle: Omit<ReceizProofBundle, "signatureV3" | "signatureV4">,
  signer: ReceizBundleSignatureV4Signer | null
): Promise<ReceizBundleSignatureV4 | null> {
  if (!signer) return null;

  const now = Date.now();
  if (now < signer.cert.issuedAtMs || now > signer.cert.expiresAtMs) return null;

  const payload = buildReceizSignatureV4SignedPayloadForBundle(bundle);
  const payloadBytes = new TextEncoder().encode(payload);
  const payloadHashSha256 = (await sha256Hex(payloadBytes)).toLowerCase();
  const sigBytes = await signer.sign(payloadBytes);
  if (!sigBytes) return null;

  return {
    version: 1,
    alg: "Ed25519",
    cert: signer.cert,
    sig: base64UrlEncode(sigBytes),
    payloadHashSha256,
    signedAtMs: now,
  };
}

export async function verifyReceizBundleSignatureV4(args: {
  bundle: ReceizProofBundle;
  rootPublicKeys?: ReadonlyMap<string, ReceizSignatureV4RootPublicKey> | null;
}): Promise<ReceizBundleSignatureV4Verification> {
  const rawSignature = (args.bundle as Record<string, unknown>).signatureV4;
  const signature = normalizeSignatureV4(rawSignature);
  if (!signature) {
    return typeof rawSignature === "undefined"
      ? { state: "missing" }
      : { state: "invalid", error: "signatureV4 payload is malformed." };
  }

  const signedBundle = { ...args.bundle } as Omit<ReceizProofBundle, "signatureV3" | "signatureV4"> & {
    signatureV3?: unknown;
    signatureV4?: unknown;
  };
  delete signedBundle.signatureV3;
  delete signedBundle.signatureV4;

  const payload = buildReceizSignatureV4SignedPayloadForBundle(signedBundle);
  const payloadBytes = new TextEncoder().encode(payload);
  const payloadHashSha256 = (await sha256Hex(payloadBytes)).toLowerCase();
  if (payloadHashSha256 !== signature.payloadHashSha256) {
    return { state: "invalid", error: "signatureV4 payload hash mismatch." };
  }

  const rootPublicKeys = args.rootPublicKeys ?? new Map<string, ReceizSignatureV4RootPublicKey>();
  const rootKey = rootPublicKeys.get(signature.cert.issuerKid) ?? null;
  if (!rootKey) {
    return { state: "unavailable", error: "signatureV4 root key not configured." };
  }
  if (rootKey.alg !== signature.cert.alg) {
    return { state: "invalid", error: "signatureV4 root-key algorithm mismatch." };
  }

  const bundlePulse = asPulseString((args.bundle as { kaiPulseEternal?: unknown }).kaiPulseEternal);
  if (bundlePulse === null) {
    return { state: "invalid", error: "signatureV4 bundle pulse is invalid." };
  }
  const keyPolicyPulse = BigInt(bundlePulse);

  if (rootKey.activeFromPulse && keyPolicyPulse < BigInt(rootKey.activeFromPulse)) {
    return { state: "invalid", error: "signatureV4 root key predates activation pulse." };
  }

  if (rootKey.status === "retired" && !rootKey.retiredAtPulse) {
    return { state: "unavailable", error: "signatureV4 root key retired without retirement pulse." };
  }

  if (rootKey.retiredAtPulse && keyPolicyPulse > BigInt(rootKey.retiredAtPulse)) {
    return { state: "unavailable", error: "signatureV4 root key retired for this bundle pulse." };
  }

  const certExpectedId = await deriveReceizSignatureV4DeviceCertId({
    version: signature.cert.version,
    certType: signature.cert.certType,
    issuerKid: signature.cert.issuerKid,
    alg: signature.cert.alg,
    subjectPublicKeyRawB64u: signature.cert.subjectPublicKeyRawB64u,
    issuedAtMs: signature.cert.issuedAtMs,
    expiresAtMs: signature.cert.expiresAtMs,
  });
  if (certExpectedId !== signature.cert.certId) {
    return { state: "invalid", error: "signatureV4 device certificate ID mismatch." };
  }

  const certPayload = buildReceizSignatureV4DeviceCertPayload({
    version: signature.cert.version,
    certType: signature.cert.certType,
    certId: signature.cert.certId,
    issuerKid: signature.cert.issuerKid,
    alg: signature.cert.alg,
    subjectPublicKeyRawB64u: signature.cert.subjectPublicKeyRawB64u,
    issuedAtMs: signature.cert.issuedAtMs,
    expiresAtMs: signature.cert.expiresAtMs,
  });
  const certPayloadBytes = new TextEncoder().encode(certPayload);

  const certCacheKey = jcsCanonicalize({
    verifier: "receiz.signature-v4.device-certificate.v1",
    rootKey,
    cert: signature.cert,
  });
  const certVerification = rememberDeviceCertificateVerification(
    certCacheKey,
    async () => {
      const rootCryptoKey = await importEd25519PublicKeyRawB64u(
        rootKey.publicKeyRawB64u,
      );
      if (!rootCryptoKey) return false;
      try {
        return await crypto.subtle.verify(
          "Ed25519",
          rootCryptoKey,
          toArrayBuffer(base64UrlDecode(signature.cert.sig)),
          toArrayBuffer(certPayloadBytes),
        );
      } catch {
        return false;
      }
    },
  );
  const certValid = await certVerification;
  if (!certValid) {
    return { state: "invalid", error: "signatureV4 device certificate verification failed." };
  }

  if (signature.signedAtMs < signature.cert.issuedAtMs) {
    return { state: "invalid", error: "signatureV4 signedAtMs predates certificate issuance." };
  }
  if (signature.signedAtMs > signature.cert.expiresAtMs) {
    return { state: "unavailable", error: "signatureV4 device certificate expired at signedAtMs." };
  }

  const subjectCryptoKey = await importEd25519PublicKeyRawB64u(signature.cert.subjectPublicKeyRawB64u);
  if (!subjectCryptoKey) {
    return { state: "invalid", error: "signatureV4 subject key import failed." };
  }

  let verified = false;
  try {
    verified = await crypto.subtle.verify(
      "Ed25519",
      subjectCryptoKey,
      toArrayBuffer(base64UrlDecode(signature.sig)),
      toArrayBuffer(payloadBytes)
    );
  } catch {
    verified = false;
  }
  if (!verified) {
    return { state: "invalid", error: "signatureV4 verification failed." };
  }

  return {
    state: "verified",
    issuerKid: signature.cert.issuerKid,
    certId: signature.cert.certId,
  };
}
