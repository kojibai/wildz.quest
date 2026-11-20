import type {WildzGameImageKind} from '../wildz-game-image-export';
import {readCreationImage,verifyCreationImageAssets} from '../../../features/play/creation/image';
import { sha256ReceizBytes, readReceizIdentityArtifact } from "@receiz/sdk";
import type { createReceizOfflineSealer } from "@receiz/sdk/offline";
import { requireWildzIdentityBindingFromEnvelope } from "../wildz-identity-binding";
import { readWildsMapFromPng } from "../../../features/play/wilds-map-image";
import { requireVerifiedWildzPng } from "../wildz-proof-object-export";
import { hasWildzCanonicalPngProof, splitWildzPngEnvelope } from "../wildz-png-envelope";
import { sameWildzPlayerCoordinate } from "../wildz-player-coordinate";
import { packWildzCardSealPayload } from "../wildz-card-seal-payload";
import { openWildzSealedCard } from "../wildz-sealed-card";

type SdkSeal = ReturnType<typeof createReceizOfflineSealer>["seal"];
export type WildzCardSealResult = Pick<Awaited<ReturnType<SdkSeal>>, "artifactBytes" | "filename" | "mimeType">;

export async function openCanonicalWildzCard(bytes: Uint8Array, filename = "wildz-card.png") {
  const admitted = await openWildzSealedCard({ bytes, name: filename, mimeType: "image/png" });
  return { admitted, payload: admitted.payloadBytes };
}

/** The SDK seals the complete payload; game identity and proof validation stay
 * independent of the signing device. Existing enclosing proofs are never resealed. */
export async function sealWildzCardLocally(input: {
  payload: Uint8Array;
  filename: string;
  sealer: { seal(input: Parameters<SdkSeal>[0]): Promise<WildzCardSealResult> };
  kind?: WildzGameImageKind;
  mapOwner?: string;
}) {
  if (hasWildzCanonicalPngProof(input.payload)) throw new Error("wildz_existing_proof_must_be_reused_or_transitioned");
  input = { ...input, payload: input.payload.slice() };
  if (input.kind === "creation") {
    const {pngBasis,trailer}=splitWildzPngEnvelope(input.payload),creation=readCreationImage(pngBasis);
    if (!input.mapOwner || !sameWildzPlayerCoordinate(creation.checkpoint.instances[0]!.ownerId,input.mapOwner)) throw new Error("wildz_proof_object_owner_mismatch");
    if (!await verifyCreationImageAssets(creation)) throw new Error("wildz_proof_object_creation_assets_invalid");
    if (trailer.length) { const binding=await requireWildzIdentityBindingFromEnvelope(input.payload);if(!sameWildzPlayerCoordinate(binding.playerId,input.mapOwner))throw new Error("wildz_proof_object_owner_mismatch"); }
  } else if (input.kind === "map") {
    readWildsMapFromPng(input.payload);
  } else if (input.kind === "identity") {
    await readReceizIdentityArtifact(input.payload);
  } else if (splitWildzPngEnvelope(input.payload).trailer.length) {
    await requireWildzIdentityBindingFromEnvelope(input.payload);
  } else {
    const playerId = requireVerifiedWildzPng(input.kind ?? "card", input.payload);
    if (!input.mapOwner || !sameWildzPlayerCoordinate(playerId, input.mapOwner))
      throw new Error("wildz_proof_object_owner_mismatch");
  }
  const packed = await packWildzCardSealPayload(input.payload);
  const expectedDigest = await sha256ReceizBytes(packed);
  const result = await input.sealer.seal({ bytes: packed,
    filename: input.filename, mimeType: "image/png" });
  const opened = await openWildzSealedCard({ bytes: result.artifactBytes, mimeType: result.mimeType });
  if (opened.payloadSha256 !== expectedDigest || opened.payloadBytes.length !== input.payload.length
    || !opened.payloadBytes.every((byte, index) => byte === input.payload[index]))
    throw new Error("wildz_card_payload_binding_invalid");
  const bytes = result.artifactBytes.buffer instanceof ArrayBuffer
    ? new Uint8Array(result.artifactBytes.buffer, result.artifactBytes.byteOffset, result.artifactBytes.byteLength)
    : new Uint8Array(result.artifactBytes);
  return { bytes, filename: result.filename, mimeType: result.mimeType };
}
