import {
  createReceizSubjectSourceFamilyV125,
  openReceizSubjectSourceFamilyV125,
  receizBase64UrlEncode,
  receizBase64UrlDecode,
  verifyReceizArtifact,
  type ReceizSubjectSourceFamilyBindingV125,
  type ReceizPortableSealedArtifactV124
} from "@receiz/sdk";
import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import type { WildzArtifactHistoryEntry } from "./wildz-artifact-history";

type SourceRecord = Readonly<{
  schema: "wildz.exact-proof-source.v126";
  artifact: ReceizPortableSealedArtifactV124;
}>;
const key = (sha: string) => `exact-proof-source:${sha}`;
type AssetSourceEntry = Readonly<{ artifactSha256: string; previous: string | null }>;
const assetHeadKey = (assetId: string) => JSON.stringify(["exact-proof-source-asset-head", assetId]);
const assetEntryKey = (assetId: string, sha: string) => JSON.stringify(["exact-proof-source-asset-entry", assetId, sha]);
export type WildzProofSourceOpenBudget = Readonly<{ maxArtifacts?: number; maxDecodedBytes?: number }>;
const MAX_FAMILY_ARTIFACTS = 256;
const MAX_FAMILY_BYTES = 64 * 1024 * 1024;
function familyBudget(options: WildzProofSourceOpenBudget) {
  const maxArtifacts = options.maxArtifacts ?? MAX_FAMILY_ARTIFACTS;
  const maxDecodedBytes = options.maxDecodedBytes ?? MAX_FAMILY_BYTES;
  if (!Number.isSafeInteger(maxArtifacts) || maxArtifacts < 1 || maxArtifacts > MAX_FAMILY_ARTIFACTS
    || !Number.isSafeInteger(maxDecodedBytes) || maxDecodedBytes < 1 || maxDecodedBytes > MAX_FAMILY_BYTES)
    throw new Error("wildz_exact_source_budget_invalid");
  const reserved = new Set<string>(), charged = new Set<string>();
  let bytes = 0;
  return {
    reserve(sha: string) {
      if (!reserved.has(sha) && reserved.size >= maxArtifacts) throw new Error("wildz_exact_source_artifact_budget_exhausted");
      reserved.add(sha);
    },
    charge(sha: string, byteLength: number) {
      if (charged.has(sha)) return;
      if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > maxDecodedBytes - bytes)
        throw new Error("wildz_exact_source_byte_budget_exhausted");
      bytes += byteLength; charged.add(sha);
    }
  };
}
const isDigest = (value: string) => /^[a-f0-9]{64}$/.test(value);

/** Durable exact-byte custody only. A record or transport digest never grants authority.
 * Uses namespaced keys in the existing artifacts store; no head is replaced or deleted. */
