import { emptyAdventureCondition, type AdventureCardCondition } from "../../src/features/play/adventure/card-condition";
import { createArenaLivingRevision } from "../../src/features/play/arena/living-revision";
import { advanceArenaMatch, createArenaMatch, type ArenaInputFrame, type ArenaMatchDefinition, type ArenaMatchState } from "../../src/features/play/arena/runtime";
import { projectArenaFighter } from "../../src/features/play/arena/card-fighter";
import { sealCollectedCard, type PortableCardAsset } from "../../src/features/play/portable-card";

export function arenaFixtureCard(formId: string, suffix = formId) {
  return sealCollectedCard({ formId, ownerReceizId: "arena.player", encounterId: `arena-${suffix}`, capturedAt: "2026-07-16T21:00:00.000Z" });
}

export function arenaFixtureRevision(card: PortableCardAsset, condition: AdventureCardCondition = emptyAdventureCondition(card.id)) {
  return createArenaLivingRevision({
    assetId: card.id, eventId: `arena:event:genesis:${card.manifest.formId}`, rulesetId: "wilds.arena.v1",
    occurredAt: "2026-07-16T21:01:00.000Z", condition,
    scarIds: [], relationshipIds: [], achievementIds: [], evolutionIds: [], matchReceiptDigests: [],
  });
}

export function arenaFixtureDefinition(mode: "practice" | "mortal" = "mortal", leftCount = 2): ArenaMatchDefinition {
  const forms = ["mintcub-1", "voltray-1", "ledgerfox-1"];
  const left = forms.slice(0, leftCount).map((formId, index) => {
    const card = arenaFixtureCard(formId!, `fixture-left-${mode}-${leftCount}-${index}`);
    return projectArenaFighter(card, arenaFixtureRevision(card));
  });
  const rightCard = arenaFixtureCard("titanseal-1", `fixture-right-${mode}-${leftCount}`);
  return {
    seed: `arena:fixture:${mode}:${leftCount}`,
    mode,
    teams: [{ id: "team:left", fighters: left, items: { heal: 1 } }, { id: "team:right", fighters: [projectArenaFighter(rightCard, arenaFixtureRevision(rightCard))] }],
    stage: { id: "arena:fixture-stage", groundY: 0, fallY: -6, spawn: { x: 0, y: 0, z: 0 }, bounds: { minX: -12, maxX: 12, minZ: -8, maxZ: 8 }, obstacles: [] },
    spawns: [{ x: -0.75, y: 0, z: 0 }, { x: 0.75, y: 0, z: 0 }],
    pickups: [], mechanisms: [], hazards: [],
  };
}

export function arenaFixtureInput(state: ArenaMatchState, actorId: string, value: Partial<ArenaInputFrame> = {}): ArenaInputFrame {
  return { sequence: state.sequence + 1, frame: state.frame + 1, actorId, movement: { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false }, combat: null, tagAssetId: null, contextTargetId: null, withdraw: false, ...value };
}

export function arenaFixtureTerminal(mode: "practice" | "mortal" = "mortal") {
  const definition = arenaFixtureDefinition(mode);
  let state = createArenaMatch(definition);
  const actorId = state.teams[0].activeAssetId;
  state = advanceArenaMatch(state, [arenaFixtureInput(state, actorId, { withdraw: true })]);
  return { definition, state };
}
