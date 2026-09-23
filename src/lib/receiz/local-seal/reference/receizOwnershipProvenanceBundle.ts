import { deflateSync, inflateSync } from "fflate";
import { jcsCanonicalize } from "./jcs";
import { base64UrlDecode, base64UrlEncode } from "./sha256";
import { parseProfileUsername } from "./username";

export const RECEIZ_OWNERSHIP_PROVENANCE_CHUNK_KEY = "receiz.ownership_provenance" as const;

const RECEIZ_OWNERSHIP_PROVENANCE_CODEC = "c1" as const;
const MAX_PROVENANCE_ENCODE_BYTES = 8 * 1024 * 1024;
const MAX_PROVENANCE_DECODE_BYTES = 16 * 1024 * 1024;

export type ReceizOwnershipProvenanceIdentity = Readonly<{
  userId: string;
  username: string | null;
  displayName: string | null;
  label: string;
  profilePath: string | null;
}>;

export type ReceizOwnershipProvenanceTransfer = Readonly<{
  from: ReceizOwnershipProvenanceIdentity | null;
  to: ReceizOwnershipProvenanceIdentity | null;
  transferredAt: string;
  ledgerKey?: string | null;
  messageId?: string | null;
}>;

export type ReceizOwnershipProvenanceBundle = Readonly<{
  kind: "receiz.ownership_provenance";
  version: 1;
  generatedAt: string;
  slug: string;
  code: string;
  pulse: string;
  verifyPath: string;
  currentOwner: ReceizOwnershipProvenanceIdentity | null;
  originalCreator: ReceizOwnershipProvenanceIdentity | null;
  transfers: ReceizOwnershipProvenanceTransfer[];
  complete: boolean;
  nextCursor: string | null;
}>;

export type ReceizOwnershipContinuityProofCoordinates = Readonly<{
  slug: string;
  code: string;
  pulse: string;
  verifyPath: string;
}>;

export function validateReceizOwnershipProvenanceContinuity(args: {
  provenance: ReceizOwnershipProvenanceBundle;
  proof: ReceizOwnershipContinuityProofCoordinates;
}):
  | Readonly<{ ok: true; ownerReceizId: string }>
  | Readonly<{ ok: false; error: "continuity_coordinate_mismatch" | "continuity_ownership_missing" }> {
  const expectedPath = `/v/${args.proof.slug}/${args.proof.code}/${args.proof.pulse}`;
  if (
    args.provenance.slug !== args.proof.slug
    || args.provenance.code !== args.proof.code
    || args.provenance.pulse !== args.proof.pulse
    || args.provenance.verifyPath !== args.proof.verifyPath
    || args.proof.verifyPath !== expectedPath
  ) {
    return { ok: false, error: "continuity_coordinate_mismatch" };
  }

  const owner = args.provenance.currentOwner ?? args.provenance.originalCreator;
  const candidate = owner?.username?.trim().toLowerCase() ?? "";
  const username = parseProfileUsername(candidate);
  if (!owner?.userId.trim() || !username || username !== candidate) {
    return { ok: false, error: "continuity_ownership_missing" };
  }
  return { ok: true, ownerReceizId: `${username}.receiz.id` };
}

function assertBundleSize(bytes: Uint8Array, maxBytes: number, label: string): void {
  if (bytes.byteLength > maxBytes) {
    throw new Error(`${label} too large`);
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asIdentity(value: unknown): ReceizOwnershipProvenanceIdentity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const userId = asString(record.userId);
  const label = asString(record.label);
  if (!userId || !label) return null;
  return {
    userId,
    username: asNullableString(record.username),
    displayName: asNullableString(record.displayName),
    label,
    profilePath: asNullableString(record.profilePath),
  };
}

function asTransfer(value: unknown): ReceizOwnershipProvenanceTransfer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const transferredAt = asString(record.transferredAt);
  if (!transferredAt) return null;
  return {
    from: asIdentity(record.from),
    to: asIdentity(record.to),
    transferredAt,
    ledgerKey: asNullableString(record.ledgerKey),
    messageId: asNullableString(record.messageId),
  };
}

function isTransfer(value: ReceizOwnershipProvenanceTransfer | null): value is ReceizOwnershipProvenanceTransfer {
  return value !== null;
}

export function encodeReceizOwnershipProvenanceBundle(bundle: ReceizOwnershipProvenanceBundle): string {
  const canonical = jcsCanonicalize(bundle);
  const bytes = new TextEncoder().encode(canonical);
  assertBundleSize(bytes, MAX_PROVENANCE_ENCODE_BYTES, "ownership provenance bundle");
  return `${RECEIZ_OWNERSHIP_PROVENANCE_CODEC}.${base64UrlEncode(deflateSync(bytes))}`;
}

export function decodeReceizOwnershipProvenanceBundle(raw: string): ReceizOwnershipProvenanceBundle | null {
  const [codec, encoded] = raw.split(".", 2);
  if (codec !== RECEIZ_OWNERSHIP_PROVENANCE_CODEC || !encoded) return null;

  let inflated: Uint8Array;
  try {
    inflated = inflateSync(base64UrlDecode(encoded));
  } catch {
    return null;
  }
  assertBundleSize(inflated, MAX_PROVENANCE_DECODE_BYTES, "ownership provenance bundle");

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(inflated));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (record.kind !== "receiz.ownership_provenance" || record.version !== 1) return null;
  const generatedAt = asString(record.generatedAt);
  const slug = asString(record.slug);
  const code = asString(record.code);
  const pulse = asString(record.pulse);
  const verifyPath = asString(record.verifyPath);
  if (!generatedAt || !slug || !code || !pulse || !verifyPath) return null;

  return {
    kind: "receiz.ownership_provenance",
    version: 1,
    generatedAt,
    slug,
    code,
    pulse,
    verifyPath,
    currentOwner: asIdentity(record.currentOwner),
    originalCreator: asIdentity(record.originalCreator),
    transfers: Array.isArray(record.transfers) ? record.transfers.map(asTransfer).filter(isTransfer) : [],
    complete: record.complete === true,
    nextCursor: asNullableString(record.nextCursor),
  };
}
