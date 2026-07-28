/**
 * Read-only compatibility codec for Receiz SDK v102 portable-asset bundles.
 *
 * Receiz SDK v114 does not export this retired developer-authored container. Wildz
 * keeps this bounded decoder solely so already-issued `receiz.portable_asset.v1`
 * artifacts remain recoverable. New artifacts must use the current SDK native
 * Record -> Seal proof-object flow instead.
 */

export type LegacyPortableJson = null | boolean | number | string | LegacyPortableJson[] | {
  [key: string]: LegacyPortableJson;
};

export type LegacyReceizPortableAssetType =
  | "proof_object"
  | "sports_card"
  | "signal_card"
  | "wallet_note"
  | "market_certificate"
  | "profile_original"
  | "document";

export type LegacyReceizPortableAssetDocument = Readonly<{
  schema: "receiz.portable_asset.v1";
  assetType: LegacyReceizPortableAssetType;
  payload: Readonly<{
    mimeType: string;
    bytesBase64Url: string;
    sha256: string;
  }>;
  ownership: Readonly<{
    ownerReceizId: string;
    custody: string;
    proofRef: string;
  }>;
  provenance: Readonly<{
    root: string;
    appends: readonly Readonly<Record<string, LegacyPortableJson>>[];
  }>;
  settlement: Readonly<Record<string, LegacyPortableJson>>;
}>;

export type LegacyReceizPortableAssetInput = Readonly<{
  assetType: LegacyReceizPortableAssetType;
  payload: Readonly<{ mimeType: string; bytes: Uint8Array }>;
  ownership: LegacyReceizPortableAssetDocument["ownership"];
  provenance: LegacyReceizPortableAssetDocument["provenance"];
  settlement: LegacyReceizPortableAssetDocument["settlement"];
}>;

export type LegacyReceizPortableAssetErrorCode =
  | "continuity_artifact_too_large"
  | "continuity_payload_missing"
  | "continuity_media_unbound"
  | "continuity_ownership_missing"
  | "continuity_provenance_missing"
  | "continuity_settlement_missing"
  | "continuity_append_mismatch"
  | "continuity_schema_unsupported"
  | "continuity_offline_verification_failed"
  | "continuity_round_trip_failed";

export class LegacyReceizPortableAssetError extends Error {
  constructor(readonly code: LegacyReceizPortableAssetErrorCode) {
    super(code);
    this.name = "LegacyReceizPortableAssetError";
  }
}

const MAX_ORIGINAL_BYTES = 64 * 1024 * 1024;
const MAX_TEXT_FIELD_LENGTH = 4_096;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 100_000;
const MAX_PROVENANCE_APPENDS = 10_000;
const HEX64_RE = /^[0-9a-f]{64}$/;
const B64URL_RE = /^[A-Za-z0-9_-]*$/;
const ASSET_TYPES = new Set<LegacyReceizPortableAssetType>([
  "proof_object",
  "sports_card",
  "signal_card",
  "wallet_note",
  "market_certificate",
  "profile_original",
  "document"
]);

function fail(code: LegacyReceizPortableAssetErrorCode): never {
  throw new LegacyReceizPortableAssetError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= MAX_TEXT_FIELD_LENGTH ? normalized : null;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string, maximumBytes: number) {
  const maximumEncodedLength = Math.ceil(maximumBytes / 3) * 4;
  if (!B64URL_RE.test(value) || value.length > maximumEncodedLength || value.length % 4 === 1) {
    fail(value.length > maximumEncodedLength ? "continuity_artifact_too_large" : "continuity_payload_missing");
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    fail("continuity_payload_missing");
  }
  if (binary.length > maximumBytes) fail("continuity_artifact_too_large");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (encodeBase64Url(bytes) !== value) fail("continuity_payload_missing");
  return bytes;
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = bytes.slice();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalize(value: unknown, depth = 0, budget = { nodes: 0 }): string {
  budget.nodes += 1;
  if (depth > MAX_JSON_DEPTH || budget.nodes > MAX_JSON_NODES) fail("continuity_round_trip_failed");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry, depth + 1, budget)).join(",")}]`;
  }
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], depth + 1, budget)}`);
    return `{${entries.join(",")}}`;
  }
  return fail("continuity_round_trip_failed");
}

