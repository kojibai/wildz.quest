import { jcsCanonicalize } from "./jcs";
import { base64UrlDecode, base64UrlEncode, sha256Hex } from "./sha256";
import type { ReceizProofBundle } from "./receizProofBundle";

type KeyStatus = "active" | "retired";

export type ReceizBundleSignatureV3 = Readonly<{
  version: 1;
  alg: "Ed25519";
  kid: string;
  sig: string;
  payloadHashSha256: string;
  signedAtMs: number;
}>;

export type ReceizBundleSignatureV3PublicKey = Readonly<{
  kid: string;
  alg: "Ed25519";
  publicKeyRawB64u: string;
  status: KeyStatus;
  activeFromPulse?: string;
  retiredAtPulse?: string;
}>;

type ReceizBundleSignatureV3LocalSigner = Readonly<{
  provider: "local";
  kid: string;
  alg: "Ed25519";
  privateKeyPkcs8B64u: string;
}>;

type ReceizBundleSignatureV3RemoteSigner = Readonly<{
  provider: "remote";
  kid: string;
  alg: "Ed25519";
  signUrl: string;
  timeoutMs: number;
  bearerToken?: string;
  apiKey?: string;
}>;

export type ReceizBundleSignatureV3Signer = ReceizBundleSignatureV3LocalSigner | ReceizBundleSignatureV3RemoteSigner;

export type ReceizBundleSignatureV3Verification = Readonly<{
  state: "missing" | "verified" | "invalid" | "unavailable";
  error?: string;
}>;

const HEX64_RE = /^[0-9a-f]{64}$/;
const B64U_RE = /^[A-Za-z0-9_-]+$/;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const KID_RE = /^[a-z0-9._:-]{3,64}$/i;
const BOOL_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const BOOL_FALSE_VALUES = new Set(["0", "false", "no", "off"]);

let signerCache: ReceizBundleSignatureV3Signer | null | undefined;
let publicKeyCache: ReadonlyMap<string, ReceizBundleSignatureV3PublicKey> | undefined;

function normalizedEnvText(value: string | undefined): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "";
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

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
  return text;
}

function asB64uOrBase64(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (B64U_RE.test(text)) return text;
  if (!B64_RE.test(text)) return null;
  return text.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const text = normalizedEnvText(process.env[name]).toLowerCase();
  if (!text) return fallback;
  if (BOOL_TRUE_VALUES.has(text)) return true;
  if (BOOL_FALSE_VALUES.has(text)) return false;
  return fallback;
}

