import { createReceizProofObjectArtifact } from "../../features/play/card-export";

export type WildzGameImageKind = "card" | "vault" | "identity" | "map";

/** All game-bearing PNG downloads use the enrolled official SDK v127 offline runtime. */
export async function prepareWildzGameImage(input: {
  bytes: Uint8Array; filename: string; kind: WildzGameImageKind; allowEnrollment?: boolean;
}) {
  const artifact = await createReceizProofObjectArtifact(
    new Blob([input.bytes.slice().buffer], { type: "image/png" }), input.filename, input.kind, undefined, { allowEnrollment: input.allowEnrollment }
  );
  return { ...artifact, blob: new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType }) };
}
