import { applyCspNonce } from "./cspNonce";
import { DOCUMENT_SEAL_GROTH16_PROOF_MANIFEST } from "./proofResourceManifest";
import { base64UrlEncode, sha256Hex } from "./sha256";

const FIELD_MODULUS = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const WASM_URL = DOCUMENT_SEAL_GROTH16_PROOF_MANIFEST.wasmUrl;
const ZKEY_URL = DOCUMENT_SEAL_GROTH16_PROOF_MANIFEST.zkeyUrl;
const SNARKJS_PUBLIC_SCRIPT_URL = "/snarkjs.min.js";
const ZK_PROVE_TIMEOUT_MS = 30_000;
let proofAssets: Promise<readonly [Uint8Array, Uint8Array]> | null = null;
function heldProofAssets() {
  if (!proofAssets) proofAssets = Promise.all([
    [WASM_URL, DOCUMENT_SEAL_GROTH16_PROOF_MANIFEST.wasmSha256],
    [ZKEY_URL, DOCUMENT_SEAL_GROTH16_PROOF_MANIFEST.zkeySha256],
  ].map(async ([url, expected]) => {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error("wildz_local_proof_resource_unavailable");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (await sha256Hex(bytes) !== expected) throw new Error("wildz_local_proof_resource_digest_mismatch");
    return bytes;
  })).then(([wasm, zkey]) => [wasm, zkey] as const).catch(error => { proofAssets = null; throw error; });
  return proofAssets;
}

const ROUND_CONSTANTS = [
  [1n, 2n],
  [3n, 4n],
  [5n, 6n],
  [7n, 8n],
  [9n, 10n],
  [11n, 12n],
  [13n, 14n],
  [15n, 16n],
] as const;

const MDS = [
  [1n, 2n],
  [3n, 4n],
] as const;

type Groth16FullProve = (
  input: Record<string, string>,
  wasmPath: Uint8Array,
  zkeyPath: Uint8Array,
  logger?: Groth16ProgressLogger,
) => Promise<{ proof: unknown; publicSignals: unknown }>;

type Groth16ProgressLogger = Readonly<{
  debug: (...values: unknown[]) => void;
  info: (...values: unknown[]) => void;
  warn: (...values: unknown[]) => void;
  error: (...values: unknown[]) => void;
}>;

type Groth16Runtime = {
  fullProve: Groth16FullProve;
};

type Groth16Envelope = Readonly<{
  v: "receiz.g16.real.v1";
  proof: Readonly<Record<string, unknown>>;
  publicSignals: readonly string[];
}>;

let fullProveCache: Promise<Groth16FullProve | null> | null = null;
let snarkjsScriptLoadPromise: Promise<void> | null = null;

type WindowWithSnarkjs = Window &
  typeof globalThis & {
    snarkjs?: { groth16?: Groth16Runtime };
  };

function modField(value: bigint): bigint {
  const out = value % FIELD_MODULUS;
  return out >= 0n ? out : out + FIELD_MODULUS;
}

function pow5(value: bigint): bigint {
  const sq = modField(value * value);
  const quad = modField(sq * sq);
  return modField(quad * value);
}

function poseidon1(secret: bigint): bigint {
  let x0 = modField(secret);
  let x1 = 0n;
  for (let i = 0; i < ROUND_CONSTANTS.length; i += 1) {
    const [rc0, rc1] = ROUND_CONSTANTS[i]!;
    const t0 = modField(x0 + rc0);
    const t1 = modField(x1 + rc1);
    const s0 = pow5(t0);
    const s1 = pow5(t1);
    x0 = modField(s0 * MDS[0][0] + s1 * MDS[0][1]);
    x1 = modField(s0 * MDS[1][0] + s1 * MDS[1][1]);
  }
  return x0;
}

function normalizeProofObject(value: unknown): Readonly<Record<string, unknown>> {
  return JSON.parse(JSON.stringify(value)) as Readonly<Record<string, unknown>>;
}

function normalizePublicSignals(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry));
}

function asHex32(fieldValue: bigint): string {
  return fieldValue.toString(16).padStart(64, "0");
}

async function hmacSha256Hex(keyText: string, message: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(keyText);
  const msgBytes = new TextEncoder().encode(message);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, msgBytes));
  return Array.from(digest)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function deriveSealSecret(args: {
  signingKey: string;
  canonicalIdentity: string;
  artifactSha256Basis: string;
}): Promise<bigint> {
  const digestHex = await hmacSha256Hex(
    args.signingKey,
    `receiz-doc-g16|${args.canonicalIdentity}|${args.artifactSha256Basis}`,
  );
  return modField(BigInt(`0x${digestHex}`));
}

function browserGroth16Runtime(): Groth16Runtime | null {
  if (typeof window === "undefined") return null;
  const runtime = (window as WindowWithSnarkjs).snarkjs?.groth16;
  if (!runtime || typeof runtime.fullProve !== "function") return null;
  return runtime;
}

async function ensureBrowserSnarkjsRuntimeFromScript(): Promise<Groth16Runtime | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  const existingRuntime = browserGroth16Runtime();
  if (existingRuntime) return existingRuntime;

  if (!snarkjsScriptLoadPromise) {
    snarkjsScriptLoadPromise = new Promise<void>((resolve, reject) => {
      const script = applyCspNonce(document.createElement("script"));
      script.src = SNARKJS_PUBLIC_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("snarkjs_script_load_failed"));
      document.head.appendChild(script);
    }).catch(() => undefined);
  }

  await snarkjsScriptLoadPromise;
  return browserGroth16Runtime();
}

