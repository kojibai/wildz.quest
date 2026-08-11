import {
  appendLivingCardRevision,
  compareLivingCardHistoryHeads,
  currentRevision,
  isLivingCardHistoryDescendant,
  livingCardHasIrreversibleMortality,
  verifyLivingCardRetirementAuthority,
  verifyLivingCard
} from "../../play/living-card-proof";
import type { LivingCardAsset, LivingCardLifeSnapshot } from "../../play/living-card-types";
import type { CreatureHistoryAuthorityVerifier, CreatureRetirementAuthorityVerifier } from "../../play/creature-history-types";
import { canonicalPortableCardJson, sha256PortableBasis } from "../../play/portable-card";
import { createCreatureLife } from "./creature-life-event";

export type WildzRetirementProposal = {
  creatureId: string;
  previousRevisionDigest: string;
  matchReceiptDigest: string;
  finalVitality: number;
  teamOutcome: "victory" | "defeat" | "draw";
  retiredAt: string;
  kaiUPulse?: number;
  cause?: "mortal-arena-zero-vitality" | "wild-battle-zero-vitality" | "hearttree-mortal-death";
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
  if (proposal.kaiUPulse !== undefined && (!Number.isSafeInteger(proposal.kaiUPulse) || proposal.kaiUPulse < 0)) throw new Error("Retirement Kai uPulse is invalid");
  const honor = proposal.teamOutcome === "victory" ? "victorious-sacrifice" as const : "fallen" as const;
  const cause = proposal.cause ?? "mortal-arena-zero-vitality";
  const basis = { creatureId: card.id, matchReceiptDigest: proposal.matchReceiptDigest, cause, teamOutcome: proposal.teamOutcome, honor, retiredAt: proposal.retiredAt, previousRevisionDigest: prior.digest, ...(proposal.kaiUPulse === undefined ? {} : { kaiUPulse: proposal.kaiUPulse }) };
  const retirement = { ...basis, sealDigest: sha256PortableBasis(canonicalPortableCardJson(basis)) };
  const life: LivingCardLifeSnapshot = {
    ...(prior.growth.life ?? createCreatureLife(card.id, Math.max(1, prior.stats.health * 2))),
    vitality: 0,
    retired: true,
    retirement,
    lastSequence: (prior.growth.life?.lastSequence ?? 0) + 1,
    eventIds: [...(prior.growth.life?.eventIds ?? []), `retirement:${retirement.sealDigest}`]
  };
  const next = appendLivingCardRevision({ asset: card, historyKaiUPulse: proposal.kaiUPulse, revision: {
    sealedAt: proposal.retiredAt,
    kaiPulse: proposal.kaiUPulse === undefined ? prior.kaiPulse : String(proposal.kaiUPulse),
    reason: {
      kind: "life",
      label: cause === "hearttree-mortal-death"
        ? "Death recorded by a verified Mortal Hearttree receipt"
        : cause === "wild-battle-zero-vitality"
          ? "Canonically retired after a wild battle"
          : honor === "victorious-sacrifice"
            ? "Honored after a victorious sacrifice"
            : "Canonically retired in the Mortal Arena"
    },
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

export function mergeCreatureBranches(
  left: LivingCardAsset,
  right: LivingCardAsset,
  options: Readonly<{
    historyAuthorityVerifier?: CreatureHistoryAuthorityVerifier;
    retirementAuthorityVerifier?: CreatureRetirementAuthorityVerifier;
  }> = {}
) {
  if (left.id !== right.id) throw new Error("creature_branch_asset_conflict");
  if (!verifyLivingCard(left).ok || !verifyLivingCard(right).ok) throw new Error("creature_branch_proof_invalid");
  const leftRetired = livingCardHasIrreversibleMortality(left);
  const rightRetired = livingCardHasIrreversibleMortality(right);
  const result = (card: LivingCardAsset) => {
    if (livingCardHasIrreversibleMortality(card)) {
      if (!verifyLivingCardRetirementAuthority(card, options.retirementAuthorityVerifier)) {
        throw new Error("creature_retirement_authority_untrusted");
      }
      return { status: "retired" as const, card };
    }
    return { status: "living" as const, card };
  };
  if (left.proof.digest === right.proof.digest) return result(left);
  if (isLivingCardHistoryDescendant(left, right) || isLivingCardHistoryDescendant(right, left)) {
    const selected = compareLivingCardHistoryHeads(left, right, options.historyAuthorityVerifier);
    return result(selected === "right" ? right : left);
  }
  if (leftRetired !== rightRetired) return result(leftRetired ? left : right);
  if (left.manifest.history && right.manifest.history) {
    const selected = compareLivingCardHistoryHeads(left, right, options.historyAuthorityVerifier);
    if (selected === "left") return result(left);
    if (selected === "right") return result(right);
    return result(left);
  }
  const leftRevisions = left.manifest.revisions;
  const rightRevisions = right.manifest.revisions;
  const leftPrefix = leftRevisions.length < rightRevisions.length
    && leftRevisions.every((revision, index) => rightRevisions[index]?.digest === revision.digest);
  const rightPrefix = rightRevisions.length < leftRevisions.length
    && rightRevisions.every((revision, index) => leftRevisions[index]?.digest === revision.digest);
  if (leftPrefix) return result(right);
  if (rightPrefix) return result(left);
  throw new Error("creature_branch_unadmitted_conflict");
}
