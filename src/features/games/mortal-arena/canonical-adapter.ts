import { emptyAdventureCondition, type AdventureCardCondition } from "../../play/adventure/card-condition";
import { projectArenaFighter, type ArenaFighterDefinition } from "../../play/arena/card-fighter";
import type { ArenaCombatIntent } from "../../play/arena/combat";
import type { ArenaMode } from "../../play/arena/mode";
import {
  advanceArenaFrame,
  arenaDefinitionCommitment,
  createArenaMatch,
  type ArenaAdmissionVerification,
  type ArenaFrameIntent,
  type ArenaMatchDefinition,
  type ArenaMatchState,
  type ArenaMortalCovenantEnvelope
} from "../../play/arena/runtime";
import { ARENA_RULESET_ID, type ArenaVec3 } from "../../play/arena/rules";
import { chooseArenaNpcInput, observeArenaForNpc, type ArenaNpcPolicy, type ArenaNpcTier } from "../../play/arena/opponent";
import { createArenaLivingRevision } from "../../play/arena/living-revision";
import { createKaiTemporalRoot, latestKaiTemporalRoot, type KaiTemporalRoot } from "../../play/kai-temporal-root";
import { deriveKaiKlokMoment, deriveKaiKlokMomentFromUPulse } from "../../play/kai-klok-moment";
import { currentCreatureHistoryProjection, currentRevision } from "../../play/living-card-proof";
import { isLivingCardAsset } from "../../play/living-card-types";
import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "../../play/portable-card";
import type { ArenaCampaignOpponent, WildzArenaPath } from "./campaign";
import type { MortalArenaFighter, MortalArenaInput, MortalArenaResult, MortalArenaState } from "./types";

export type CanonicalArenaSession = Readonly<{
  canonical: ArenaMatchState;
  definition: ArenaMatchDefinition;
  verification: ArenaAdmissionVerification;
  rosterIds: readonly string[];
  npc: Readonly<{ policy: ArenaNpcPolicy; queued: ReturnType<typeof chooseArenaNpcInput> | null }>;
}>;

export type CanonicalMortalAdmission = Readonly<{
  envelope: ArenaMortalCovenantEnvelope;
  verify: NonNullable<ArenaAdmissionVerification["verifyMortalCovenant"]>;
  /** Durable signer/device boundary. Must return false if this covenant nonce was already claimed for a match. */
  consumeOnce: (envelope: ArenaMortalCovenantEnvelope, definitionCommitment: string) => boolean;
}>;

export type CanonicalArenaSessionInput = Readonly<{
  roster: readonly PortableCardAsset[];
  path: Readonly<WildzArenaPath>;
  opponent: ArenaCampaignOpponent;
  mode?: ArenaMode;
  kai?: KaiTemporalRoot;
  mortalAdmission?: CanonicalMortalAdmission;
}>;

export type CanonicalArenaPreparation = Readonly<{
  definition: ArenaMatchDefinition;
  verification: ArenaAdmissionVerification;
  rosterIds: readonly string[];
  npcTier: ArenaNpcTier;
}>;

const digest = (value: unknown) => sha256PortableBasis(canonicalPortableCardJson(value));

function conditionFor(card: PortableCardAsset): AdventureCardCondition {
  if (!isLivingCardAsset(card)) return emptyAdventureCondition(card.id);
  if (card.manifest.history) return currentCreatureHistoryProjection(card).condition;
  const revision = currentRevision(card);
  const life = revision.growth.life;
  if (!life) return emptyAdventureCondition(card.id);
  const ratio = life.vitality / Math.max(1, life.maxVitality);
  const retired = Boolean(life.retired);
  const base = emptyAdventureCondition(card.id);
  return {
    ...base,
    life: retired ? "dead" : "alive",
    fatigue: retired ? 100 : Math.max(0, Math.min(100, Math.round((1 - ratio) * 78))),
    injuries: life.injuries.slice(-12).map((injuryId, index) => ({ id: `arena-injury-${digest(injuryId).slice(7, 19)}`, kind: "guard" as const, severity: (ratio <= .2 ? 3 : ratio <= .5 ? 2 : 1) as 1 | 2 | 3, sourceEventId: `life-event-${index + 1}` })),
    recovery: { state: "stable", trauma: retired ? 100 : Math.max(0, Math.min(100, Math.round((1 - ratio) * 92))), lastEventId: life.eventIds.at(-1) ?? null },
    ...(retired ? { retiredAt: revision.sealedAt, retirementCauseEventId: life.eventIds.at(-1) ?? "mortal-arena-retirement" } : {})
  };
}

