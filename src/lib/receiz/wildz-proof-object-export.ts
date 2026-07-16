import type {
  ReceizClient,
  ReceizProofObjectCreateInput,
  ReceizProofObjectCreateResult
} from "@receiz/sdk";
import {
  readPortableCardFromPng,
  readPortableVaultFromPng,
  verifyPortableCardPng,
  verifyPortableVaultPng
} from "../../features/play/card-export";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";

export type WildzExportProofObjectActor = {
  actorId: string;
  profileHandle: string;
  receizUserId: string;
};

export type WildzExportProofObjectCreator = ReceizClient["assets"]["createProofObject"];

export const MAX_WILDZ_PROOF_OBJECT_BYTES = 64 * 1024 * 1024;

function strictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", strictArrayBuffer(bytes)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nonEmpty(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function safeSourceFilename(value: string) {
  const basename = value.trim().split(/[\\/]/).at(-1) ?? "";
  if (!basename || basename.length > 180 || !/^[a-zA-Z0-9._-]+$/.test(basename)) {
    throw new Error("wildz_proof_object_filename_invalid");
  }
  return basename.toLowerCase().endsWith(".png") ? basename : `${basename}.png`;
}

function requireOwnedWildzPng(
  kind: "card" | "vault",
  bytes: Uint8Array,
  actor: WildzExportProofObjectActor
) {
  if (!bytes.byteLength || bytes.byteLength > MAX_WILDZ_PROOF_OBJECT_BYTES) {
    throw new Error("wildz_proof_object_size_invalid");
  }
  if (kind === "card") {
    const verified = verifyPortableCardPng(bytes);
    const proof = readPortableCardFromPng(bytes);
    if (!verified.ok || !verified.asset || proof.asset.id !== verified.asset.id) {
      throw new Error("wildz_proof_object_card_invalid");
    }
    if (!sameWildzPlayerCoordinate(verified.asset.manifest.ownerReceizId, actor.profileHandle)) {
      throw new Error("wildz_proof_object_owner_mismatch");
    }
    return;
  }

  const verified = verifyPortableVaultPng(bytes);
  const proof = readPortableVaultFromPng(bytes);
  if (!verified.ok || !verified.player || proof.schema !== "receiz.wilds_vault_png_proof.v3") {
    throw new Error("wildz_proof_object_player_vault_required");
  }
  if (!sameWildzPlayerCoordinate(verified.player.playerId, actor.profileHandle)) {
    throw new Error("wildz_proof_object_owner_mismatch");
  }
}

function requireVerifiedContinuity(
  result: ReceizProofObjectCreateResult,
  actor: WildzExportProofObjectActor
) {
  const continuity = result.continuity;
  const bundle = asRecord(result.verification.bundle);
  const verifiedClaimId = typeof bundle.receizClaimId === "string"
    ? bundle.receizClaimId.trim()
    : "";
  const verifiedPath = typeof bundle.verifyPath === "string"
    ? bundle.verifyPath.trim()
    : "";
  const continuityPath = continuity.verifyPath.trim();
  if (!result.verification.ok
    || result.verification.integrity?.ok === false
    || result.verification.errors.length > 0
    || result.artifact.size <= 0
    || continuity.carrier !== "native-record-seal"
    || !sameWildzPlayerCoordinate(continuity.ownerReceizId, actor.profileHandle)
    || !nonEmpty(continuity.claimId)
    || !continuityPath.startsWith("/v/")
    || verifiedClaimId !== continuity.claimId.trim()
    || (continuityPath !== verifiedPath && !continuityPath.startsWith(`${verifiedPath}?`))) {
    throw new Error("wildz_proof_object_continuity_invalid");
  }
}

export async function createWildzExportProofObject(input: {
  actor: WildzExportProofObjectActor;
  bytes: Uint8Array;
  filename: string;
  kind: "card" | "vault";
  createProofObject: WildzExportProofObjectCreator;
}) {
  requireOwnedWildzPng(input.kind, input.bytes, input.actor);
  const digest = await sha256Hex(input.bytes);
  const proofObject: ReceizProofObjectCreateInput = {
    assetType: "proof_object",
    payload: { mimeType: "image/png", bytes: input.bytes.slice() }
  };
  const created = await input.createProofObject(proofObject, {
    idempotencyKey: `wildz-v103-${digest}`,
    filename: safeSourceFilename(input.filename)
  });
  requireVerifiedContinuity(created, input.actor);
  return created;
}
