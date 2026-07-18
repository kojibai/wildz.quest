import type {
  ReceizClient,
  ReceizProofObjectCreateInput
} from "@receiz/sdk";
import {
  readPortableCardFromPng,
  readPortableVaultFromPng,
  verifyPortableCardPng,
  verifyPortableVaultPng
} from "../../features/play/card-export";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import {
  downloadAndReopenWildzArtifact,
  type WildzArtifactPort
} from "./wildz-artifact-custody";

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

export async function createWildzExportProofObject(input: {
  actor: WildzExportProofObjectActor;
  bytes: Uint8Array;
  filename: string;
  kind: "card" | "vault";
  createProofObject: WildzExportProofObjectCreator;
  artifacts: WildzArtifactPort;
}) {
  requireOwnedWildzPng(input.kind, input.bytes, input.actor);
  const digest = await sha256Hex(input.bytes);
  const proofObject: ReceizProofObjectCreateInput = {
    assetType: "proof_object",
    payload: { mimeType: "image/png", bytes: input.bytes.slice() }
  };
  const artifact = await input.createProofObject(proofObject, {
    idempotencyKey: `wildz-v110-${digest}`,
    filename: safeSourceFilename(input.filename)
  });
  const admitted = await downloadAndReopenWildzArtifact(artifact, input.artifacts);
  if (!sameWildzPlayerCoordinate(admitted.ownerReceizId, input.actor.profileHandle)) {
    throw new Error("wildz_proof_object_owner_mismatch");
  }
  return { artifact, admitted };
}