function exactCardKai(card: PortableCardAsset) {
  if (isLivingCardAsset(card) && card.manifest.history) {
    const event = card.manifest.history.events.at(-1)!;
    return {
      occurredAt: event.occurredAt,
      moment: deriveKaiKlokMomentFromUPulse({ uPulse: event.kai.uPulse, authority: "admitted" })
    };
  }
  const occurredAt = isLivingCardAsset(card) ? currentRevision(card).sealedAt : card.proof.sealedAt;
  return { occurredAt, moment: deriveKaiKlokMoment({ occurredAt, authority: "admitted" }) };
}

export function projectCanonicalOwnedArenaFighter(card: PortableCardAsset): ArenaFighterDefinition {
  const { occurredAt, moment } = exactCardKai(card);
  const revision = createArenaLivingRevision({
    assetId: card.id,
    eventId: `arena:admission:${digest(card.proof.digest).slice(7, 23)}`,
    rulesetId: ARENA_RULESET_ID,
    occurredAt,
    kai: createKaiTemporalRoot(moment, { observedAt: occurredAt }),
    condition: conditionFor(card),
    scarIds: [], relationshipIds: [], achievementIds: [], evolutionIds: [], matchReceiptDigests: []
  });
  return projectArenaFighter(card, revision);
}

function scaled(value: number, permille: number) { return Math.max(1, Math.round(value * permille / 1_000)); }

function opponentFighter(opponent: ArenaCampaignOpponent, basis: ArenaFighterDefinition): ArenaFighterDefinition {
  const stats = {
    ...basis.stats,
    health: scaled(basis.stats.health, opponent.vitalityPermille),
    power: scaled(basis.stats.power, opponent.powerPermille),
    guard: scaled(basis.stats.guard, opponent.kind === "boss" ? 1_180 : 960),
    speed: scaled(basis.stats.speed, opponent.kind === "boss" ? 920 : 980)
  };
  return {
    ...basis,
    assetId: opponent.id,
    proofDigest: digest({ opponent: opponent.id, proof: "campaign" }),
    revisionDigest: digest({ opponent: opponent.id, path: opponent.phases }),
    name: opponent.name,
    element: opponent.affinity,
    condition: { ...basis.condition, assetId: opponent.id },
    baseStats: stats,
    stats,
    maxVitality: Math.max(1, stats.health * 2),
    maxBreak: Math.max(10, Math.round(stats.guard * 1.15 + stats.health * .35)),
    moveSpeed: Number((3.2 + stats.speed / 38).toFixed(3)),
    jumpImpulse: Number((5.1 + stats.speed / 80).toFixed(3))
  };
}

function latestKai(roster: readonly PortableCardAsset[], sequence: number): KaiTemporalRoot {
  const roots = roster.map((card) => {
    const { occurredAt, moment } = exactCardKai(card);
    return createKaiTemporalRoot(moment, { observedAt: occurredAt });
  });
  const latest = roots.slice(1).reduce(latestKaiTemporalRoot, roots[0]!);
  return { ...latest, sequence, coordinate: `${latest.coordinate}/arena:${sequence}` };
}

function npcTier(opponent: ArenaCampaignOpponent): ArenaNpcTier {
  if (opponent.tier === "teaching") return "learner";
  if (opponent.tier === "champion") return "champion";
  if (opponent.tier === "boss") return "boss";
  return "rival";
}

export function prepareCanonicalArenaSession(input: Omit<CanonicalArenaSessionInput, "mortalAdmission">): CanonicalArenaPreparation {
  if (input.roster.length < 1 || input.roster.length > 3) throw new Error("mortal_arena_roster_invalid");
  const mode = input.mode ?? "adventure";
  if (mode === "ranked") throw new Error("mortal_arena_ranked_global_session_required");
  const kai = input.kai ?? latestKai(input.roster, input.path.history.length);
  const owned = input.roster.map(projectCanonicalOwnedArenaFighter);
  const rival = opponentFighter(input.opponent, owned[0]!);
  const expected = new Map([...owned, rival].map((fighter) => [fighter.assetId, canonicalPortableCardJson(fighter)]));
  const verification: ArenaAdmissionVerification = { verifyFighterAdmission: (fighter) => expected.get(fighter.assetId) === canonicalPortableCardJson(fighter) };
  const definition: ArenaMatchDefinition = {
    seed: digest({ player: input.path.playerId, stage: input.path.stage, history: input.path.history.length, revisions: owned.map((fighter) => fighter.revisionDigest), kai: kai.uPulse }),
    kai,
    mode,
    authority: mode === "practice" ? "local" : "offline-pending",
    teams: [
      { id: input.path.playerId, fighters: owned, items: { heal: 1 }, controller: "human" },
      { id: input.opponent.id, fighters: [rival], controller: "ai" }
    ],
    stage: { id: "echo-bowl", groundY: 0, fallY: -4, spawn: { x: -3, y: 0, z: 0 }, bounds: { minX: -10.5, maxX: 10.5, minZ: -10.5, maxZ: 10.5 }, obstacles: [] },
    spawns: [{ x: -3, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }],
    pickups: [],
    mechanisms: [{ id: "gate", kind: "gate", position: { x: -3, y: 0, z: 0 } }],
    hazards: []
  };
  return { definition, verification, rosterIds: input.roster.map((card) => card.id), npcTier: npcTier(input.opponent) };
}

