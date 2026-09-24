import { sha256ReceizBytes } from "@receiz/sdk";
import type { verifyReceizOfflineSealedFile } from "@receiz/sdk/offline";
import { extractWildzSealedPngBasis, isWildzPng } from "./wildz-png-envelope";

/** The public offline-file verifier is also used by the SDK sealer itself.
 * Its PNG document rail does not use the generic artifact wrapper's 16 MiB
 * materialization ceiling. This opens documents only; it grants no custody. */
export async function openWildzLargeSealedPngDocument(
  input: { bytes: Uint8Array; name?: string },
  verify?: typeof verifyReceizOfflineSealedFile
) {
  if (!isWildzPng(input.bytes) || input.bytes.byteLength > 64 * 1024 * 1024)
    throw new Error("wildz_restore_artifact_too_large");
  const bytes = input.bytes.slice();
  const verifier = verify ?? (await import("@receiz/sdk/offline")).verifyReceizOfflineSealedFile;
  const result = await verifier({ bytes, filename: input.name ?? "wildz.png", mimeType: "image/png" });
  if (!result.ok || !result.integrity.ok || result.errors.length || result.integrity.errors.length || result.denial)
    throw new Error(`wildz_artifact_verification_failed:${result.denial ? "denied" : "invalid"}:${result.denial?.code ?? "ARTIFACT_VERIFICATION_FAILED"}:bytes=${bytes.byteLength}`);
  if (result.kind !== "png" || result.assetContinuity?.state !== "not_applicable"
    || result.bundle?.nativeRecordSeal != null)
    throw new Error("wildz_document_native_custody_required");
  const payloadSha256 = result.bundle?.artifactSha256Basis;
  if (typeof payloadSha256 !== "string" || !/^[a-f0-9]{64}$/.test(payloadSha256))
    throw new Error("wildz_restore_binding_invalid");
  const payloadBytes = extractWildzSealedPngBasis(bytes);
  if (await sha256ReceizBytes(payloadBytes) !== payloadSha256)
    throw new Error("wildz_restore_binding_invalid");
  return { payloadBytes, payloadFilename: input.name ?? "wildz.png", payloadMimeType: "image/png",
    payloadSha256, sealedArtifactSha256: await sha256ReceizBytes(bytes), exactSealedArtifactBytes: bytes };
}
