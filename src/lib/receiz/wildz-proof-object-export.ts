import { readReceizIdentityArtifact } from "@receiz/sdk";
import { readWildsMapFromPng } from "../../features/play/wilds-map-image";
import type { WildzGameImageKind } from "./wildz-game-image-export";
import { assertWildzRemoteSealPayloadSafe } from "./wildz-remote-seal-guard";
import { packWildzCardSealPayload } from "./wildz-card-seal-payload";
import { splitWildzPngEnvelope } from "./wildz-png-envelope";
import { requireWildzIdentityBindingFromEnvelope } from "./wildz-identity-binding";
import type {
  ReceizClient,
  ReceizProofObjectCreateInput
} from "@receiz/sdk";
import {
  readPortableCardFromPng,
  readPortableVaultFromPng,
  readWildzPlayerVaultAppendFromPng,
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

export function requireVerifiedWildzPng(
  kind: "card" | "vault",
  bytes: Uint8Array
) {
  if (!bytes.byteLength || bytes.byteLength > MAX_WILDZ_PROOF_OBJECT_BYTES) {
    throw new Error("wildz_proof_object_size_invalid");
  }
  bytes = splitWildzPngEnvelope(bytes).pngBasis;
  if (kind === "card") {
    const verified = verifyPortableCardPng(bytes);
    const proof = readPortableCardFromPng(bytes);
    if (!verified.ok || !verified.asset || proof.asset.id !== verified.asset.id) {
      throw new Error("wildz_proof_object_card_invalid");
    }
    return verified.asset.manifest.ownerReceizId;
  }

  const verified = verifyPortableVaultPng(bytes);
  const proof = readPortableVaultFromPng(bytes);
  let playerAppend: ReturnType<typeof readWildzPlayerVaultAppendFromPng>;
  try {
    playerAppend = readWildzPlayerVaultAppendFromPng(bytes);
  } catch {
    throw new Error("wildz_proof_object_player_vault_required");
  }
  if (!verified.ok || playerAppend.base.vaultDigest !== proof.vaultDigest) {
    throw new Error("wildz_proof_object_player_vault_required");
  }
  return playerAppend.player.playerId;
}

export function requireOwnedWildzPng(
  kind: "card" | "vault",
  bytes: Uint8Array,
  actor: WildzExportProofObjectActor
) {
  const ownerReceizId = requireVerifiedWildzPng(kind, bytes);
  if (!sameWildzPlayerCoordinate(ownerReceizId, actor.profileHandle)) {
    throw new Error("wildz_proof_object_owner_mismatch");
  }
}

export async function createWildzExportProofObject(input: {
  actor: WildzExportProofObjectActor;
  bytes: Uint8Array;
  filename: string;
  kind: WildzGameImageKind;
  createProofObject: WildzExportProofObjectCreator;
  artifacts: WildzArtifactPort;
}) {
  if (input.kind === "map") readWildsMapFromPng(input.bytes);
  else if (input.kind === "identity") {
    const identity = await readReceizIdentityArtifact(input.bytes);
    if (!identity.owner.username || !sameWildzPlayerCoordinate(identity.owner.username, input.actor.profileHandle))
      throw new Error("wildz_proof_object_owner_mismatch");
  } else requireOwnedWildzPng(input.kind, input.bytes, input.actor);
  await assertWildzRemoteSealPayloadSafe(input.bytes);
  if (input.kind !== "identity" && splitWildzPngEnvelope(input.bytes).trailer.length) {
    const binding = await requireWildzIdentityBindingFromEnvelope(input.bytes);
    if (!sameWildzPlayerCoordinate(binding.playerId, input.actor.profileHandle))
      throw new Error("wildz_proof_object_owner_mismatch");
  }
  const payloadBytes = await packWildzCardSealPayload(input.bytes);
  const digest = await sha256Hex(payloadBytes);
  const proofObject: ReceizProofObjectCreateInput = {
    assetType: "proof_object",
    payload: { mimeType: "image/png", bytes: payloadBytes }
  };
  const artifact = await input.createProofObject(proofObject, {
    idempotencyKey: `wildz-v126-${digest}`,
    filename: safeSourceFilename(input.filename)
  });
  const admitted = await downloadAndReopenWildzArtifact(artifact, input.artifacts);
  if (admitted.payloadSha256 !== digest) throw new Error("wildz_artifact_payload_mismatch");
  if (!sameWildzPlayerCoordinate(admitted.ownerReceizId, input.actor.profileHandle)) {
    throw new Error("wildz_proof_object_owner_mismatch");
  }
  return { artifact, admitted };
}