export function createCanonicalArenaSession(input: CanonicalArenaSessionInput): CanonicalArenaSession {
  const prepared = prepareCanonicalArenaSession(input);
  if (prepared.definition.mode === "mortal" && !input.mortalAdmission) throw new Error("mortal_arena_signed_covenant_required");
  const definition: ArenaMatchDefinition = input.mortalAdmission
    ? { ...prepared.definition, mortalCovenant: input.mortalAdmission.envelope }
    : prepared.definition;
  const verification: ArenaAdmissionVerification = input.mortalAdmission
    ? { ...prepared.verification, verifyMortalCovenant: input.mortalAdmission.verify }
    : prepared.verification;
  const canonical = createArenaMatch(definition, verification);
  if (input.mortalAdmission && !input.mortalAdmission.consumeOnce(input.mortalAdmission.envelope, arenaDefinitionCommitment(definition))) {
    throw new Error("mortal_arena_covenant_already_consumed");
  }
  const policy: ArenaNpcPolicy = { actorId: canonical.teams[1].activeAssetId, tier: prepared.npcTier, seed: canonical.seed, decisionIndex: 0 };
  const queued = chooseArenaNpcInput(policy, observeArenaForNpc(canonical, policy.actorId, policy.tier));
  return { canonical, definition, verification, rosterIds: prepared.rosterIds, npc: { policy, queued } };
}

function normalize(value = 0) { const next = Math.abs(value) > 1 ? value / 1_000 : value; return Math.max(-1, Math.min(1, next)); }
function direction(from: ArenaVec3, to: ArenaVec3) { const x = to.x - from.x; const z = to.z - from.z; const length = Math.hypot(x, z) || 1; return { x: x / length, y: 0, z: z / length }; }

function playerCombat(state: ArenaMatchState, input: MortalArenaInput): ArenaCombatIntent | null {
  const actor = state.teams[0].fighters[state.teams[0].activeAssetId]!;
  if (actor.combat.action.kind !== "idle" && state.frame + 1 <= actor.combat.action.recoverUntil) return null;
  const target = state.teams[1].fighters[state.teams[1].activeAssetId]!;
  const facing = direction(actor.movement.position, target.movement.position);
  if (input.abilitySlot !== undefined) return { kind: "ability", slot: input.abilitySlot, targetId: target.definition.assetId };
  if (input.heavy) return { kind: "heavy", direction: facing };
  if (input.light) return { kind: "light", direction: facing };
  if (input.parry) return { kind: "parry", direction: facing };
  if (input.dodge) return { kind: "dodge", direction: facing };
  if (input.guard) return { kind: "guard", direction: facing };
  if (input.focus) return { kind: "focus" };
  return null;
}

function npcIntent(state: ArenaMatchState, queued: ReturnType<typeof chooseArenaNpcInput> | null): ArenaFrameIntent {
  const actor = state.teams[1].fighters[state.teams[1].activeAssetId]!;
  const canAct = actor.combat.action.kind === "idle" || state.frame + 1 > actor.combat.action.recoverUntil;
  const due = queued && queued.frame <= state.frame + 1 ? queued : null;
  return {
    actorId: actor.definition.assetId,
    movement: queued?.movement ?? { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false },
    combat: canAct ? due?.combat ?? null : null,
    tagAssetId: null,
    contextTargetId: null,
    withdraw: false
  };
}

export function advanceCanonicalArenaSession(session: CanonicalArenaSession, input: MortalArenaInput): CanonicalArenaSession {
  const state = session.canonical;
  const team = state.teams[0];
  const contextTargetId = input.contextTargetId === "mechanism:gate" && state.stage.activatedMechanismIds.includes("gate")
    ? null
    : input.contextTargetId ?? null;
  const player: ArenaFrameIntent = {
    actorId: team.activeAssetId,
    movement: { moveX: normalize(input.moveX), moveZ: normalize(input.moveZ), jumpPressed: Boolean(input.jump), sprint: false },
    combat: playerCombat(state, input),
    tagAssetId: input.swapTo === undefined ? null : team.order[input.swapTo] ?? null,
    contextTargetId,
    withdraw: Boolean(input.withdraw ?? input.flee)
  };
  const consumedNpcDecision = Boolean(session.npc.queued && session.npc.queued.frame <= state.frame + 1);
  const canonical = advanceArenaFrame(state, { frame: state.frame + 1, intents: [player, npcIntent(state, session.npc.queued)] });
  if (!consumedNpcDecision || canonical.terminal) return { ...session, canonical };
  const policy = { ...session.npc.policy, actorId: canonical.teams[1].activeAssetId, decisionIndex: session.npc.policy.decisionIndex + 1 };
  const queued = chooseArenaNpcInput(policy, observeArenaForNpc(canonical, policy.actorId, policy.tier));
  return { ...session, canonical, npc: { policy, queued } };
}

