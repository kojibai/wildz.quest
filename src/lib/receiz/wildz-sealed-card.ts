import { sha256ReceizBytes } from "@receiz/sdk";
import { openWildzArtifactSameOrigin } from "./wildz-same-origin-verifier";
import { packWildzCardSealPayload, unpackWildzCardSealPayload } from "./wildz-card-seal-payload";
import { isWildzPng } from "./wildz-png-envelope";

import { openWildzSealedDocument } from "./wildz-sealed-document";

export async function openWildzSealedCard(input: { bytes: Uint8Array; mimeType: string; name?: string }) {
  // Locally sealed backups are documents. Verify that rail first instead of
  // running native-custody verification, failing, and verifying them again.
  try {
    const opened = await openWildzSealedDocument(input);
    if (!isWildzPng(opened.payloadBytes)) throw new Error("wildz_card_png_required");
    return { ...opened, compatibility: "verified-document" as const, ownerReceizId: null,
      payloadBytes: await unpackWildzCardSealPayload(opened.payloadBytes) };
  } catch (documentError) {
    try {
      const opened = await openWildzArtifactSameOrigin(input);
      if (opened.compatibility !== "current-native" || !isWildzPng(opened.payloadBytes))
        throw new Error("wildz_card_native_seal_required");
      return { ...opened, payloadBytes: await unpackWildzCardSealPayload(opened.payloadBytes) };
    } catch (nativeError) {
      // Preserve the canonical denial rather than hide resource/format failures
      // behind the native ownership rail's generic verification message.
      if (documentError instanceof Error && documentError.message.startsWith("wildz_artifact_verification_failed:")) throw documentError;
      throw nativeError;
    }
  }
}

export async function verifyWildzSealedCard(artifactBytes: Uint8Array, originalPayload: Uint8Array) {
  const opened = await openWildzSealedCard({ bytes: artifactBytes, mimeType: "application/octet-stream" });
  if (opened.payloadSha256 !== await sha256ReceizBytes(await packWildzCardSealPayload(originalPayload))
    || await sha256ReceizBytes(opened.payloadBytes) !== await sha256ReceizBytes(originalPayload))
    throw new Error("wildz_card_payload_binding_invalid");
  return opened;
}
