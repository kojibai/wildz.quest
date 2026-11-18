import type { ReceizClient } from "@receiz/sdk";
import { appendReceizPortableAssetOwnership, serializeReceizPortableAssetDocument, ReceizArtifactError } from "@receiz/sdk";
import {
  downloadAndReopenWildzArtifact,
  openWildzArtifactEvidence,
  readWildzPortableOwnershipDocument,
  readWildzPortableCardMedia,
  type WildzAdmittedArtifact
} from "./wildz-artifact-custody";

export type WildzBearerOwnershipPort = Readonly<{
  artifacts: Pick<ReceizClient["artifacts"], "verifyAndOpen" | "download">;
  ownership: Pick<ReceizClient["ownership"], "claimBearerAsset">;
}>;

/** Claims only the SDK-opened sealed artifact and returns the claimed artifact re-verified from bytes. */
export async function claimWildzBearerArtifact(
  file: Blob,
  filename: string,
  port: WildzBearerOwnershipPort
): Promise<WildzAdmittedArtifact> {
  const opened = await openWildzArtifactEvidence(file, filename, port.artifacts);
  const source = await readWildzPortableOwnershipDocument(opened.admitted.payloadBytes);
  if (source) readWildzPortableCardMedia(source);
  let claimed;
  try {
    claimed = await port.ownership.claimBearerAsset({ artifact: opened.sealedArtifact });
  } catch (cause) {
    if (cause instanceof ReceizArtifactError && cause.code === "artifact_custody_conflict") {
      throw new Error("wildz_bearer_claim_stale_ownership");
    }
    throw new Error("wildz_bearer_claim_failed");
  }
  const admitted = await downloadAndReopenWildzArtifact(claimed, port.artifacts);
  if (admitted.compatibility !== "current-native"
    || !admitted.ownershipWitness
    || admitted.ownershipWitness.previousArtifactSha256 !== opened.admitted.artifactSha256
    || admitted.ownershipWitness.priorHeadReference !== opened.admitted.claimId
    || admitted.ownershipWitness.previousOwnerReceizId !== opened.admitted.ownerReceizId
    || admitted.ownershipWitness.ownerReceizId !== admitted.ownerReceizId
    || admitted.ownershipWitness.headReference !== admitted.claimId) {
    throw new Error("wildz_bearer_claim_binding_mismatch");
  }
  if (source) {
    const expected = serializeReceizPortableAssetDocument(await appendReceizPortableAssetOwnership(source, {
      ownerReceizId: admitted.ownerReceizId, sourceArtifactSha256: opened.admitted.artifactSha256,
      priorHeadReference: opened.admitted.claimId
    }));
    if (expected.length !== admitted.payloadBytes.length || !expected.every((byte, index) => byte === admitted.payloadBytes[index]))
      throw Error("wildz_bearer_claim_binding_mismatch");
  } else if (admitted.payloadSha256 !== opened.admitted.payloadSha256) {
    throw Error("wildz_bearer_claim_binding_mismatch");
  }
  return admitted;
}
