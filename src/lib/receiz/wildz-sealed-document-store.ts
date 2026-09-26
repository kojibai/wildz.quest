import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import { openWildzSealedDocument } from "./wildz-sealed-document";

/** Exact document retention, separate from native source-family custody.
 * Uses the same bounded document verifier as import, including large PNGs. */
export function createWildzSealedDocumentStore(database: WildzContinuityDatabase) {
  return {
    async retain(input: { bytes: Uint8Array; filename: string; mimeType: string }) {
      const opened = await openWildzSealedDocument({ ...input, name: input.filename });
      const key = `wildz:sealed-document:v1:${opened.sealedArtifactSha256}`;
      await database.transaction(["artifacts"], "readwrite", async tx => {
        await tx.put("artifacts", {
          schema: "wildz.sealed-document.v1", bytes: opened.exactSealedArtifactBytes,
          filename: input.filename, mimeType: input.mimeType,
          artifactSha256: opened.sealedArtifactSha256, payloadSha256: opened.payloadSha256
        }, key);
      });
      return { artifactSha256: opened.sealedArtifactSha256 };
    }
  };
}
