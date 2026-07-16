import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { WILDS_BOSS_FAMILIES, type WildsBossFamilyId, type WildsRaidCardRole } from "./wilds-v3-contracts";

export type WildsRaidReceipt = {
  schema: "receiz.wilds_raid_receipt.v1";
  actorId: string;
  bossId: string;
  familyId: WildsBossFamilyId;
  roundId: string;
  actionId: string;
  sourceEventId: string;
  kind: "entry" | "action" | "round" | "aftermath";
  role: WildsRaidCardRole;
  placement: "fighter" | "support";
  contributionBand: "light" | "steady" | "strong" | "legendary";
  result: "accepted" | "round_complete" | "victory" | "retreated";
  revision: number;
  occurredAt: string;
  cardProofDigest: string;
  receiptDigest: string;
};

export type WildsBossKnowledge = { bossId: string; familyId: WildsBossFamilyId; lastSeenAt: string; lastRevision: number; encounters: number };
type ReceiptInput = Omit<WildsRaidReceipt, "schema" | "receiptDigest">;

function basis(input: ReceiptInput) {
  return { schema: "receiz.wilds_raid_receipt.v1" as const, ...input };
}

export function createWildsRaidReceipt(input: ReceiptInput): WildsRaidReceipt {
  if (!WILDS_BOSS_FAMILIES.includes(input.familyId)) throw new Error("wilds_raid_receipt_family_invalid");
  if (!/^sha256:[a-f0-9]{64}$/.test(input.cardProofDigest)) throw new Error("wilds_raid_receipt_proof_invalid");
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) throw new Error("wilds_raid_receipt_revision_invalid");
  if (!Number.isFinite(Date.parse(input.occurredAt))) throw new Error("wilds_raid_receipt_time_invalid");
  for (const identity of [input.actorId, input.bossId, input.roundId, input.actionId, input.sourceEventId]) {
    if (identity.length < 3 || identity.length > 180) throw new Error("wilds_raid_receipt_identity_invalid");
  }
  const normalized = { ...input, occurredAt: new Date(Date.parse(input.occurredAt)).toISOString() };
  return { ...basis(normalized), receiptDigest: sha256PortableBasis(canonicalPortableCardJson(basis(normalized))) };
}

function verifyReceipt(receipt: WildsRaidReceipt) {
  try {
    const rebuilt = createWildsRaidReceipt({
      actorId: receipt.actorId, bossId: receipt.bossId, familyId: receipt.familyId, roundId: receipt.roundId,
      actionId: receipt.actionId, sourceEventId: receipt.sourceEventId, kind: receipt.kind, role: receipt.role,
      placement: receipt.placement, contributionBand: receipt.contributionBand, result: receipt.result,
      revision: receipt.revision, occurredAt: receipt.occurredAt, cardProofDigest: receipt.cardProofDigest
    });
    return rebuilt.receiptDigest === receipt.receiptDigest;
  } catch { return false; }
}

export function projectWildsRaidHistory(receipts: readonly WildsRaidReceipt[]) {
  const admitted = new Map<string, WildsRaidReceipt>();
  for (const receipt of receipts.slice(-4_096)) {
    if (!verifyReceipt(receipt)) continue;
    const key = `${receipt.sourceEventId}:${receipt.kind}`;
    if (!admitted.has(key)) admitted.set(key, receipt);
  }
  const events = [...admitted.values()].sort((left, right) => left.revision - right.revision || left.sourceEventId.localeCompare(right.sourceEventId));
  const knowledge: Record<string, WildsBossKnowledge> = {};
  const mastery = Object.fromEntries(WILDS_BOSS_FAMILIES.map((familyId) => [familyId, 0])) as Record<WildsBossFamilyId, number>;
  for (const event of events) {
    const current = knowledge[event.bossId];
    knowledge[event.bossId] = {
      bossId: event.bossId, familyId: event.familyId, lastSeenAt: event.occurredAt,
      lastRevision: event.revision, encounters: (current?.encounters ?? 0) + 1
    };
    mastery[event.familyId] += event.contributionBand === "legendary" ? 8 : event.contributionBand === "strong" ? 5 : event.contributionBand === "steady" ? 3 : 1;
  }
  const achievements = events.length > 0 ? ["raid-first-contact"] : [];
  if (new Set(events.map((event) => event.familyId)).size === WILDS_BOSS_FAMILIES.length) achievements.push("boss-ecology-witness");
  return { events, knowledge, mastery, achievements };
}
