import type { BattleState } from "./battle-engine";
import { appendLivingCardRevision, admitLegacyCard, currentRevision } from "./living-card-proof";
import { isLivingCardAsset, type LivingCardAsset, type LivingCardLifeSnapshot } from "./living-card-types";
import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "./portable-card";
import { createCreatureLife } from "../games/lifecycle/creature-life-event";
import { sealRetirement } from "../games/lifecycle/creature-retirement";
import { deriveKaiKlokMoment } from "./kai-klok-moment";

function appendLife(card: LivingCardAsset, life: LivingCardLifeSnapshot, sealedAt: string, eventId: string, label: string) {
  const prior = currentRevision(card);
  const kai = deriveKaiKlokMoment({ occurredAt: sealedAt, authority: "local" });
  return appendLivingCardRevision({ asset: card, revision: {
    sealedAt,
    kaiPulse: String(kai.uPulse),
    reason: { kind: "life", label },
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
    childEventIds: [...prior.childEventIds, eventId]
  } });
}

export function settleWildBattleCard(card: PortableCardAsset, battle: BattleState, settledAt: string) {
  if (!Number.isFinite(Date.parse(settledAt))) throw new Error("wild_battle_life_time_invalid");
  const living = isLivingCardAsset(card) ? card : admitLegacyCard(card, settledAt);
  const kai = deriveKaiKlokMoment({ occurredAt: settledAt, authority: "local" });
  const prior = currentRevision(living);
  const previousLife = prior.growth.life ?? createCreatureLife(living.id, Math.max(1, battle.player.maxHp));
  const receiptDigest = sha256PortableBasis(canonicalPortableCardJson({
    encounterSeed: battle.encounterSeed,
    playerId: battle.player.id,
    phase: battle.phase,
    transcript: battle.transcript
  }));
  const eventId = `wild-battle:${receiptDigest}`;
  if (previousLife.eventIds.includes(eventId) || previousLife.retired) return living;
  const vitality = Math.max(0, Math.round(previousLife.maxVitality * battle.player.hp / Math.max(1, battle.player.maxHp)));
  if (vitality === 0) {
    return sealRetirement(living, {
      creatureId: living.id,
      previousRevisionDigest: prior.digest,
      matchReceiptDigest: receiptDigest,
      finalVitality: 0,
      teamOutcome: "defeat",
      retiredAt: settledAt,
      kaiUPulse: kai.uPulse,
      cause: "wild-battle-zero-vitality"
    }, { verified: true, mortalOptIn: true }).card;
  }
  const injuryId = vitality < previousLife.vitality ? `wild:${receiptDigest.slice(7, 23)}` : null;
  const life: LivingCardLifeSnapshot = {
    ...previousLife,
    vitality: Math.min(previousLife.vitality, vitality),
    lastSequence: previousLife.lastSequence + 1,
    eventIds: [...previousLife.eventIds, eventId],
    injuries: injuryId ? Array.from(new Set([...previousLife.injuries, injuryId])) : previousLife.injuries,
    victories: previousLife.victories + Number(battle.phase === "captured" || battle.phase === "fled"),
    losses: previousLife.losses + Number(battle.phase === "defeated")
  };
  return appendLife(living, life, settledAt, eventId, "Wild battle vitality carried forward");
}

export function healWildBattleCard(card: PortableCardAsset, amount: number, healedAt: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isFinite(Date.parse(healedAt))) return card;
  if (!isLivingCardAsset(card)) return card;
  const prior = currentRevision(card);
  const previousLife = prior.growth.life;
  if (!previousLife || previousLife.retired || previousLife.vitality >= previousLife.maxVitality) return card;
  const eventId = `camp-recovery:${card.id}:${healedAt}`;
  const life: LivingCardLifeSnapshot = {
    ...previousLife,
    vitality: Math.min(previousLife.maxVitality, previousLife.vitality + amount),
    lastSequence: previousLife.lastSequence + 1,
    eventIds: [...previousLife.eventIds, eventId],
    repairedScars: Array.from(new Set([...previousLife.repairedScars, ...previousLife.injuries])),
    injuries: []
  };
  return appendLife(card, life, healedAt, eventId, "Recovered vitality at camp");
}
