import { readReceizIdentityArtifact } from "@receiz/sdk";
import type { createReceizOfflineSealer } from "@receiz/sdk/offline";
import { requireWildzIdentityBindingFromEnvelope } from "../wildz-identity-binding";
import { readWildsMapFromPng } from "../../../features/play/wilds-map-image";
import { requireVerifiedWildzPng } from "../wildz-proof-object-export";
import { hasWildzCanonicalPngProof, splitWildzPngEnvelope } from "../wildz-png-envelope";
import { sameWildzPlayerCoordinate } from "../wildz-player-coordinate";
import { packWildzCardSealPayload } from "../wildz-card-seal-payload";
import { openWildzSealedCard, verifyWildzSealedCard } from "../wildz-sealed-card";

export async function openCanonicalWildzCard(bytes: Uint8Array, filename = "wildz-card.png") {
  const admitted = await openWildzSealedCard({ bytes, name: filename, mimeType: "image/png" });
  return { admitted, payload: admitted.payloadBytes };
}

/** The SDK seals the complete payload; game identity and proof validation stay
 * independent of the signing device. Existing enclosing proofs are never resealed. */
export async function sealWildzCardLocally(input: {
  payload: Uint8Array;
  filename: string;
  sealer: Pick<ReturnType<typeof createReceizOfflineSealer>, "seal">;
  kind?: "card" | "vault" | "identity" | "map";
  mapOwner?: string;
}) {
  if (hasWildzCanonicalPngProof(input.payload)) throw new Error("wildz_existing_proof_must_be_reused_or_transitioned");
  if (input.kind === "map") {
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
  const result = await input.sealer.seal({ bytes: await packWildzCardSealPayload(input.payload),
    filename: input.filename, mimeType: "image/png" });
  await verifyWildzSealedCard(result.artifactBytes, input.payload);
  return { bytes: result.artifactBytes.slice(), filename: result.filename, mimeType: result.mimeType };
}