async function loadGroth16FullProve(): Promise<Groth16FullProve | null> {
  if (typeof window === "undefined") return null;
  if (!fullProveCache) {
    fullProveCache = (async () => {
      const fromWindow = browserGroth16Runtime();
      if (fromWindow && typeof fromWindow.fullProve === "function") {
        return fromWindow.fullProve.bind(fromWindow);
      }

      const fromScript = await ensureBrowserSnarkjsRuntimeFromScript();
      if (fromScript && typeof fromScript.fullProve === "function") {
        return fromScript.fullProve.bind(fromScript);
      }

      return null; // The pinned first-party browser runtime is the only loader.
    })();
  }
  const loaded = await fullProveCache;
  if (!loaded) {
    fullProveCache = null;
  }
  return loaded;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutCode: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutCode)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function warmDocumentSealGroth16RuntimeAssets(): Promise<void> {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  await heldProofAssets();
}

export async function prewarmDocumentSealGroth16Runtime(): Promise<void> {
  if (typeof window === "undefined") return;
  await warmDocumentSealGroth16RuntimeAssets();
  await loadGroth16FullProve();
}

function createGroth16ProgressLogger(
  onProgress: ((ratio: number) => void) | undefined,
): Groth16ProgressLogger | undefined {
  if (!onProgress) return undefined;
  const phases = [
    { pattern: /reading wtns/i, ratio: 0.34 },
    { pattern: /reading coeffs/i, ratio: 0.4 },
    { pattern: /building abc/i, ratio: 0.48 },
    { pattern: /ifft_a|fft_a/i, ratio: 0.54 },
    { pattern: /ifft_b|fft_b/i, ratio: 0.59 },
    { pattern: /ifft_c|fft_c/i, ratio: 0.64 },
    { pattern: /join abc/i, ratio: 0.69 },
    { pattern: /reading a points/i, ratio: 0.74 },
    { pattern: /reading b1 points/i, ratio: 0.78 },
    { pattern: /reading b2 points/i, ratio: 0.82 },
    { pattern: /reading c points/i, ratio: 0.86 },
    { pattern: /reading h points|multiexp h/i, ratio: 0.9 },
  ] as const;
  let highestRatio = 0;
  const report = (...values: unknown[]) => {
    const message = values.map((value) => String(value)).join(" ");
    for (const phase of phases) {
      if (!phase.pattern.test(message) || phase.ratio <= highestRatio) continue;
      highestRatio = phase.ratio;
      onProgress(highestRatio);
    }
  };
  return Object.freeze({ debug: report, info: report, warn: report, error: report });
}

export async function generateDocumentSealGroth16ProofClient(args: {
  signingKey: string;
  canonicalIdentity: string;
  artifactSha256Basis: string;
  onProgress?: (ratio: number) => void;
}): Promise<{
  zkPoseidonHash: string;
  groth16Proof: string;
  groth16ProofDigest: string;
}> {
  args.onProgress?.(0.03);
  // Warming is scheduled by prewarmDocumentSealGroth16Runtime. It cannot gate
  // an actual seal: a hanging optional fetch used to stop Showcase visibility
  // before a successor head existed, even with the proof runtime already held.
  args.onProgress?.(0.14);

  const fullProve = await withTimeout(loadGroth16FullProve(), ZK_PROVE_TIMEOUT_MS, "groth16_runtime_timeout");
  if (!fullProve) {
    throw new Error("groth16_runtime_unavailable");
  }
  args.onProgress?.(0.22);

  const secret = await deriveSealSecret(args);
  const expectedHashField = poseidon1(secret);
  const expectedHashDec = expectedHashField.toString();
  args.onProgress?.(0.28);

  const [wasm, zkey] = await heldProofAssets();
  const proveResult = await withTimeout(
    fullProve(
      {
        secret: secret.toString(),
        expectedHash: expectedHashDec,
      },
      wasm,
      zkey,
      createGroth16ProgressLogger(args.onProgress),
    ),
    ZK_PROVE_TIMEOUT_MS,
    "groth16_prove_timeout",
  );
  args.onProgress?.(0.94);

  const { proof, publicSignals } = proveResult;

  const normalizedProof = normalizeProofObject(proof);
  const normalizedSignals = normalizePublicSignals(publicSignals);

  if (normalizedSignals.length < 2) {
    throw new Error("groth16_public_signals_missing");
  }
  if (normalizedSignals[0] !== expectedHashDec || normalizedSignals[1] !== expectedHashDec) {
    throw new Error("groth16_public_signal_mismatch");
  }

  const envelope: Groth16Envelope = {
    v: "receiz.g16.real.v1",
    proof: normalizedProof,
    publicSignals: normalizedSignals,
  };

  const envelopeBytes = new TextEncoder().encode(JSON.stringify(envelope));
  const encodedProof = `g16:${base64UrlEncode(envelopeBytes)}`;
  const proofDigest = (await sha256Hex(encodedProof)).toLowerCase();
  args.onProgress?.(1);

  return {
    zkPoseidonHash: asHex32(expectedHashField),
    groth16Proof: encodedProof,
    groth16ProofDigest: proofDigest,
  };
}
