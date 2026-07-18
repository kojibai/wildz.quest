import type { ReceizClient } from "@receiz/sdk";
import {
  downloadAndReopenWildzArtifact,
  openWildzArtifactEvidence,
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
  let claimed;
  try {
    claimed = await port.ownership.claimBearerAsset({ artifact: opened.sealedArtifact });
  } catch {
    throw new Error("wildz_bearer_claim_failed");
  }
  const admitted = await downloadAndReopenWildzArtifact(claimed, port.artifacts);
  if (admitted.compatibility !== "current-native"
    || admitted.payloadSha256 !== opened.admitted.payloadSha256) {
    throw new Error("wildz_bearer_claim_binding_mismatch");
  }
  return admitted;
}