function parseOwnership(value: unknown): LegacyReceizPortableAssetDocument["ownership"] {
  if (!isRecord(value)) fail("continuity_ownership_missing");
  const ownerReceizId = nonempty(value.ownerReceizId);
  const custody = nonempty(value.custody);
  const proofRef = nonempty(value.proofRef);
  if (!ownerReceizId || !custody || !proofRef) fail("continuity_ownership_missing");
  return { ownerReceizId, custody, proofRef };
}

function parseProvenance(value: unknown): LegacyReceizPortableAssetDocument["provenance"] {
  if (!isRecord(value)) fail("continuity_provenance_missing");
  const root = nonempty(value.root);
  if (!root || !Array.isArray(value.appends) || value.appends.length > MAX_PROVENANCE_APPENDS) {
    fail("continuity_provenance_missing");
  }
  if (value.appends.some((append) => !isRecord(append))) fail("continuity_append_mismatch");
  return {
    root,
    appends: value.appends.map((append) => ({ ...append } as Record<string, LegacyPortableJson>))
  };
}

function parseSettlement(value: unknown): LegacyReceizPortableAssetDocument["settlement"] {
  if (!isRecord(value) || !nonempty(value.state)) fail("continuity_settlement_missing");
  return { ...value } as Record<string, LegacyPortableJson>;
}

export async function parseLegacyReceizPortableAssetDocument(
  value: unknown
): Promise<LegacyReceizPortableAssetDocument> {
  if (!isRecord(value) || value.schema !== "receiz.portable_asset.v1") {
    fail("continuity_schema_unsupported");
  }
  if (typeof value.assetType !== "string" || !ASSET_TYPES.has(value.assetType as LegacyReceizPortableAssetType)) {
    fail("continuity_schema_unsupported");
  }
  if (!isRecord(value.payload)) fail("continuity_payload_missing");
  const mimeType = nonempty(value.payload.mimeType);
  const bytesBase64Url = typeof value.payload.bytesBase64Url === "string" ? value.payload.bytesBase64Url : null;
  const claimedSha256 = typeof value.payload.sha256 === "string" ? value.payload.sha256.trim().toLowerCase() : "";
  if (!mimeType || bytesBase64Url === null || !HEX64_RE.test(claimedSha256)) {
    fail("continuity_payload_missing");
  }
  const payloadBytes = decodeBase64Url(bytesBase64Url, MAX_ORIGINAL_BYTES);
  if (await sha256Hex(payloadBytes) !== claimedSha256) fail("continuity_media_unbound");
  return {
    schema: "receiz.portable_asset.v1",
    assetType: value.assetType as LegacyReceizPortableAssetType,
    payload: { mimeType, bytesBase64Url, sha256: claimedSha256 },
    ownership: parseOwnership(value.ownership),
    provenance: parseProvenance(value.provenance),
    settlement: parseSettlement(value.settlement)
  };
}

export async function createLegacyReceizPortableAssetDocument(
  input: LegacyReceizPortableAssetInput
): Promise<LegacyReceizPortableAssetDocument> {
  if (!input?.payload?.bytes || !(input.payload.bytes instanceof Uint8Array)) {
    fail("continuity_payload_missing");
  }
  if (input.payload.bytes.byteLength > MAX_ORIGINAL_BYTES) fail("continuity_artifact_too_large");
  return parseLegacyReceizPortableAssetDocument({
    schema: "receiz.portable_asset.v1",
    assetType: input.assetType,
    payload: {
      mimeType: input.payload.mimeType,
      bytesBase64Url: encodeBase64Url(input.payload.bytes),
      sha256: await sha256Hex(input.payload.bytes)
    },
    ownership: input.ownership,
    provenance: input.provenance,
    settlement: input.settlement
  });
}

export function serializeLegacyReceizPortableAssetDocument(document: LegacyReceizPortableAssetDocument) {
  return new TextEncoder().encode(canonicalize(document));
}
