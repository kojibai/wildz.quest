import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { WILDS_ECOLOGY_FAMILIES, type WildsEcologyFamilyId } from "./wilds-v3-contracts";

export type WildsEcologyReceiptKind = "rumor.scouted" | "site.discovered" | "activity.accepted" | "aftermath.acknowledged" | "history.visited";
export type WildsEcologyKnowledgeVisibility = "rumor" | "approximate" | "exact" | "aftermath" | "historical";

export type WildsEcologyReceipt = {
  schema: "receiz.wilds_ecology_receipt.v1";
  receiptId: string;
  actorId: string;
  siteId: string;
  familyId: WildsEcologyFamilyId;
  kind: WildsEcologyReceiptKind;
  sourceEventId: string;
  occurredAt: string;
  canonicalRevision: number;
  mastery: number;
  cardProofDigest: string | null;
  digest: string;
};

export type WildsEcologyKnowledge = {
  siteId: string;
  familyId: WildsEcologyFamilyId;
  visibility: WildsEcologyKnowledgeVisibility;
  sourceEventId: string;
  occurredAt: string;
  canonicalRevision: number;
};

type ReceiptInput = Omit<WildsEcologyReceipt, "schema" | "receiptId" | "digest">;

const KINDS = new Set<WildsEcologyReceiptKind>(["rumor.scouted", "site.discovered", "activity.accepted", "aftermath.acknowledged", "history.visited"]);
const VISIBILITY: Record<WildsEcologyReceiptKind, WildsEcologyKnowledgeVisibility> = {
  "rumor.scouted": "approximate",
  "site.discovered": "exact",
  "activity.accepted": "exact",
  "aftermath.acknowledged": "aftermath",
  "history.visited": "historical"
};
const VISIBILITY_RANK: Record<WildsEcologyKnowledgeVisibility, number> = { rumor: 0, approximate: 1, exact: 2, aftermath: 3, historical: 4 };

function validInput(input: ReceiptInput) {
  if (!/^[a-z0-9][a-z0-9:._-]{2,179}$/i.test(input.actorId)) throw new Error("wilds_ecology_receipt_actor_invalid");
  if (!/^ecology:[a-z0-9-]+:[a-f0-9]{24}$/.test(input.siteId)) throw new Error("wilds_ecology_receipt_site_invalid");
  if (!WILDS_ECOLOGY_FAMILIES.includes(input.familyId)) throw new Error("wilds_ecology_receipt_family_invalid");
  if (!KINDS.has(input.kind)) throw new Error("wilds_ecology_receipt_kind_invalid");
  if (!/^wve:[a-f0-9]{64}$/.test(input.sourceEventId)) throw new Error("wilds_ecology_receipt_source_invalid");
  if (!Number.isFinite(Date.parse(input.occurredAt))) throw new Error("wilds_ecology_receipt_time_invalid");
  if (!Number.isSafeInteger(input.canonicalRevision) || input.canonicalRevision < 1) throw new Error("wilds_ecology_receipt_revision_invalid");
  if (!Number.isSafeInteger(input.mastery) || input.mastery < 0 || input.mastery > 10) throw new Error("wilds_ecology_receipt_mastery_invalid");
  if (input.cardProofDigest !== null && !/^sha256:[a-f0-9]{64}$/.test(input.cardProofDigest)) throw new Error("wilds_ecology_receipt_card_invalid");
}

function basis(input: ReceiptInput) {
  return { schema: "receiz.wilds_ecology_receipt.v1" as const, ...input, occurredAt: new Date(Date.parse(input.occurredAt)).toISOString() };
}

export function createWildsEcologyReceipt(input: ReceiptInput): WildsEcologyReceipt {
  validInput(input);
  const normalized = basis(input);
  const digest = sha256PortableBasis(canonicalPortableCardJson(normalized));
  return { ...normalized, receiptId: `ecology-receipt:${digest.slice("sha256:".length, "sha256:".length + 24)}`, digest };
}

export function verifyWildsEcologyReceipt(value: WildsEcologyReceipt) {
  const errors: string[] = [];
  try {
    const rebuilt = createWildsEcologyReceipt({
      actorId: value.actorId,
      siteId: value.siteId,
      familyId: value.familyId,
      kind: value.kind,
      sourceEventId: value.sourceEventId,
      occurredAt: value.occurredAt,
      canonicalRevision: value.canonicalRevision,
      mastery: value.mastery,
      cardProofDigest: value.cardProofDigest
    });
    if (value.schema !== rebuilt.schema || value.receiptId !== rebuilt.receiptId || value.digest !== rebuilt.digest) errors.push("wilds_ecology_receipt_digest_invalid");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "wilds_ecology_receipt_invalid");
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function projectWildsEcologyHistory(values: readonly WildsEcologyReceipt[]) {
  const bySource = new Map<string, WildsEcologyReceipt>();
  for (const value of values) {
    if (!verifyWildsEcologyReceipt(value).ok) continue;
    const key = `${value.sourceEventId}:${value.kind}`;
    if (!bySource.has(key)) bySource.set(key, value);
  }
  const events = [...bySource.values()]
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.receiptId.localeCompare(right.receiptId))
    .slice(-2_048);
  const knowledge: Record<string, WildsEcologyKnowledge> = {};
  const mastery = Object.fromEntries(WILDS_ECOLOGY_FAMILIES.map((familyId) => [familyId, 0])) as Record<WildsEcologyFamilyId, number>;
  for (const event of events) {
    const candidate: WildsEcologyKnowledge = {
      siteId: event.siteId,
      familyId: event.familyId,
      visibility: VISIBILITY[event.kind],
      sourceEventId: event.sourceEventId,
      occurredAt: event.occurredAt,
      canonicalRevision: event.canonicalRevision
    };
    const current = knowledge[event.siteId];
    if (!current || VISIBILITY_RANK[candidate.visibility] >= VISIBILITY_RANK[current.visibility]) knowledge[event.siteId] = candidate;
    mastery[event.familyId] = Math.min(999, mastery[event.familyId] + event.mastery);
  }
  return { events, knowledge, mastery };
}
