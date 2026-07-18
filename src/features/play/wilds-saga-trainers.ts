import { createArenaNpc } from "../games/mortal-arena/npc-controller";
import type { ArenaCampaignOpponent } from "../games/mortal-arena/campaign";
import { creatureForms } from "./creature-catalog";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import type { WildsSagaProjection } from "./wilds-saga-director";
import type { WildsTrainerAffinity, WildsTrainerTier } from "./wilds-saga-types";

export type WildsTrainerBattleMemory = Readonly<{
  trainerId: string;
  playerId: string;
  outcome: "player_victory" | "trainer_victory" | "fled";
  settledEventId: string;
  settledAt: string;
}>;

export type WildsTrainerProjection = Readonly<{
  id: string;
  kind: "npc";
  name: string;
  locationId: string;
  position: readonly [number, number, number];
  tier: WildsTrainerTier;
  affinity: WildsTrainerAffinity;
  seed: number;
  rosterFormIds: readonly string[];
  rematchIndex: number;
  challengeLevel: number;
  recurring: boolean;
  available: boolean;
}>;

const STAGE_BY_TIER: Readonly<Record<WildsTrainerTier, 1 | 2 | 3>> = {
  teaching: 1,
  scout: 1,
  veteran: 2,
  champion: 3,
  boss: 3
};

function trainerSeed(saga: WildsSagaProjection, definitionId: string, locationId: string, rematchIndex: number) {
  const digest = sha256PortableBasis(canonicalPortableCardJson({
    frameworkVersion: saga.frameworkVersion,
    dayId: saga.dayId,
    trainerDefinitionId: definitionId,
    locationId,
    rematchIndex
  }));
  return Number.parseInt(digest.slice("sha256:".length, "sha256:".length + 8), 16) >>> 0;
}

function roster(input: { affinity: WildsTrainerAffinity; tier: WildsTrainerTier; size: number; seed: number; rematchIndex: number; playerLevel: number }) {
  const targetStage = Math.min(3, Math.max(STAGE_BY_TIER[input.tier], input.playerLevel >= 25 ? 3 : input.playerLevel >= 10 ? 2 : 1));
  let candidates = creatureForms.filter((form) => form.element === input.affinity && form.stage === targetStage);
  if (candidates.length < input.size) candidates = creatureForms.filter((form) => form.stage === targetStage);
  const start = (input.seed + input.rematchIndex * 17) % candidates.length;
  return Array.from({ length: input.size }, (_, index) => candidates[(start + index * 13) % candidates.length]!.id);
}

export function projectSagaTrainers(input: {
  saga: WildsSagaProjection;
  playerLevel: number;
  battleMemories: readonly WildsTrainerBattleMemory[];
}): WildsTrainerProjection[] {
  const playerLevel = Math.max(1, Math.min(100, Math.floor(Number.isFinite(input.playerLevel) ? input.playerLevel : 1)));
  return input.saga.chapter.trainers.map((definition) => {
    const rematchIndex = input.battleMemories.filter((memory) => memory.trainerId === definition.id && Number.isFinite(Date.parse(memory.settledAt))).length;
    const seed = trainerSeed(input.saga, definition.id, definition.locationId, rematchIndex);
    return {
      id: definition.id,
      kind: "npc",
      name: definition.name,
      locationId: definition.locationId,
      position: definition.position,
      tier: definition.tier,
      affinity: definition.affinity,
      seed,
      rosterFormIds: roster({ affinity: definition.affinity, tier: definition.tier, size: definition.rosterSize, seed, rematchIndex, playerLevel }),
      rematchIndex,
      challengeLevel: Math.min(100, Math.max(1, playerLevel + rematchIndex * 2)),
      recurring: definition.recurring,
      available: true
    };
  });
}

export function trainerArenaNpc(trainer: WildsTrainerProjection) {
  return createArenaNpc({ actorId: trainer.id, tier: trainer.tier, seed: trainer.seed });
}

export function projectCampaignOpponentFromTrainer(trainer: WildsTrainerProjection): ArenaCampaignOpponent {
  return {
    id: trainer.id,
    name: trainer.name,
    kind: trainer.tier === "boss" ? "boss" : "rival",
    tier: trainer.tier,
    affinity: trainer.affinity,
    phases: trainer.tier === "boss" ? ["Opening", "Awakening", "Last Resonance"] : ["Duel"],
    vitalityPermille: Math.min(1_850, 900 + trainer.challengeLevel * 8 + trainer.rematchIndex * 70),
    powerPermille: Math.min(1_600, 880 + trainer.challengeLevel * 6 + trainer.rematchIndex * 55)
  };
}
