import { createReceizProofObjectArtifact } from "../../features/play/card-export";

export type WildzGameImageKind = "card" | "vault" | "identity" | "map" | "creation";

/** All game-bearing PNG downloads use the enrolled SDK offline runtime. */
export async function prepareWildzGameImage(input: {
  bytes: Uint8Array; filename: string; kind: WildzGameImageKind; allowEnrollment?: boolean;
}) {
  const source = input.bytes;
  // Blob snapshots the bytes. Preserve the exact view for sliced or shared input.
  const part = source.buffer instanceof ArrayBuffer && source.byteLength === source.buffer.byteLength
    ? source.buffer : new Uint8Array(source).buffer;
  const artifact = await createReceizProofObjectArtifact(
    new Blob([part], { type: "image/png" }), input.filename, input.kind, undefined, { allowEnrollment: input.allowEnrollment }
  );
  return { ...artifact, blob: new Blob([artifact.bytes], { type: artifact.mimeType }) };
}
