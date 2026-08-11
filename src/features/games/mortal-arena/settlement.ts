import { createCreatureLife } from "../lifecycle/creature-life-event";
import { sealRetirement } from "../lifecycle/creature-retirement";
import { appendLivingCardRevision, admitLegacyCard, currentRevision } from "../../play/living-card-proof";
import { isLivingCardAsset, type LivingCardAsset, type LivingCardLifeSnapshot } from "../../play/living-card-types";
import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "../../play/portable-card";
import { verifyArenaReceipt, type ArenaReceipt } from "../../play/arena/receipt";
import type { ArenaFighterDefinition } from "../../play/arena/card-fighter";
import type { ArenaAdmissionVerification } from "../../play/arena/runtime";
import { replayArenaTranscript } from "../../play/arena/transcript";
import type { KaiTemporalRoot } from "../../play/kai-temporal-root";
import type { MortalArenaResult } from "./types";
import { projectCanonicalOwnedArenaFighter } from "./canonical-adapter";

export type ArenaSettlement = {
  schema: "receiz.wildz.mortal_arena_settlement.v2";
  id: string;
  status: "pending" | "committed";
  receiptDigest: string;
  playerSide: 0 | 1;
  completedAt: string;
  result: MortalArenaResult;
  card: PortableCardAsset;
  sourceCards?: readonly PortableCardAsset[];
  cards: readonly PortableCardAsset[];
  cardPins: readonly Readonly<{ assetId: string; proofDigest: string }>[];
  canonicalReceipt: ArenaReceipt | null;
  kai: KaiTemporalRoot | null;
};

export const ARENA_SETTLEMENT_JOURNAL_PREFIX = "wildz:mortal-arena:settlement:";

function validateCanonicalReceipt(input: {
  cards: readonly PortableCardAsset[];
  cardPins: readonly Readonly<{ assetId: string; proofDigest: string }>[];
  result: MortalArenaResult;
  completedAt: string;
  receipt: ArenaReceipt;
  verification: ArenaAdmissionVerification;
}) {
  const verified = verifyArenaReceipt(input.receipt, input.verification);
  if (!verified.ok) throw new Error(`arena_settlement_receipt_invalid:${verified.errors.join(",")}`);
  if (input.receipt.createdAt !== input.completedAt) throw new Error("arena_settlement_receipt_time_invalid");
  const replay = replayArenaTranscript(input.receipt.definition, input.receipt.transcript, input.verification);
  const state = replay.state;
  const result = input.result;
  const canonical = result.canonical;
  if (!state.terminal || !canonical
    || result.matchId !== state.id
    || canonical.definitionDigest !== state.definitionDigest
    || canonical.rulesetId !== state.rulesetId
    || canonical.mode !== state.mode
    || canonical.authority !== state.authority
    || canonical.terminalReason !== state.terminal.reason
    || canonicalPortableCardJson(canonical.kai) !== canonicalPortableCardJson(state.kai)) {
    throw new Error("arena_settlement_result_invalid");
  }
  const winnerSide = state.terminal.winnerTeamId === state.teams[0].id ? 0 : state.terminal.winnerTeamId === state.teams[1].id ? 1 : null;
  const outcome = state.terminal.reason === "withdrawal" && state.terminal.loserTeamId === state.teams[0].id ? "fled" : winnerSide === 0 ? "victory" : winnerSide === 1 ? "defeat" : "draw";
  const finalVitality = state.teams.map((team) => team.fighters[team.activeAssetId]!.combat.vitality);
  const retiredCreatureIds = state.teams.flatMap((team) => team.order.filter((id) => team.fighters[id]!.status === "retired"));
  const affected = input.cards.map((card) => {
    const fighter = state.teams[0].fighters[card.id];
    const pinned = input.receipt.definition.teams[0].fighters.find((candidate) => candidate.assetId === card.id);
    const cardPin = input.cardPins.find((candidate) => candidate.assetId === card.id);
    if (!fighter || !pinned || !cardPin || pinned.proofDigest !== cardPin.proofDigest) throw new Error("arena_settlement_card_pin_invalid");
    return { cardId: card.id, finalVitality: fighter.combat.vitality, maxVitality: fighter.definition.maxVitality, status: fighter.status };
  });
  if (winnerSide !== result.winnerSide || outcome !== result.outcome || result.mortal !== (state.mode === "mortal")
    || canonicalPortableCardJson(finalVitality) !== canonicalPortableCardJson(result.finalVitality)
    || canonicalPortableCardJson(retiredCreatureIds) !== canonicalPortableCardJson(result.retiredCreatureIds)
    || canonicalPortableCardJson(affected) !== canonicalPortableCardJson(result.affectedOwnedCards)) {
    throw new Error("arena_settlement_result_invalid");
  }
  return replay;
}