function fighterProjection(state: ArenaMatchState, fighter: ArenaMatchState["teams"][number]["fighters"][string]): MortalArenaFighter {
  const action = fighter.combat.action;
  return {
    creatureId: fighter.definition.assetId,
    affinity: fighter.definition.element as MortalArenaFighter["affinity"],
    vitality: fighter.combat.vitality,
    power: fighter.definition.stats.power,
    guard: fighter.definition.stats.guard,
    speed: fighter.definition.stats.speed,
    maxVitality: fighter.definition.maxVitality,
    break: fighter.combat.break,
    maxBreak: fighter.definition.maxBreak,
    focus: fighter.combat.focus,
    stamina: fighter.combat.stamina,
    position: { x: fighter.movement.position.x * 1_000, y: fighter.movement.position.y * 1_000, z: fighter.movement.position.z * 1_000 },
    velocity: { x: fighter.movement.velocity.x * 1_000, y: fighter.movement.velocity.y * 1_000, z: fighter.movement.velocity.z * 1_000 },
    facing: fighter.movement.facing.x < 0 || (fighter.movement.facing.x === 0 && fighter.movement.facing.z < 0) ? -1 : 1,
    guarding: action.kind === "guard" && state.frame >= action.activeFrom && state.frame <= action.activeUntil,
    guardStartedTick: action.kind === "guard" ? action.startedFrame : null,
    recoveryTicks: Math.max(0, action.recoverUntil - state.frame),
    action: { kind: action.kind, activeFrom: action.activeFrom, activeUntil: action.activeUntil, recoverUntil: action.recoverUntil, abilityName: action.abilityName }
  };
}

export function projectCanonicalArenaState(session: CanonicalArenaSession): MortalArenaState {
  const state = session.canonical;
  const sides = state.teams.map((team) => ({ actorId: team.id, fighters: team.order.map((id) => fighterProjection(state, team.fighters[id]!)), activeIndex: team.order.indexOf(team.activeAssetId), fleeStartedTick: null, fled: state.terminal?.reason === "withdrawal" && state.terminal.loserTeamId === team.id })) as unknown as MortalArenaState["sides"];
  return { matchId: state.id, mortal: state.mode === "mortal", tick: state.frame, phase: state.phase === "terminal" ? "complete" : "fight", arena: { id: "echo-bowl", radius: 10_500, floorY: 0, fallY: -4_000 }, sides, winnerSide: state.terminal?.winnerTeamId === state.teams[0].id ? 0 : state.terminal?.winnerTeamId === state.teams[1].id ? 1 : null, rng: Number.parseInt(state.seed.slice(7, 15), 16) >>> 0 };
}

export function projectCanonicalArenaResult(session: CanonicalArenaSession): MortalArenaResult | null {
  const state = session.canonical;
  if (!state.terminal) return null;
  const winnerSide = state.terminal.winnerTeamId === state.teams[0].id ? 0 : state.terminal.winnerTeamId === state.teams[1].id ? 1 : null;
  const affectedOwnedCards = session.rosterIds.map((cardId) => { const fighter = state.teams[0].fighters[cardId]!; return { cardId, finalVitality: fighter.combat.vitality, maxVitality: fighter.definition.maxVitality, status: fighter.status }; });
  return {
    matchId: state.id,
    winnerSide,
    outcome: state.terminal.reason === "withdrawal" && state.terminal.loserTeamId === state.teams[0].id ? "fled" : winnerSide === 0 ? "victory" : winnerSide === 1 ? "defeat" : "draw",
    mortal: state.mode === "mortal",
    finalVitality: state.teams.map((team) => team.fighters[team.activeAssetId]!.combat.vitality) as unknown as readonly [number, number],
    retiredCreatureIds: state.teams.flatMap((team) => team.order.filter((id) => team.fighters[id]!.status === "retired")),
    affectedOwnedCards,
    canonical: { rulesetId: state.rulesetId, definitionDigest: state.definitionDigest, kai: state.kai, mode: state.mode, authority: state.authority, terminalReason: state.terminal.reason }
  };
}