function parseIntEnv(name: string, fallback: number, min: number, max: number): number {
  const text = normalizedEnvText(process.env[name]);
  if (!text) return fallback;
  const parsed = Number.parseInt(text, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.trunc(parsed);
}

function parseSignerModeEnv(): "auto" | "env" | "remote" {
  const mode = normalizedEnvText(process.env.RECEIZ_SIGNING_V3_SIGNER_MODE).toLowerCase();
  if (mode === "env" || mode === "remote") return mode;
  return "auto";
}

function asUrl(value: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseStatus(value: unknown): KeyStatus {
  if (value === "retired") return "retired";
  return "active";
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

function asPulseBigInt(value: unknown): bigint | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!/^\d+$/.test(text)) return null;
    try {
      return BigInt(text);
    } catch {
      return null;
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return BigInt(value);
  }
  return null;
}

function normalizePublicKey(value: unknown): ReceizBundleSignatureV3PublicKey | null {
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

function readConfiguredLocalSignerFromEnv(): ReceizBundleSignatureV3LocalSigner | null {
  const kid = asKid(normalizedEnvText(process.env.RECEIZ_SIGNING_V3_ACTIVE_KID));
  const inlinePrivateKey = asB64u(normalizedEnvText(process.env.RECEIZ_SIGNING_V3_PRIVATE_KEY_PKCS8_B64U));
  if (!kid || !inlinePrivateKey) return null;
  return { provider: "local", kid, alg: "Ed25519", privateKeyPkcs8B64u: inlinePrivateKey };
}

function readConfiguredRemoteSignerFromEnv(): ReceizBundleSignatureV3RemoteSigner | null {
  const kid = asKid(
    normalizedEnvText(process.env.RECEIZ_SIGNING_V3_REMOTE_SIGN_KID) ||
      normalizedEnvText(process.env.RECEIZ_SIGNING_V3_ACTIVE_KID)
  );
  const signUrl = asUrl(normalizedEnvText(process.env.RECEIZ_SIGNING_V3_REMOTE_SIGN_URL));
  if (!kid || !signUrl) return null;
  const timeoutMs = parseIntEnv("RECEIZ_SIGNING_V3_REMOTE_SIGN_TIMEOUT_MS", 4_000, 250, 15_000);
  const bearerToken = normalizedEnvText(process.env.RECEIZ_SIGNING_V3_REMOTE_SIGN_BEARER_TOKEN) || undefined;
  const apiKey = normalizedEnvText(process.env.RECEIZ_SIGNING_V3_REMOTE_SIGN_API_KEY) || undefined;
  return {
    provider: "remote",
    kid,
    alg: "Ed25519",
    signUrl,
    timeoutMs,
    ...(bearerToken ? { bearerToken } : {}),
    ...(apiKey ? { apiKey } : {}),
  };
}

function parseConfiguredSignerFromEnv(): ReceizBundleSignatureV3Signer | null {
  const mode = parseSignerModeEnv();
  const localSigner = readConfiguredLocalSignerFromEnv();
  const remoteSigner = readConfiguredRemoteSignerFromEnv();
  if (mode === "env") return localSigner;
  if (mode === "remote") return remoteSigner;
  return remoteSigner ?? localSigner;
}

function parseConfiguredPublicKeysFromEnv(): ReadonlyMap<string, ReceizBundleSignatureV3PublicKey> {
  const out = new Map<string, ReceizBundleSignatureV3PublicKey>();
  const raw = normalizedEnvText(
    process.env.RECEIZ_SIGNING_V3_PUBLIC_KEYS_JSON ?? process.env.NEXT_PUBLIC_RECEIZ_SIGNING_V3_PUBLIC_KEYS_JSON
  );
  if (!raw) return out;
  try {
    const parsedRaw = JSON.parse(raw) as unknown;
    const parsed =
      typeof parsedRaw === "string"
        ? ((): unknown => {
            const nested = parsedRaw.trim();
            if (!nested) return [];
            try {
              return JSON.parse(nested) as unknown;
            } catch {
              return [];
            }
          })()
        : parsedRaw;
    if (!Array.isArray(parsed)) return out;
    for (const entry of parsed) {
      const key = normalizePublicKey(entry);
      if (!key) continue;
      out.set(key.kid, key);
    }
  } catch {
    return out;
  }
  return out;
}

function validateConfiguredSignerForRollout(signer: ReceizBundleSignatureV3Signer | null): ReceizBundleSignatureV3Signer | null {
  if (!signer) return null;
  const publicKeys = parseConfiguredPublicKeysFromEnv();
  const key = publicKeys.get(signer.kid) ?? null;
  const requirePublicRingMatch = parseBoolEnv(
    "RECEIZ_SIGNING_V3_REQUIRE_SIGNER_KID_IN_PUBLIC_KEYS",
    process.env.NODE_ENV === "production",
  );

  if (!key) {
    if (requirePublicRingMatch) {
      console.error("receiz_signature_v3_signer_not_in_public_key_ring", { kid: signer.kid, provider: signer.provider });
      return null;
    }
    console.warn("receiz_signature_v3_signer_not_in_public_key_ring", { kid: signer.kid, provider: signer.provider });
    return signer;
  }

  if (key.alg !== signer.alg) {
    console.error("receiz_signature_v3_signer_alg_mismatch", {
      kid: signer.kid,
      signerAlg: signer.alg,
      publicKeyAlg: key.alg,
      provider: signer.provider,
    });
    return null;
  }

  if (key.status === "retired") {
    if (requirePublicRingMatch) {
      console.error("receiz_signature_v3_signer_key_retired", { kid: signer.kid, provider: signer.provider });
      return null;
    }
    console.warn("receiz_signature_v3_signer_key_retired", { kid: signer.kid, provider: signer.provider });
  }

  return signer;
}

export function configuredReceizBundleSignerV3(): ReceizBundleSignatureV3Signer | null {
  if (process.env.NODE_ENV === "development") {
    return validateConfiguredSignerForRollout(parseConfiguredSignerFromEnv());
  }
  if (typeof signerCache !== "undefined") return signerCache;
  signerCache = validateConfiguredSignerForRollout(parseConfiguredSignerFromEnv());
  return signerCache;
}

export function configuredReceizBundleSignatureV3PublicKeys(): ReadonlyMap<string, ReceizBundleSignatureV3PublicKey> {
  if (process.env.NODE_ENV === "development") return parseConfiguredPublicKeysFromEnv();
  if (typeof publicKeyCache !== "undefined") return publicKeyCache;
  publicKeyCache = parseConfiguredPublicKeysFromEnv();
  return publicKeyCache;
}

function signedPayloadForBundle(bundle: Omit<ReceizProofBundle, "signatureV3" | "signatureV4">): string {
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
    wireproof: bundle.wireproof ?? null,
  } as const;
  return jcsCanonicalize(canonical);
}

async function importPrivateKeyPkcs8B64u(privateKeyPkcs8B64u: string): Promise<CryptoKey | null> {
  try {
    const privateKeyPkcs8 = base64UrlDecode(privateKeyPkcs8B64u);
    return await crypto.subtle.importKey("pkcs8", toArrayBuffer(privateKeyPkcs8), { name: "Ed25519" }, false, ["sign"]);
  } catch {
    return null;
  }
}

async function importPublicKeyRawB64u(publicKeyRawB64u: string): Promise<CryptoKey | null> {
  try {
    const publicKeyRaw = base64UrlDecode(publicKeyRawB64u);
    return await crypto.subtle.importKey("raw", toArrayBuffer(publicKeyRaw), { name: "Ed25519" }, false, ["verify"]);
  } catch {
    return null;
  }
}

async function signWithRemoteSigner(args: {
  signer: ReceizBundleSignatureV3RemoteSigner;
  payloadBytes: Uint8Array;
  payloadHashSha256: string;
}): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.signer.timeoutMs);
  try {
    const response = await fetch(args.signer.signUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(args.signer.bearerToken ? { authorization: `Bearer ${args.signer.bearerToken}` } : {}),
        ...(args.signer.apiKey ? { "x-api-key": args.signer.apiKey } : {}),
      },
      body: JSON.stringify({
        kid: args.signer.kid,
        alg: args.signer.alg,
        payloadB64u: base64UrlEncode(args.payloadBytes),
        payloadHashSha256: args.payloadHashSha256,
        context: "receiz.signatureV3.bundle",
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const raw = (await response.json()) as unknown;
    if (!isRecord(raw)) return null;
    if (typeof raw.kid === "string" && raw.kid.trim() && raw.kid.trim() !== args.signer.kid) {
      return null;
    }
    return (
      asB64uOrBase64(raw.sig) ??
      asB64uOrBase64(raw.signature) ??
      asB64uOrBase64(raw.signatureB64u) ??
      asB64uOrBase64(raw.signature_b64u)
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function maybeSignReceizBundleV3(
  bundle: Omit<ReceizProofBundle, "signatureV3" | "signatureV4">,
  signer = configuredReceizBundleSignerV3()
): Promise<ReceizBundleSignatureV3 | null> {
  if (!signer) return null;

  const payload = signedPayloadForBundle(bundle);
  const payloadBytes = new TextEncoder().encode(payload);
  const payloadHashSha256 = (await sha256Hex(payloadBytes)).toLowerCase();
  let signatureB64u: string | null = null;

  if (signer.provider === "remote") {
    signatureB64u = await signWithRemoteSigner({
      signer,
      payloadBytes,
      payloadHashSha256,
    });
    if (!signatureB64u) {
      const allowLocalFallback =
        parseSignerModeEnv() === "auto" && parseBoolEnv("RECEIZ_SIGNING_V3_REMOTE_ALLOW_ENV_FALLBACK", true);
      if (allowLocalFallback) {
        const localFallback = validateConfiguredSignerForRollout(readConfiguredLocalSignerFromEnv());
        if (
          localFallback &&
          localFallback.provider === "local" &&
          localFallback.kid === signer.kid &&
          localFallback.alg === signer.alg
        ) {
          const privateKey = await importPrivateKeyPkcs8B64u(localFallback.privateKeyPkcs8B64u);
          if (privateKey) {
            const sigBytes = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, toArrayBuffer(payloadBytes)));
            signatureB64u = base64UrlEncode(sigBytes);
          }
        }
      }
    }
  } else {
    const privateKey = await importPrivateKeyPkcs8B64u(signer.privateKeyPkcs8B64u);
    if (!privateKey) return null;
    const sigBytes = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, toArrayBuffer(payloadBytes)));
    signatureB64u = base64UrlEncode(sigBytes);
  }
  if (!signatureB64u) return null;

  return {
    version: 1,
    alg: "Ed25519",
    kid: signer.kid,
    sig: signatureB64u,
    payloadHashSha256,
    signedAtMs: Date.now(),
  };
}

