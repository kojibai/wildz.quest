import { createCreatureLife } from "../lifecycle/creature-life-event";
import { sealRetirement } from "../lifecycle/creature-retirement";
import { appendLivingCardRevision, admitLegacyCard, currentRevision } from "../../play/living-card-proof";
import { isLivingCardAsset, type LivingCardAsset, type LivingCardLifeSnapshot } from "../../play/living-card-types";
import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "../../play/portable-card";
import type { MortalArenaResult } from "./types";

export type ArenaSettlement = {
  id: string;
  status: "pending" | "committed";
  receiptDigest: string;
  playerSide: 0 | 1;
  completedAt: string;
  result: MortalArenaResult;
  card: PortableCardAsset;
};

export function createArenaSettlement(input: {
  card: PortableCardAsset;
  result: MortalArenaResult;
  playerSide: 0 | 1;
  completedAt: string;
}): ArenaSettlement {
  if (!Number.isFinite(Date.parse(input.completedAt))) throw new Error("Arena settlement time is invalid");
  const basis = { cardDigest: input.card.proof.digest, result: input.result, playerSide: input.playerSide, completedAt: input.completedAt };
  const receiptDigest = sha256PortableBasis(canonicalPortableCardJson(basis));
  return { ...input, id: `arena-settlement:${receiptDigest.slice(7, 31)}`, receiptDigest, status: "pending" };
}

function appendSurvivalResult(card: LivingCardAsset, settlement: ArenaSettlement): LivingCardAsset {
  const prior = currentRevision(card);
  const previousLife = prior.growth.life ?? createCreatureLife(card.id, Math.max(1, prior.stats.health * 2));
  const normalizedVitality = Math.max(1, Math.min(1_000, settlement.result.finalVitality[settlement.playerSide]));
  const nextVitality = Math.max(1, Math.round(previousLife.maxVitality * normalizedVitality / 1_000));
  const outcome = settlement.result.winnerSide === settlement.playerSide ? "victory" : settlement.result.outcome === "fled" ? "retreat" : "loss";
  const injuryId = nextVitality < previousLife.maxVitality ? `arena:${settlement.receiptDigest.slice(7, 23)}` : null;
  const life: LivingCardLifeSnapshot = {
    ...previousLife,
    vitality: Math.min(previousLife.vitality, nextVitality),
    lastSequence: previousLife.lastSequence + 1,
    eventIds: [...previousLife.eventIds, settlement.id],
    injuries: injuryId ? Array.from(new Set([...previousLife.injuries, injuryId])) : previousLife.injuries,
    victories: previousLife.victories + Number(outcome === "victory"),
    losses: previousLife.losses + Number(outcome === "loss"),
    retreats: previousLife.retreats + Number(outcome === "retreat")
  };
  return appendLivingCardRevision({ asset: card, revision: {
    sealedAt: settlement.completedAt,
    kaiPulse: prior.kaiPulse,
    reason: { kind: "life", label: outcome === "victory" ? "Mortal Arena victory" : outcome === "retreat" ? "Survived a Mortal Arena retreat" : "Survived a Mortal Arena defeat" },
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
    childEventIds: [...prior.childEventIds, settlement.id]
  } });
}

export function recoverArenaSettlement(settlement: Readonly<ArenaSettlement>): ArenaSettlement {
  if (settlement.status === "committed") return settlement as ArenaSettlement;
  const living = isLivingCardAsset(settlement.card) ? settlement.card : admitLegacyCard(settlement.card, settlement.completedAt);
  const playerVitality = settlement.result.finalVitality[settlement.playerSide];
  const retired = settlement.result.mortal && playerVitality <= 0 && settlement.result.retiredCreatureIds.includes(living.id);
  const card = retired
    ? sealRetirement(living, {
        creatureId: living.id,
        previousRevisionDigest: currentRevision(living).digest,
        matchReceiptDigest: settlement.receiptDigest,
        finalVitality: 0,
        teamOutcome: settlement.result.winnerSide === settlement.playerSide ? "victory" : settlement.result.winnerSide === null ? "draw" : "defeat",
        retiredAt: settlement.completedAt
      }, { verified: true, mortalOptIn: true }).card
    : appendSurvivalResult(living, settlement);
  return { ...settlement, status: "committed", card };
}
