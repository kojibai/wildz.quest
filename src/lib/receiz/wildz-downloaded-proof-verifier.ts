import { createReceizClient } from "@receiz/sdk";
import { openWildzArtifact } from "./wildz-artifact-custody";

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/** Reopen exact response bytes locally before the browser may save them. */
export async function verifyDownloadedWildzProofObjectLocally(
  artifactBytes: Uint8Array,
  artifactMimeType: string,
  artifactFilename: string,
  expectedPayloadBytes: Uint8Array
) {
  const client = createReceizClient();
  const admitted = await openWildzArtifact(
    new Blob([artifactBytes.slice().buffer], { type: artifactMimeType }),
    artifactFilename,
    client.artifacts
  );
  if (admitted.compatibility !== "current-native") {
    throw new Error("wildz_proof_object_current_native_required");
  }
  if (!sameBytes(admitted.artifactBytes, artifactBytes)) {
    throw new Error("wildz_proof_object_artifact_bytes_mismatch");
  }
  if (admitted.mimeType !== artifactMimeType || !sameBytes(admitted.payloadBytes, expectedPayloadBytes)) {
    throw new Error("wildz_proof_object_payload_mismatch");
  }
}