function normalizeSignature(value: unknown): ReceizBundleSignatureV3 | null {
  if (!isRecord(value)) return null;
  const version = value.version === 1 ? 1 : null;
  const alg = value.alg === "Ed25519" ? "Ed25519" : null;
  const kid = asKid(value.kid);
  const sig = asB64u(value.sig);
  const payloadHashSha256 =
    typeof value.payloadHashSha256 === "string" ? value.payloadHashSha256.trim().toLowerCase() : "";
  const signedAtMs =
    typeof value.signedAtMs === "number" && Number.isFinite(value.signedAtMs) ? Math.trunc(value.signedAtMs) : Number.NaN;
  if (!version || !alg || !kid || !sig || !HEX64_RE.test(payloadHashSha256) || !Number.isFinite(signedAtMs) || signedAtMs < 0) {
    return null;
  }
  return { version, alg, kid, sig, payloadHashSha256, signedAtMs };
}

export async function verifyReceizBundleSignatureV3(args: {
  bundle: ReceizProofBundle;
  publicKeys?: ReadonlyMap<string, ReceizBundleSignatureV3PublicKey> | null;
}): Promise<ReceizBundleSignatureV3Verification> {
  const rawSignature = (args.bundle as Record<string, unknown>).signatureV3;
  const signature = normalizeSignature(rawSignature);
  if (!signature) {
    return typeof rawSignature === "undefined"
      ? { state: "missing" }
      : { state: "invalid", error: "signatureV3 payload is malformed." };
  }

  const signedBundle = { ...args.bundle } as Omit<ReceizProofBundle, "signatureV3" | "signatureV4"> & {
    signatureV3?: unknown;
    signatureV4?: unknown;
  };
  delete (signedBundle as { signatureV3?: unknown }).signatureV3;
  delete signedBundle.signatureV4;

  const payload = signedPayloadForBundle(signedBundle);
  const payloadBytes = new TextEncoder().encode(payload);
  const payloadHashSha256 = (await sha256Hex(payloadBytes)).toLowerCase();
  if (payloadHashSha256 !== signature.payloadHashSha256) {
    return { state: "invalid", error: "signatureV3 payload hash mismatch." };
  }

  const publicKeys = args.publicKeys ?? configuredReceizBundleSignatureV3PublicKeys();
  const publicKey = publicKeys.get(signature.kid) ?? null;
  if (!publicKey) {
    return { state: "unavailable", error: "signatureV3 key not configured." };
  }
  if (publicKey.alg !== signature.alg) {
    return { state: "invalid", error: "signatureV3 algorithm mismatch." };
  }

  // Key lifecycle policy is pulse-bound and deterministic.
  const bundlePulse = asPulseBigInt((args.bundle as { kaiPulseEternal?: unknown }).kaiPulseEternal);
  if (bundlePulse === null) {
    return { state: "invalid", error: "signatureV3 bundle pulse is invalid." };
  }

  if (publicKey.activeFromPulse && bundlePulse < BigInt(publicKey.activeFromPulse)) {
    return { state: "invalid", error: "signatureV3 predates key activation." };
  }

  if (publicKey.status === "retired" && !publicKey.retiredAtPulse) {
    return { state: "unavailable", error: "signatureV3 key retired without retirement pulse." };
  }

  if (publicKey.retiredAtPulse && bundlePulse > BigInt(publicKey.retiredAtPulse)) {
    return { state: "unavailable", error: "signatureV3 key retired for this bundle pulse." };
  }

  const cryptoKey = await importPublicKeyRawB64u(publicKey.publicKeyRawB64u);
  if (!cryptoKey) {
    return { state: "invalid", error: "signatureV3 key import failed." };
  }

  let verified = false;
  try {
    verified = await crypto.subtle.verify(
      "Ed25519",
      cryptoKey,
      toArrayBuffer(base64UrlDecode(signature.sig)),
      toArrayBuffer(payloadBytes)
    );
  } catch {
    verified = false;
  }
  if (!verified) {
    return { state: "invalid", error: "signatureV3 verification failed." };
  }
  return { state: "verified" };
}

export function coerceReceizBundleSignatureV3(value: unknown): ReceizBundleSignatureV3 | null {
  return normalizeSignature(value);
}

export function coerceReceizBundleSignatureV3PublicKeys(value: unknown): ReadonlyMap<string, ReceizBundleSignatureV3PublicKey> {
  if (!Array.isArray(value)) return new Map();
  const out = new Map<string, ReceizBundleSignatureV3PublicKey>();
  for (const entry of value) {
    const key = normalizePublicKey(entry);
    if (!key) continue;
    out.set(key.kid, key);
  }
  return out;
}
