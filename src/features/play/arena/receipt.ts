import type { AdventureCardCondition } from "../adventure/card-condition";
import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { projectArenaConsequences, type ArenaConsequenceSet } from "./consequences";
import type { ArenaAdmissionVerification, ArenaMatchDefinition } from "./runtime";
import { replayArenaTranscript, type ArenaTranscript } from "./transcript";
import type { KaiTemporalRoot } from "../kai-temporal-root";

export type ArenaReceiptAuthority = Readonly<{ kind: "offline-pending"; deviceId: string } | { kind: "global"; deviceId: null }>;
export type ArenaReceiptPublication = Readonly<{ state: "pending" | "published"; revision: number }>;
export type ArenaReceipt = Readonly<{
  schema: "receiz.wilds.arena_receipt.v2";
  definition: ArenaMatchDefinition;
  kai: KaiTemporalRoot;
  definitionDigest: string;
  rulesetDigest: string;
  parentRevisionDigests: Readonly<Record<string, string>>;
  transcript: ArenaTranscript;
  priorConditions: Readonly<Record<string, AdventureCardCondition>>;
  consequences: ArenaConsequenceSet;
  encounterId: string;
  checkpointId: string;
  actorId: string;
  authority: ArenaReceiptAuthority;
  publication: ArenaReceiptPublication;
  /** Descriptive interoperability metadata only; Kai uPulse orders the receipt. */
  createdAt: string;
  digest: string;
}>;
export type ArenaReceiptInput = Readonly<{
  definition: ArenaMatchDefinition;
  transcript: ArenaTranscript;
  priorConditions: Readonly<Record<string, AdventureCardCondition>>;
  encounterId: string;
  checkpointId: string;
  actorId: string;
  authority: ArenaReceiptAuthority;
  publication: ArenaReceiptPublication;
  createdAt: string;
}>;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function validateAuthority(authority: ArenaReceiptAuthority, publication: ArenaReceiptPublication) {
  if (!Number.isSafeInteger(publication.revision) || publication.revision < 0) throw new Error("arena_receipt_publication_invalid");
  if (authority.kind === "offline-pending") {
    if (!authority.deviceId.trim() || publication.state !== "pending" || publication.revision !== 0) throw new Error("arena_receipt_publication_invalid");
  } else if (authority.deviceId !== null || publication.state !== "published" || publication.revision < 1) {
    throw new Error("arena_receipt_publication_invalid");
  }
}

function unsignedReceipt(receipt: ArenaReceipt) {
  const { digest: _digest, ...unsigned } = receipt;
  return unsigned;
}

export function sealArenaReceipt(input: ArenaReceiptInput, verification: ArenaAdmissionVerification = {}): ArenaReceipt {
  if (!input.actorId.trim() || !input.encounterId.trim() || !input.checkpointId.trim()) throw new Error("arena_receipt_identity_invalid");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("arena_receipt_time_invalid");
  if (input.definition.mode === "ranked" && input.authority.kind !== "global") throw new Error("arena_receipt_ranked_authority_required");
  validateAuthority(input.authority, input.publication);
  const replay = replayArenaTranscript(input.definition, input.transcript, verification);
  const consequences = projectArenaConsequences({
    definition: input.definition,
    replay,
    transcript: input.transcript,
    priorConditions: input.priorConditions,
    encounterId: input.encounterId,
    checkpointId: input.checkpointId,
  });
  const parentRevisionDigests = Object.fromEntries(input.definition.teams.flatMap((team) => team.fighters.map((fighter) => [fighter.assetId, fighter.revisionDigest])));
  const unsigned = {
    schema: "receiz.wilds.arena_receipt.v2" as const,
    definition: input.definition,
    kai: input.definition.kai,
    definitionDigest: input.transcript.definitionDigest,
    rulesetDigest: input.transcript.rulesetDigest,
    parentRevisionDigests,
    transcript: input.transcript,
    priorConditions: input.priorConditions,
    consequences,
    encounterId: input.encounterId,
    checkpointId: input.checkpointId,
    actorId: input.actorId,
    authority: input.authority,
    publication: input.publication,
    createdAt: input.createdAt,
  };
  return { ...unsigned, digest: digest(unsigned) };
}

export function verifyArenaReceipt(receipt: ArenaReceipt, verification: ArenaAdmissionVerification = {}) {
  const errors: string[] = [];
  try {
    if (receipt.schema !== "receiz.wilds.arena_receipt.v2") throw new Error("arena_receipt_schema_invalid");
    if (digest(unsignedReceipt(receipt)) !== receipt.digest) throw new Error("arena_receipt_digest_invalid");
    if (canonicalPortableCardJson(receipt.kai) !== canonicalPortableCardJson(receipt.definition.kai)) throw new Error("arena_receipt_kai_invalid");
    validateAuthority(receipt.authority, receipt.publication);
    const expected = sealArenaReceipt({
      definition: receipt.definition,
      transcript: receipt.transcript,
      priorConditions: receipt.priorConditions,
      encounterId: receipt.encounterId,
      checkpointId: receipt.checkpointId,
      actorId: receipt.actorId,
      authority: receipt.authority,
      publication: receipt.publication,
      createdAt: receipt.createdAt,
    }, verification);
    if (receipt.definitionDigest !== expected.definitionDigest || receipt.rulesetDigest !== expected.rulesetDigest
      || canonicalPortableCardJson(receipt.parentRevisionDigests) !== canonicalPortableCardJson(expected.parentRevisionDigests)
      || canonicalPortableCardJson(receipt.consequences) !== canonicalPortableCardJson(expected.consequences)) {
      throw new Error("arena_receipt_projection_invalid");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "arena_receipt_invalid");
  }
  return { ok: errors.length === 0, errors };
}
