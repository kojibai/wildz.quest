import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import type { HearttreeCardCondition } from "./card-capability";
import { applyHearttreeConsequences, verifyHearttreeConsequenceSet, type HearttreeConsequenceSet } from "./consequences";
import type { HearttreeExpeditionDefinition } from "./expedition-director";
import type { HearttreeTranscript } from "./transcript";

export type HearttreeReceipt = Readonly<{
  schema: "receiz.wilds.hearttree_receipt.v1";
  definition: HearttreeExpeditionDefinition;
  transcript: HearttreeTranscript;
  priorConditions: Readonly<Record<string, HearttreeCardCondition>>;
  consequences: HearttreeConsequenceSet;
  actorId: string;
  publicationRevision: number;
  createdAt: string;
  digest: string;
}>;

function receiptDigest(value: Omit<HearttreeReceipt, "digest">) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

export function sealHearttreeReceipt(input: Omit<HearttreeReceipt, "schema" | "digest">): HearttreeReceipt {
  if (!input.actorId.trim() || !Number.isSafeInteger(input.publicationRevision) || input.publicationRevision < 1 || !Number.isFinite(Date.parse(input.createdAt))) throw new Error("hearttree_receipt_metadata_invalid");
  if (input.definition.id !== input.consequences.expeditionId || input.transcript.expeditionId !== input.definition.id || input.transcript.digest !== input.consequences.transcriptDigest) throw new Error("hearttree_receipt_evidence_mismatch");
  const unsigned = { schema: "receiz.wilds.hearttree_receipt.v1" as const, ...input };
  return { ...unsigned, digest: receiptDigest(unsigned) };
}

export function verifyHearttreeReceipt(receipt: HearttreeReceipt): Readonly<{ ok: boolean; reason?: string }> {
  try {
    const { digest, ...unsigned } = receipt;
    if (receiptDigest(unsigned) !== digest) return { ok: false, reason: "digest" };
    if (!verifyHearttreeConsequenceSet(receipt.consequences)) return { ok: false, reason: "consequences" };
    if (receipt.definition.id !== receipt.transcript.expeditionId || receipt.transcript.digest !== receipt.consequences.transcriptDigest) return { ok: false, reason: "evidence" };
    for (const [assetId, consequence] of Object.entries(receipt.consequences.cards)) {
      const prior = receipt.priorConditions[assetId];
      if (!prior) return { ok: false, reason: "prior" };
      applyHearttreeConsequences(prior, consequence);
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "transition" };
  }
}
