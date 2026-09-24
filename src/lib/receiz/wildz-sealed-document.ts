import {
  receizBase64UrlDecode, sha256ReceizBytes, verifyReceizArtifact, admitReceizArtifact
} from "@receiz/sdk";

import { isWildzPng, extractWildzSealedPngBasis } from "./wildz-png-envelope";
import { openWildzLargeSealedPngDocument } from "./wildz-large-sealed-document";

const MAX_BYTES = 64 * 1024 * 1024;

/** Verify the actual returned artifact and exact uploaded bytes, never response headers. */
export async function verifyWildzSealedExport(artifactBytes: Uint8Array, payloadBytes: Uint8Array) {
  if (!artifactBytes.byteLength || artifactBytes.byteLength > MAX_BYTES || payloadBytes.byteLength > MAX_BYTES)
    throw new Error("wildz_proof_object_size_invalid");
  const expected = await sha256ReceizBytes(payloadBytes);
  const verified = await verifyReceizArtifact(artifactBytes);
  if (verified.status !== "verified-artifact" || verified.payloadDigest.value !== expected)
    throw new Error("wildz_proof_object_continuity_invalid");
  return verified;
}

/** SDK127 verifies the enclosing document before exposing the exact inner payload.
 * This grants no native ownership: the inner Wildz proof and Identity signature
 * still pass the existing restore pipeline. There is no network fallback. */
export async function openWildzSealedDocument(input: { bytes: Uint8Array; mimeType: string; name?: string }) {
  if (!input.bytes.byteLength || input.bytes.byteLength > MAX_BYTES) throw new Error("wildz_restore_artifact_too_large");
  if (input.bytes.byteLength > 16 * 1024 * 1024 && isWildzPng(input.bytes))
    return openWildzLargeSealedPngDocument(input);
  const bytes = input.bytes.slice();
  const verification = await verifyReceizArtifact(bytes);
  if (verification.status !== "verified-artifact") {
    const reason = verification.status === "denied" ? verification.code
      : verification.status === "unsupported" ? verification.reason
      : verification.errors.map(error => error.code).join(",");
    throw new Error(`wildz_artifact_verification_failed:${verification.status}:${reason}:bytes=${bytes.byteLength}`);
  }
  if (verification.continuity.state !== "not_applicable") throw new Error("wildz_document_native_custody_required");
  const admission = await admitReceizArtifact(verification, { profile: "document" });
  if (admission.verdict !== "verified-document" || admission.ownerReceizId !== null)
    throw new Error("wildz_document_native_custody_required");
  // Transport extraction only. SDK's general native-artifact opener intentionally
  // rejects documents without native custody. No JSON field grants ownership;
  // the SDK-admitted payload digest binds every byte passed to the inner parser.
  let payloadBytes: Uint8Array;
  let payloadFilename = input.name ?? "wildz.png";
  let payloadMimeType = "image/png";
  if (isWildzPng(bytes)) {
    payloadBytes = extractWildzSealedPngBasis(bytes);
  } else {
    const envelope: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("wildz_restore_binding_invalid");
    const wire = envelope as Record<string, unknown>;
    const manifest = wire.manifest as Record<string, unknown> | undefined;
    if (wire.kind !== "receiz.bundle.v1" || typeof wire.originalBase64 !== "string"
      || !/^[A-Za-z0-9_-]+$/.test(wire.originalBase64)
      || Math.floor(wire.originalBase64.length * 3 / 4) > MAX_BYTES
      || !manifest || typeof manifest.filename !== "string" || typeof manifest.mime !== "string"
      || manifest.basisSha256 !== admission.payloadSha256)
      throw new Error("wildz_restore_binding_invalid");
    payloadBytes = receizBase64UrlDecode(wire.originalBase64);
    payloadFilename = manifest.filename;
    payloadMimeType = manifest.mime;
  }
  if (await sha256ReceizBytes(payloadBytes) !== admission.payloadSha256
    || admission.artifactSha256 !== verification.artifactDigest.value)
    throw new Error("wildz_restore_binding_invalid");
  return { payloadBytes, payloadFilename, payloadMimeType,
    payloadSha256: admission.payloadSha256, sealedArtifactSha256: admission.artifactSha256,
    exactSealedArtifactBytes: bytes };
}

export function wildzSealedDownloadFilename(filename: string, mimeType: string) {
  return mimeType.split(";", 1)[0]?.trim() === "image/png" ? filename
    : `${filename.replace(/(?:\.receized)?\.(?:png|receizbundle|receized)$/i, "")}.receizbundle`;
}
