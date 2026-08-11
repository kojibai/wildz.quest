import { emptyAdventureCondition, type AdventureCardCondition } from "../../src/features/play/adventure/card-condition";
import { createArenaLivingRevision } from "../../src/features/play/arena/living-revision";
import { advanceArenaFrame, arenaDefinitionCommitment, createArenaMatch, createArenaMortalCovenantPayload, type ArenaAdmissionVerification, type ArenaFrameIntent, type ArenaInputFrame, type ArenaMatchDefinition, type ArenaMatchState } from "../../src/features/play/arena/runtime";
import { projectArenaFighter } from "../../src/features/play/arena/card-fighter";
import { canonicalPortableCardJson, sealCollectedCard, sha256PortableBasis, type PortableCardAsset } from "../../src/features/play/portable-card";
import type { ArenaMode } from "../../src/features/play/arena/mode";
import { ARENA_RULESET_DIGEST, ARENA_RULESET_ID } from "../../src/features/play/arena/rules";

const fixtureSignature = (value: unknown) => `fixture-signature:${sha256PortableBasis(canonicalPortableCardJson(value))}`;
export const arenaFixtureVerification: ArenaAdmissionVerification = {
  verifyGlobalAdmission: (envelope, commitment) => envelope.signature === fixtureSignature({ payload: envelope.payload, commitment }),
  verifyMortalCovenant: (envelope, commitment) => envelope.signature === fixtureSignature({ payload: envelope.payload, commitment }),
  verifyFighterAdmission: () => true,
};

export function arenaFixtureCreateMatch(definition: ArenaMatchDefinition) {
  return createArenaMatch(definition, arenaFixtureVerification);
}

export function arenaFixtureFighterHealth<T extends ArenaMatchDefinition["teams"][number]["fighters"][number]>(fighter: T, health: number): T {
  const stats = { ...fighter.stats, health };
  return {
    ...fighter,
    stats,
    maxVitality: Math.max(1, health * 2),
    maxBreak: Math.max(10, Math.round(stats.guard * 1.15 + health * .35)),
  } as T;
}

export function arenaFixtureAuthorizeDefinition(definition: ArenaMatchDefinition): ArenaMatchDefinition {
  const { mortalCovenant: _mortalCovenant, globalAdmission: _globalAdmission, covenantDigest: _covenantDigest, ...draft } = definition;
  const base = draft as ArenaMatchDefinition;
  if (base.mode === "mortal") {
    const commitment = arenaDefinitionCommitment(base);
    const payload = createArenaMortalCovenantPayload(base, { playerId: base.teams[0].id, signerId: "device:fixture", expiresUPulse: base.kai.uPulse + 1_000, nonce: `fixture:${base.seed}` });
    return { ...base, mortalCovenant: { schema: "receiz.wilds.arena_mortal_covenant.v1", payload, signature: fixtureSignature({ payload, commitment }) } };
  }
  if (base.mode === "ranked") {
    const commitment = arenaDefinitionCommitment(base);
    const payload = { schema: "receiz.wilds.arena_global_admission_payload.v1" as const, definitionCommitment: commitment, rulesetId: ARENA_RULESET_ID, rulesetDigest: ARENA_RULESET_DIGEST, admittedUPulse: base.kai.uPulse, expiresUPulse: base.kai.uPulse + 1_000, issuerId: "global:fixture" };
    return { ...base, globalAdmission: { schema: "receiz.wilds.arena_global_admission.v1", payload, signature: fixtureSignature({ payload, commitment }) } };
  }
  return base;
}

export function arenaFixtureCard(formId: string, suffix = formId) {
  return sealCollectedCard({ formId, ownerReceizId: "arena.player", encounterId: `arena-${suffix}`, capturedAt: "2026-07-16T21:00:00.000Z" });
}

export function arenaFixtureRevision(card: PortableCardAsset, condition: AdventureCardCondition = emptyAdventureCondition(card.id)) {
  return createArenaLivingRevision({
    assetId: card.id, eventId: `arena:event:genesis:${card.manifest.formId}`, rulesetId: "wilds.arena.v1",
    occurredAt: "2026-07-16T21:01:00.000Z", condition,
    kai: { schema: "receiz.wildz.kai_temporal_root.v1", authority: "admitted", uPulse: 17_491_270_421, pulse: 17_491, sequence: 0, coordinate: "kai:arena:revision-fixture" },
    scarIds: [], relationshipIds: [], achievementIds: [], evolutionIds: [], matchReceiptDigests: [],
  });
}

export function arenaFixtureDefinition(mode: ArenaMode = "mortal", leftCount = 2): ArenaMatchDefinition {
  const forms = ["mintcub-1", "voltray-1", "ledgerfox-1"];
  const left = forms.slice(0, leftCount).map((formId, index) => {
    const card = arenaFixtureCard(formId!, `fixture-left-${mode}-${leftCount}-${index}`);
    return projectArenaFighter(card, arenaFixtureRevision(card));
  });
  const rightCard = arenaFixtureCard("titanseal-1", `fixture-right-${mode}-${leftCount}`);
  const base: ArenaMatchDefinition = {
    seed: `arena:fixture:${mode}:${leftCount}`,
    kai: { schema: "receiz.wildz.kai_temporal_root.v1", authority: "admitted", uPulse: 17_491_270_421, pulse: 17_491, sequence: 0, coordinate: "kai:arena:fixture" },
    mode,
    authority: mode === "practice" ? "local" : mode === "ranked" ? "global" : "offline-pending",
    teams: [{ id: "team:left", fighters: left, items: { heal: 1 } }, { id: "team:right", fighters: [projectArenaFighter(rightCard, arenaFixtureRevision(rightCard))] }],
    stage: { id: "arena:fixture-stage", groundY: 0, fallY: -6, spawn: { x: 0, y: 0, z: 0 }, bounds: { minX: -12, maxX: 12, minZ: -8, maxZ: 8 }, obstacles: [] },
    spawns: [{ x: -0.75, y: 0, z: 0 }, { x: 0.75, y: 0, z: 0 }],
    pickups: [], mechanisms: [], hazards: [],
  };
  return arenaFixtureAuthorizeDefinition(base);
}

export function arenaFixtureInput(state: ArenaMatchState, actorId: string, value: Partial<ArenaInputFrame> = {}): ArenaInputFrame {
  return { sequence: state.sequence + 1, frame: state.frame + 1, actorId, movement: { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false }, combat: null, tagAssetId: null, contextTargetId: null, withdraw: false, ...value };
}

export function arenaFixtureFrame(state: ArenaMatchState, values: readonly [Partial<ArenaFrameIntent>?, Partial<ArenaFrameIntent>?] = []) {
  const neutral = { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false } as const;
  return advanceArenaFrame(state, {
    frame: state.frame + 1,
    intents: state.teams.map((team, index) => ({
      actorId: team.activeAssetId,
      movement: neutral,
      combat: null,
      tagAssetId: null,
      contextTargetId: null,
      withdraw: false,
      ...(values[index] ?? {}),
    }))
  });
}

export function arenaFixtureTerminal(mode: ArenaMode = "mortal") {
  const definition = arenaFixtureDefinition(mode);
  let state = arenaFixtureCreateMatch(definition);
  state = arenaFixtureFrame(state, [{ withdraw: true }, {}]);
  return { definition, state };
}