export function createArenaSettlement(input: {
  card?: PortableCardAsset;
  cards?: readonly PortableCardAsset[];
  result: MortalArenaResult;
  playerSide: 0 | 1;
  completedAt: string;
  canonicalReceipt?: ArenaReceipt;
  verification?: ArenaAdmissionVerification;
}): ArenaSettlement {
  if (!Number.isFinite(Date.parse(input.completedAt))) throw new Error("Arena settlement time is invalid");
  const cards = input.cards ?? (input.card ? [input.card] : []);
  if (!cards.length || new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error("Arena settlement cards are invalid");
  const cardPins = cards.map((card) => ({ assetId: card.id, proofDigest: card.proof.digest }));
  if ((input.result.mortal || input.result.canonical) && !input.canonicalReceipt) throw new Error("arena_settlement_canonical_receipt_required");
  if (input.canonicalReceipt) validateCanonicalReceipt({ cards, cardPins, result: input.result, completedAt: input.completedAt, receipt: input.canonicalReceipt, verification: input.verification ?? {} });
  const basis = { cardPins, result: input.result, playerSide: input.playerSide, completedAt: input.completedAt, canonicalReceiptDigest: input.canonicalReceipt?.digest ?? null };
  const receiptDigest = sha256PortableBasis(canonicalPortableCardJson(basis));
  return { schema: "receiz.wildz.mortal_arena_settlement.v2", card: input.card ?? cards[0]!, sourceCards: cards, cards, cardPins, result: input.result, playerSide: input.playerSide, completedAt: input.completedAt, canonicalReceipt: input.canonicalReceipt ?? null, kai: input.canonicalReceipt?.kai ?? null, id: `arena-settlement:${receiptDigest.slice(7, 31)}`, receiptDigest, status: "pending" };
}

function appendSurvivalResult(card: LivingCardAsset, settlement: ArenaSettlement): LivingCardAsset {
  const prior = currentRevision(card);
  const previousLife = prior.growth.life ?? createCreatureLife(card.id, Math.max(1, prior.stats.health * 2));
  const affected = settlement.result.affectedOwnedCards?.find((item) => item.cardId === card.id);
  const normalizedVitality = affected
    ? Math.max(1, Math.min(1_000, Math.round(affected.finalVitality / Math.max(1, affected.maxVitality) * 1_000)))
    : Math.max(1, Math.min(1_000, settlement.result.finalVitality[settlement.playerSide]));
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
  return appendLivingCardRevision({ asset: card, historyKaiUPulse: settlement.kai?.uPulse, revision: {
    sealedAt: settlement.completedAt,
    kaiPulse: settlement.kai ? String(settlement.kai.uPulse) : prior.kaiPulse,
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

export function recoverArenaSettlement(settlement: Readonly<ArenaSettlement>, verification: ArenaAdmissionVerification = {}): ArenaSettlement {
  const sources = settlement.cards?.length ? settlement.cards : [settlement.card];
  const sourceCards = settlement.sourceCards?.length ? settlement.sourceCards : sources;
  const cardPins = settlement.cardPins ?? sources.map((card) => ({ assetId: card.id, proofDigest: card.proof.digest }));
  if (canonicalPortableCardJson(cardPins.map((pin) => pin.assetId)) !== canonicalPortableCardJson(sources.map((card) => card.id))) throw new Error("arena_settlement_card_pin_invalid");
  if (canonicalPortableCardJson(sourceCards.map((card) => ({ assetId: card.id, proofDigest: card.proof.digest }))) !== canonicalPortableCardJson(cardPins)) throw new Error("arena_settlement_source_card_invalid");
  if ((settlement.result.mortal || settlement.result.canonical) && !settlement.canonicalReceipt) throw new Error("arena_settlement_canonical_receipt_required");
  if (settlement.canonicalReceipt) {
    if (!settlement.kai || canonicalPortableCardJson(settlement.kai) !== canonicalPortableCardJson(settlement.canonicalReceipt.kai)) throw new Error("arena_settlement_kai_invalid");
    validateCanonicalReceipt({ cards: sources, cardPins, result: settlement.result, completedAt: settlement.completedAt, receipt: settlement.canonicalReceipt, verification });
  }
  const expectedDigest = sha256PortableBasis(canonicalPortableCardJson({ cardPins, result: settlement.result, playerSide: settlement.playerSide, completedAt: settlement.completedAt, canonicalReceiptDigest: settlement.canonicalReceipt?.digest ?? null }));
  if (settlement.receiptDigest !== expectedDigest || settlement.id !== `arena-settlement:${expectedDigest.slice(7, 31)}`) throw new Error("arena_settlement_digest_invalid");
  if (settlement.status === "committed") return settlement as ArenaSettlement;
  const cards = sources.map((source) => {
    if (!settlement.canonicalReceipt || settlement.canonicalReceipt.consequences.mode === "practice") return source;
    const living = isLivingCardAsset(source) ? source : admitLegacyCard(source, settlement.completedAt);
    const affected = settlement.result.affectedOwnedCards?.find((item) => item.cardId === living.id);
    const playerVitality = affected?.finalVitality ?? settlement.result.finalVitality[settlement.playerSide];
    const retired = settlement.result.mortal && playerVitality <= 0 && settlement.result.retiredCreatureIds.includes(living.id);
    const verifiedMortal = settlement.canonicalReceipt?.definition.mode === "mortal";
    return retired && verifiedMortal
      ? sealRetirement(living, {
        creatureId: living.id,
        previousRevisionDigest: currentRevision(living).digest,
        matchReceiptDigest: settlement.canonicalReceipt!.digest,
        finalVitality: 0,
        teamOutcome: settlement.result.winnerSide === settlement.playerSide ? "victory" : settlement.result.winnerSide === null ? "draw" : "defeat",
        retiredAt: settlement.completedAt,
        kaiUPulse: settlement.kai!.uPulse
      }, { verified: verifiedMortal, mortalOptIn: verifiedMortal }).card
      : appendSurvivalResult(living, settlement);
  });
  return { ...settlement, status: "committed", card: cards.find((card) => card.id === settlement.card.id) ?? cards[0]!, sourceCards, cards };
}

export function recoverArenaSettlementJournalEntry(
  serialized: string,
  verification: ArenaAdmissionVerification = {}
): ArenaSettlement | null {
  try {
    const candidate = JSON.parse(serialized) as Partial<ArenaSettlement>;
    if (candidate.schema !== "receiz.wildz.mortal_arena_settlement.v2" || candidate.status !== "committed") return null;
    const settlement = candidate as ArenaSettlement;
    const definition = settlement.canonicalReceipt?.definition;
    let reconstructed: ArenaAdmissionVerification = {};
    if (definition && (definition.mode === "adventure" || definition.mode === "practice")) {
      const sourceCards = settlement.sourceCards ?? [];
      if (sourceCards.length !== settlement.cardPins.length) return null;
      const owned = new Map(sourceCards.map((card) => {
        const fighter = projectCanonicalOwnedArenaFighter(card);
        return [fighter.assetId, canonicalPortableCardJson(fighter)] as const;
      }));
      const opponents = new Map(definition.teams
        .filter((_, index) => index !== settlement.playerSide)
        .flatMap((team) => team.fighters)
        .map((fighter) => [fighter.assetId, canonicalPortableCardJson(fighter)] as const));
      reconstructed = {
        verifyFighterAdmission: (fighter: ArenaFighterDefinition) => {
          const canonical = canonicalPortableCardJson(fighter);
          return (owned.get(fighter.assetId) ?? opponents.get(fighter.assetId)) === canonical;
        }
      };
    }
    return recoverArenaSettlement(settlement, { ...reconstructed, ...verification });
  } catch {
    return null;
  }
}
