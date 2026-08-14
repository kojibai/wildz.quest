import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import type { WildzAdmittedArtifact } from "./wildz-artifact-custody";

export type WildzArtifactHistoryEntry = Readonly<{
  schema: "receiz.wildz.artifact_history.v108" | "receiz.wildz.artifact_history.v109" | "receiz.wildz.artifact_history.v110" | "receiz.wildz.artifact_history.v111" | "receiz.wildz.artifact_history.v113" | "receiz.wildz.artifact_history.v114" | "receiz.wildz.artifact_history.v116" | "receiz.wildz.artifact_history.v118" | "receiz.wildz.artifact_history.v119";
  artifactSha256: string;
  payloadSha256: string;
  artifactBytes: Uint8Array;
  filename: string;
  mimeType: string;
  ownerReceizId: string;
  claimId: string;
  verifyPath: string;
  recordId: string | null;
  compatibility: WildzAdmittedArtifact["compatibility"];
}>;

function sameBytes(left: Uint8Array, right: Uint8Array) {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function sameEntry(left: WildzArtifactHistoryEntry, right: WildzArtifactHistoryEntry) {
  return left.artifactSha256 === right.artifactSha256
    && left.payloadSha256 === right.payloadSha256
    && left.filename === right.filename
    && left.mimeType === right.mimeType
    && left.ownerReceizId === right.ownerReceizId
    && left.claimId === right.claimId
    && left.verifyPath === right.verifyPath
    && left.recordId === right.recordId
    && left.compatibility === right.compatibility
    && sameBytes(left.artifactBytes, right.artifactBytes);
}

function entryFrom(admitted: WildzAdmittedArtifact): WildzArtifactHistoryEntry {
  return {
    schema: "receiz.wildz.artifact_history.v119",
    artifactSha256: admitted.artifactSha256,
    payloadSha256: admitted.payloadSha256,
    artifactBytes: admitted.artifactBytes.slice(),
    filename: admitted.filename,
    mimeType: admitted.mimeType,
    ownerReceizId: admitted.ownerReceizId,
    claimId: admitted.claimId,
    verifyPath: admitted.verifyPath,
    recordId: admitted.recordId,
    compatibility: admitted.compatibility
  };
}

export function createWildzArtifactHistory(database: WildzContinuityDatabase) {
  return {
    async append(admitted: WildzAdmittedArtifact) {
      const next = entryFrom(admitted);
      return database.transaction(["artifacts"], "readwrite", async (tx) => {
        const existing = await tx.get<WildzArtifactHistoryEntry>("artifacts", next.artifactSha256);
        if (existing) {
          if (!sameEntry(existing, next)) throw new Error("wildz_artifact_history_conflict");
          return existing;
        }
        await tx.put("artifacts", next, next.artifactSha256);
        return next;
      });
    },
    read(artifactSha256: string) {
      return database.read<WildzArtifactHistoryEntry>("artifacts", artifactSha256);
    },
    list() {
      return database.transaction(["artifacts"], "readonly", async (tx) => {
        const entries = await tx.getAll<WildzArtifactHistoryEntry>("artifacts");
        return entries.sort((left, right) => left.artifactSha256.localeCompare(right.artifactSha256));
      });
    }
  };
}
