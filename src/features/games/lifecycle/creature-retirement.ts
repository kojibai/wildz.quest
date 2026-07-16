import { appendLivingCardRevision, currentRevision, verifyLivingCard } from "../../play/living-card-proof";
import type { LivingCardAsset, LivingCardLifeSnapshot } from "../../play/living-card-types";
import { canonicalPortableCardJson, sha256PortableBasis } from "../../play/portable-card";
import { createCreatureLife } from "./creature-life-event";

export type WildzRetirementProposal = {
  creatureId: string;
  previousRevisionDigest: string;
  matchReceiptDigest: string;
  finalVitality: number;
  teamOutcome: "victory" | "defeat" | "draw";
  retiredAt: string;
};

export function assertCreaturePlayable(card: LivingCardAsset) {
  if (!verifyLivingCard(card).ok) throw new Error("Living card proof is invalid");
  if (currentRevision(card).growth.life?.retired) throw new Error("Creature is canonically retired and cannot be played");
}

export function sealRetirement(card: LivingCardAsset, proposal: WildzRetirementProposal, witness: { verified: boolean; mortalOptIn: boolean }) {
  assertCreaturePlayable(card);
  const prior = currentRevision(card);
  if (!witness.verified) throw new Error("Verified mortal match receipt is required");
  if (!witness.mortalOptIn) throw new Error("Explicit mortal opt-in is required");
  if (proposal.finalVitality !== 0) throw new Error("Canonical retirement requires zero Vitality");
  if (proposal.creatureId !== card.id || proposal.previousRevisionDigest !== prior.digest) throw new Error("Retirement proposal does not bind the current creature revision");
  if (!/^sha256:[a-f0-9]{64}$/.test(proposal.matchReceiptDigest) || !Number.isFinite(Date.parse(proposal.retiredAt))) throw new Error("Retirement receipt is invalid");
  const honor = proposal.teamOutcome === "victory" ? "victorious-sacrifice" as const : "fallen" as const;
  const basis = { creatureId: card.id, matchReceiptDigest: proposal.matchReceiptDigest, cause: "mortal-arena-zero-vitality", teamOutcome: proposal.teamOutcome, honor, retiredAt: proposal.retiredAt, previousRevisionDigest: prior.digest };
  const retirement = { ...basis, cause: "mortal-arena-zero-vitality" as const, sealDigest: sha256PortableBasis(canonicalPortableCardJson(basis)) };
  const life: LivingCardLifeSnapshot = {
    ...(prior.growth.life ?? createCreatureLife(card.id, Math.max(1, prior.stats.health * 2))),
    vitality: 0,
    retired: true,
    retirement,
    lastSequence: (prior.growth.life?.lastSequence ?? 0) + 1,
    eventIds: [...(prior.growth.life?.eventIds ?? []), `retirement:${retirement.sealDigest}`]
  };
  const next = appendLivingCardRevision({ asset: card, revision: {
    sealedAt: proposal.retiredAt,
    kaiPulse: prior.kaiPulse,
    reason: { kind: "life", label: honor === "victorious-sacrifice" ? "Honored after a victorious sacrifice" : "Canonically retired in the Mortal Arena" },
    stage: prior.stage,
    ascensionRank: prior.ascensionRank,
    formId: prior.formId,
    growth: { ...prior.growth, life },
    qualifyingAchievementIds: prior.qualifyingAchievementIds,
    consumedCatalystId: null,
    genomeDelta: {},
    stats: prior.stats,
    abilityNames: prior.abilityNames,
    title: prior.title,
    childEventIds: prior.childEventIds
  } });
  return { card: next, record: { ...retirement, finalRevisionDigest: currentRevision(next).digest } };
}

export function mergeCreatureBranches(left: LivingCardAsset, right: LivingCardAsset) {
  const leftRetired = Boolean(currentRevision(left).growth.life?.retired);
  const rightRetired = Boolean(currentRevision(right).growth.life?.retired);
  if (leftRetired || rightRetired) return { status: "retired" as const, card: leftRetired ? left : right };
  const selected = currentRevision(left).revision >= currentRevision(right).revision ? left : right;
  return { status: "living" as const, card: selected };
}