export function createWildzProofSourceRepository(database: WildzContinuityDatabase) {
  async function verify(input: Readonly<{ bytes: Uint8Array; filename: string; mimeType: string }>) {
    const bytes = new Uint8Array(input.bytes);
    const filename = input.filename;
    const mimeType = input.mimeType;
    const checked = await verifyReceizArtifact(new File([bytes.buffer], filename, { type: mimeType }));
    if (checked.status !== "verified-artifact") throw new Error("wildz_exact_source_verification_failed");
    const artifact: ReceizPortableSealedArtifactV124 = Object.freeze({ schema: "receiz.sealed-artifact-bytes.v124",
      exactBytesB64u: receizBase64UrlEncode(bytes), filename, mimeType,
      artifactSha256: checked.artifactDigest.value, payloadSha256: checked.payloadDigest.value });
    const raw = checked.verification.bundle.pbiAuthorshipHistory;
    if (raw !== undefined && !Array.isArray(raw)) throw new Error("wildz_exact_source_history_invalid");
    const predecessors = (raw ?? []).map(append => append.predecessorArtifactSha256);
    if (!predecessors.every(isDigest)) throw new Error("wildz_exact_source_history_invalid");
    return { artifact, predecessors };
  }
  async function read(artifactSha256: string, budget?: ReturnType<typeof familyBudget>) {
    if (!isDigest(artifactSha256)) throw new Error("wildz_exact_source_digest_invalid");
    budget?.reserve(artifactSha256);
    const retained = await database.read<SourceRecord>("artifacts", key(artifactSha256));
    let input: { bytes: Uint8Array; filename: string; mimeType: string };
    if (retained) {
      if (retained.schema !== "wildz.exact-proof-source.v126" || retained.artifact.artifactSha256 !== artifactSha256)
        throw new Error("wildz_exact_source_record_invalid");
      const encoded = retained.artifact.exactBytesB64u;
      if (typeof encoded !== "string") throw new Error("wildz_exact_source_record_invalid");
      // Unpadded base64url length gives the decoded byte count without allocating bytes.
      // Charge before decoding, inspecting content or invoking the canonical verifier.
      budget?.charge(artifactSha256, Math.floor(encoded.length * 3 / 4));
      input = { bytes: receizBase64UrlDecode(encoded),
        filename: retained.artifact.filename, mimeType: retained.artifact.mimeType };
    } else {
      // Existing restored proof objects are already retained under their primary digest.
      const legacy = await database.read<WildzArtifactHistoryEntry>("artifacts", artifactSha256);
      if (!legacy) return null;
      budget?.charge(artifactSha256, legacy.artifactBytes.byteLength);
      input = { bytes: legacy.artifactBytes, filename: legacy.filename, mimeType: legacy.mimeType };
    }
    const verified = await verify(input);
    if (verified.artifact.artifactSha256 !== artifactSha256
      || (retained && verified.artifact.payloadSha256 !== retained.artifact.payloadSha256))
      throw new Error("wildz_exact_source_digest_mismatch");
    return verified;
  }
  return Object.freeze({
    async retain(input: Readonly<{ bytes: Uint8Array; filename: string; mimeType: string; assetId?: string }>) {
      const assetId = input.assetId;
      if (assetId !== undefined && (!assetId.trim() || assetId.length > 512)) throw new Error("wildz_exact_source_asset_invalid");
      const verified = await verify(input);
      const record: SourceRecord = { schema: "wildz.exact-proof-source.v126", artifact: verified.artifact };
      await database.transaction(["artifacts", "meta"], "readwrite", async tx => {
        const previous = await tx.get<SourceRecord>("artifacts", key(record.artifact.artifactSha256));
        if (previous) {
          if (previous.schema !== record.schema || previous.artifact.exactBytesB64u !== record.artifact.exactBytesB64u
            || previous.artifact.payloadSha256 !== record.artifact.payloadSha256) throw new Error("wildz_exact_source_conflict");
        } else {
          await tx.put("artifacts", record, key(record.artifact.artifactSha256));
        }
        if (assetId) {
          const sha = record.artifact.artifactSha256;
          const entryKey = assetEntryKey(assetId, sha);
          if (!await tx.get<AssetSourceEntry>("meta", entryKey)) {
            const previous = await tx.get<string>("meta", assetHeadKey(assetId));
            if (previous !== null && !isDigest(previous)) throw new Error("wildz_exact_source_index_invalid");
            await tx.put("meta", { artifactSha256: sha, previous } satisfies AssetSourceEntry, entryKey);
            await tx.put("meta", sha, assetHeadKey(assetId));
          }
        }
      });
      return verified.artifact;
    },
    read: (artifactSha256: string) => read(artifactSha256),
    /** Location hints only: all historical exports remain candidates and must be opened. */
    async locateAsset(assetId: string, before?: string, limit = 24) {
      if (!assetId.trim() || assetId.length > 512 || (before !== undefined && !isDigest(before))
        || !Number.isInteger(limit) || limit < 1 || limit > 96) throw new Error("wildz_exact_source_page_invalid");
      return database.transaction(["meta"], "readonly", async tx => {
        let cursor = before ?? await tx.get<string>("meta", assetHeadKey(assetId));
        const artifactSha256s: string[] = [];
        const seen = new Set<string>();
        while (cursor !== null && artifactSha256s.length < limit) {
          if (!isDigest(cursor) || seen.has(cursor)) throw new Error("wildz_exact_source_index_invalid");
          seen.add(cursor);
          const entry: AssetSourceEntry | null = await tx.get<AssetSourceEntry>("meta", assetEntryKey(assetId, cursor));
          if (!entry || entry.artifactSha256 !== cursor || (entry.previous !== null && !isDigest(entry.previous)))
            throw new Error("wildz_exact_source_index_invalid");
          artifactSha256s.push(cursor);
          cursor = entry.previous;
        }
        return { artifactSha256s, nextCursor: cursor };
      });
    },
    /** Retrieval is content-addressed and recursive; no latest-row selection, rewriting,
     * truncation or fabricated predecessors. The SDK opens the completed family. */
    async openFamily(bindings: readonly ReceizSubjectSourceFamilyBindingV125[], options: WildzProofSourceOpenBudget = {}) {
      const budget = familyBudget(options);
      if (!Array.isArray(bindings) || bindings.length < 1 || bindings.length > MAX_FAMILY_ARTIFACTS)
        throw new Error("wildz_exact_source_binding_budget_exhausted");
      // Bound roots before cloning their structure or reading/verifying any source.
      const selected = bindings.map(binding => {
        const selection = { currentArtifactSha256: binding.currentArtifactSha256,
          identityArtifactSha256: binding.identityArtifactSha256, subjectArtifactSha256: binding.subjectArtifactSha256 };
        for (const sha of [selection.currentArtifactSha256, selection.identityArtifactSha256, selection.subjectArtifactSha256]) {
          if (sha === null) continue;
          if (!isDigest(sha)) throw new Error("wildz_exact_source_digest_invalid");
          budget.reserve(sha);
        }
        return selection;
      });
      const verifiedSources = new Map<string, NonNullable<Awaited<ReturnType<typeof read>>>>();
      const artifacts = new Map<string, ReceizPortableSealedArtifactV124>();
      const visiting = new Set<string>();
      const expanded = new Set<string>();
      let reads = 0;
      async function collect(sha: string, includePredecessors: boolean) {
        if (visiting.has(sha)) throw new Error("wildz_exact_source_cycle");
        if (artifacts.has(sha) && (!includePredecessors || expanded.has(sha))) return;
        visiting.add(sha);
        if (++reads % 8 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
        const source = verifiedSources.get(sha) ?? await read(sha, budget);
        if (!source) throw new Error(`wildz_exact_source_missing:${sha}`);
        verifiedSources.set(sha, source);
        if (includePredecessors) {
          for (const predecessor of source.predecessors) await collect(predecessor, true);
          expanded.add(sha);
        }
        visiting.delete(sha);
        artifacts.set(sha, source.artifact);
      }
      for (const selection of selected) {
        await collect(selection.currentArtifactSha256, true);
        // SDK v125SubjectSourceFamily.open traverses PBI predecessors only from
        // current selections. Identity/subject are distinct exact source roles;
        // their own carried histories are opened by canonical admission/readers.
        // Adding unselected predecessor roles makes the SDK reject UNSELECTED_SOURCE.
        await collect(selection.identityArtifactSha256, false);
        if (selection.subjectArtifactSha256) await collect(selection.subjectArtifactSha256, false);
      }
      const family = await createReceizSubjectSourceFamilyV125({ artifacts: [...artifacts.values()], bindings: selected });
      return openReceizSubjectSourceFamilyV125({ family });
    }
  });
}
