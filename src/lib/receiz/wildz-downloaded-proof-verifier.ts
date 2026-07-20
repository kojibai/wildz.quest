import { verifyReceizArtifact } from "@receiz/sdk";

async function sha256(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Verify exact response bytes locally before the browser may save them. */
export async function verifyDownloadedWildzProofObjectLocally(
  artifactBytes: Uint8Array,
  artifactMimeType: string,
  artifactFilename: string,
  expectedPayloadBytes: Uint8Array
) {
  const file = new File([artifactBytes.slice().buffer], artifactFilename, { type: artifactMimeType });
  const verified = await verifyReceizArtifact(file);
  if (verified.status !== "verified-artifact" || verified.verification.ok !== true) {
    throw new Error("wildz_artifact_verification_failed");
  }
  if (verified.artifactDigest.value !== await sha256(artifactBytes)) {
    throw new Error("wildz_proof_object_artifact_bytes_mismatch");
  }
  if (verified.payloadDigest.value !== await sha256(expectedPayloadBytes)) {
    throw new Error("wildz_proof_object_payload_mismatch");
  }
}
