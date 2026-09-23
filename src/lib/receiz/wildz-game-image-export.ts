import { createReceizProofObjectArtifact } from "../../features/play/card-export";

export type WildzGameImageKind = "card" | "vault" | "identity" | "map";

/** All game-bearing PNG downloads use the enrolled local v126 runtime. */
export async function prepareWildzGameImage(input: {
  bytes: Uint8Array; filename: string; kind: WildzGameImageKind;
}) {
  const artifact = await createReceizProofObjectArtifact(
    new Blob([input.bytes.slice().buffer], { type: "image/png" }), input.filename, input.kind
  );
  return { ...artifact, blob: new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType }) };
}
