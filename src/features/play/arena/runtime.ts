import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { assertCanonicalKaiTemporalRoot, type KaiTemporalRoot } from "../kai-temporal-root";
import type { ArenaFighterDefinition } from "./card-fighter";
import { assertArenaFighterPlayable } from "./card-fighter";
import { advanceArenaCombatantState, beginArenaAction, createArenaCombatantState, resolveArenaHit, type ArenaCombatIntent, type ArenaCombatantState } from "./combat";
import { arenaModePolicy, assertArenaAuthority, type ArenaAuthorityKind, type ArenaMode } from "./mode";
import { initialArenaKinematicState, stepArenaMovement, type ArenaKinematicState, type ArenaMovementInput, type ArenaStageDefinition } from "./movement";
import { ARENA_RULESET_DIGEST, ARENA_RULESET_ID, type ArenaVec3 } from "./rules";

export type ArenaPickupDefinition = Readonly<{ id: string; kind: "heal"; amount: number; position: ArenaVec3 }>;
export type ArenaMechanismDefinition = Readonly<{ id: string; kind: "bridge" | "gate"; position: ArenaVec3 }>;
export type ArenaHazardDefinition = Readonly<{ id: string; damage: number; position: ArenaVec3; radius: number }>;
export type ArenaBossPhaseRuntime = Readonly<{ id: string; vitalityThreshold: number; transitionFrame: number; weakness: string; hazard: string; legalActions: readonly string[] }>;
export type ArenaTeamDefinition = Readonly<{ id: string; fighters: readonly ArenaFighterDefinition[]; items?: Readonly<Record<string, number>>; controller?: "human" | "ai" }>;
export type ArenaGlobalAdmissionPayload = Readonly<{
  schema: "receiz.wilds.arena_global_admission_payload.v1";
  definitionCommitment: string;
  rulesetId: typeof ARENA_RULESET_ID;
  rulesetDigest: typeof ARENA_RULESET_DIGEST;
  admittedUPulse: number;
  expiresUPulse: number;
  issuerId: string;
}>;
export type ArenaGlobalAdmissionEnvelope = Readonly<{ schema: "receiz.wilds.arena_global_admission.v1"; payload: ArenaGlobalAdmissionPayload; signature: string }>;
export type ArenaMortalCovenantPayload = Readonly<{
  schema: "receiz.wilds.arena_mortal_covenant_payload.v1";
  definitionCommitment: string;
  rulesetId: typeof ARENA_RULESET_ID;
  rulesetDigest: typeof ARENA_RULESET_DIGEST;
  playerId: string;
  signerId: string;
  fighterPins: readonly Readonly<{ assetId: string; proofDigest: string; revisionDigest: string }>[];
  admittedUPulse: number;
  expiresUPulse: number;
  nonce: string;
  disclosure: "zero-vitality-permanently-retires";
}>;
export type ArenaMortalCovenantEnvelope = Readonly<{ schema: "receiz.wilds.arena_mortal_covenant.v1"; payload: ArenaMortalCovenantPayload; signature: string }>;
export type ArenaAdmissionVerification = Readonly<{
  verifyGlobalAdmission?: (envelope: ArenaGlobalAdmissionEnvelope, definitionCommitment: string) => boolean;
  verifyMortalCovenant?: (envelope: ArenaMortalCovenantEnvelope, definitionCommitment: string) => boolean;
  verifyFighterAdmission?: (fighter: ArenaFighterDefinition) => boolean;
}>;
export type ArenaMatchDefinition = Readonly<{
  seed: string;
  kai: KaiTemporalRoot;
  mode: ArenaMode;
  authority: ArenaAuthorityKind;
  timeScale?: number;
  /** Deprecated digest-only consent is never authoritative. */
  covenantDigest?: string;
  globalAdmission?: ArenaGlobalAdmissionEnvelope;
  mortalCovenant?: ArenaMortalCovenantEnvelope;
  teams: readonly [ArenaTeamDefinition, ArenaTeamDefinition];
  stage: ArenaStageDefinition;
  spawns: readonly [ArenaVec3, ArenaVec3];
  pickups: readonly ArenaPickupDefinition[];
  mechanisms: readonly ArenaMechanismDefinition[];
  hazards: readonly ArenaHazardDefinition[];
  boss?: Readonly<{ teamId: string; phases: readonly ArenaBossPhaseRuntime[] }>;
}>;

export type ArenaFighterRuntimeStatus = "active" | "ready" | "knocked-out" | "retired";
export type ArenaFighterRuntime = Readonly<{
  definition: ArenaFighterDefinition;
  movement: ArenaKinematicState;
  combat: ArenaCombatantState;
  status: ArenaFighterRuntimeStatus;
}>;
export type ArenaTeamState = Readonly<{
  id: string;
  order: readonly string[];
  activeAssetId: string;
  fighters: Readonly<Record<string, ArenaFighterRuntime>>;
  tagVulnerableUntil: number;
  itemCharges: Readonly<Record<string, number>>;
  rescueCharges: number;
}>;
export type ArenaStageState = Readonly<{
  definition: ArenaStageDefinition;
  pickups: readonly ArenaPickupDefinition[];
  mechanisms: readonly ArenaMechanismDefinition[];
  hazards: readonly ArenaHazardDefinition[];
  consumedPickupIds: readonly string[];
  activatedMechanismIds: readonly string[];
  hazardCooldowns: Readonly<Record<string, number>>;
  activeBossHazard: string | null;
  bossLegalActions: readonly string[];
}>;
export type ArenaEventKind = "fighter.moved" | "fighter.action" | "fighter.hit" | "fighter.guarded" | "fighter.parried" | "fighter.dodged" | "fighter.tagged" | "fighter.tag-cancelled" | "fighter.rescued" | "fighter.knocked-out" | "fighter.retired" | "fighter.withdrew" | "item.used" | "pickup.consumed" | "mechanism.activated" | "hazard.hit" | "fighter.fell" | "boss.phase-transition";
export type ArenaEvent = Readonly<{ id: string; sequence: number; frame: number; kind: ArenaEventKind; actorId: string; targetId: string | null; amount: number; detail: string }>;
export type ArenaTerminalState = Readonly<{
  reason: "withdrawal" | "team-defeat" | "double-defeat" | "mutual-withdrawal";
  winnerTeamId: string | null;
  loserTeamId: string | null;
  frame: number;
}>;
export type ArenaInputFrame = Readonly<{
  sequence: number;
  frame: number;
  actorId: string;
  movement: ArenaMovementInput;
  combat: ArenaCombatIntent | null;
  tagAssetId: string | null;
  contextTargetId: string | null;
  withdraw: boolean;
}>;
export type ArenaFrameIntent = Readonly<Omit<ArenaInputFrame, "sequence" | "frame">>;
export type ArenaFrameBatch = Readonly<{ frame: number; intents: readonly ArenaFrameIntent[] }>;
export type ArenaMatchState = Readonly<{
  schema: "receiz.wilds.arena_match.v2";
  id: string;
  rulesetId: typeof ARENA_RULESET_ID;
  rulesetDigest: typeof ARENA_RULESET_DIGEST;
  seed: string;
  kai: KaiTemporalRoot;
  mode: ArenaMode;
  authority: ArenaAuthorityKind;
  definitionDigest: string;
  frame: number;
  sequence: number;
  phase: "intro" | "active" | "paused" | "terminal";
  teams: readonly [ArenaTeamState, ArenaTeamState];
  stage: ArenaStageState;
  events: readonly ArenaEvent[];
  inputs: readonly ArenaInputFrame[];
  resolvedHitIds: readonly string[];
  boss: Readonly<{ teamId: string; phases: readonly ArenaBossPhaseRuntime[]; transitionedPhaseIds: readonly string[] }> | null;
  terminal: ArenaTerminalState | null;
}>;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

const identityPattern = /^[a-z0-9:._-]{1,160}$/i;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

function unsignedDefinition(definition: ArenaMatchDefinition) {
  const { globalAdmission: _globalAdmission, mortalCovenant: _mortalCovenant, covenantDigest: _legacyConsent, ...unsigned } = definition;
  return unsigned;
}

export function arenaDefinitionCommitment(definition: ArenaMatchDefinition) {
  return digest({ rulesetId: ARENA_RULESET_ID, rulesetDigest: ARENA_RULESET_DIGEST, definition: unsignedDefinition(definition) });
}

export function arenaDefinitionDigest(definition: ArenaMatchDefinition) {
  return digest({ rulesetId: ARENA_RULESET_ID, rulesetDigest: ARENA_RULESET_DIGEST, definition });
}

function fighterPins(definition: ArenaMatchDefinition) {
  return definition.teams.flatMap((team) => team.fighters.map((fighter) => ({ assetId: fighter.assetId, proofDigest: fighter.proofDigest, revisionDigest: fighter.revisionDigest })));
}

export function createArenaMortalCovenantPayload(definition: ArenaMatchDefinition, input: { playerId: string; signerId: string; expiresUPulse: number; nonce: string }): ArenaMortalCovenantPayload {
  return {
    schema: "receiz.wilds.arena_mortal_covenant_payload.v1",
    definitionCommitment: arenaDefinitionCommitment(definition),
    rulesetId: ARENA_RULESET_ID,
    rulesetDigest: ARENA_RULESET_DIGEST,
    playerId: input.playerId,
    signerId: input.signerId,
    fighterPins: fighterPins(definition),
    admittedUPulse: definition.kai.uPulse,
    expiresUPulse: input.expiresUPulse,
    nonce: input.nonce,
    disclosure: "zero-vitality-permanently-retires",
  };
}

function bounded(value: number, limit = 10_000) {
  return Number.isFinite(value) && Math.abs(value) <= limit;
}

function validateFighterProjection(fighter: ArenaFighterDefinition, verification: ArenaAdmissionVerification) {
  const stats = Object.values(fighter.stats);
  if (!identityPattern.test(fighter.assetId)
    || !digestPattern.test(fighter.proofDigest)
    || !digestPattern.test(fighter.revisionDigest)
    || fighter.condition.assetId !== fighter.assetId
    || stats.some((value) => !Number.isFinite(value) || value < 0 || value > 10_000)
    || fighter.maxVitality !== Math.max(1, fighter.stats.health * 2)
    || fighter.maxBreak !== Math.max(10, Math.round(fighter.stats.guard * 1.15 + fighter.stats.health * 0.35))
    || fighter.moveSpeed !== Number((3.2 + fighter.stats.speed / 38).toFixed(3))
    || fighter.jumpImpulse !== Number((5.1 + fighter.stats.speed / 80).toFixed(3))
    || !bounded(fighter.mass, 100) || fighter.mass <= 0
    || !bounded(fighter.reach, 100) || fighter.reach <= 0
    || fighter.abilityNames.length !== 2 || fighter.abilityPowers.length !== 2
    || fighter.abilityPowers.some((value) => !Number.isFinite(value) || value < 0 || value > 10_000)
    || (verification.verifyFighterAdmission && !verification.verifyFighterAdmission(fighter))) {
    throw new Error("arena_fighter_projection_invalid");
  }
}

function validateStageDefinition(definition: ArenaMatchDefinition) {
  const stage = definition.stage;
  const positionValid = (position: ArenaVec3) => [position.x, position.y, position.z].every((value) => bounded(value, 1_000));
  if (!identityPattern.test(stage.id)
    || ![stage.groundY, stage.fallY, stage.bounds.minX, stage.bounds.maxX, stage.bounds.minZ, stage.bounds.maxZ].every((value) => bounded(value, 1_000))
    || stage.fallY >= stage.groundY || stage.bounds.minX >= stage.bounds.maxX || stage.bounds.minZ >= stage.bounds.maxZ
    || stage.obstacles.length > 128 || (stage.ramps?.length ?? 0) > 128
    || definition.pickups.length > 64 || definition.mechanisms.length > 64 || definition.hazards.length > 64
    || !positionValid(stage.spawn) || definition.spawns.some((position) => !positionValid(position))
    || stage.obstacles.some((obstacle) => !identityPattern.test(obstacle.id) || !positionValid(obstacle.min) || !positionValid(obstacle.max) || obstacle.min.x >= obstacle.max.x || obstacle.min.y >= obstacle.max.y || obstacle.min.z >= obstacle.max.z)
    || definition.pickups.some((pickup) => !identityPattern.test(pickup.id) || !positionValid(pickup.position) || !Number.isFinite(pickup.amount) || pickup.amount <= 0 || pickup.amount > 10_000)
    || definition.mechanisms.some((mechanism) => !identityPattern.test(mechanism.id) || !positionValid(mechanism.position))
    || definition.hazards.some((hazard) => !identityPattern.test(hazard.id) || !positionValid(hazard.position) || !Number.isFinite(hazard.damage) || hazard.damage <= 0 || hazard.damage > 10_000 || !Number.isFinite(hazard.radius) || hazard.radius <= 0 || hazard.radius > 100)) {
    throw new Error("arena_stage_invalid");
  }
}

function validateAdmission(definition: ArenaMatchDefinition, verification: ArenaAdmissionVerification) {
  const commitment = arenaDefinitionCommitment(definition);
  if (definition.mode === "ranked") {
    if (!definition.globalAdmission || !verification.verifyGlobalAdmission) throw new Error("arena_ranked_global_admission_unavailable");
    const payload = definition.globalAdmission.payload;
    if (definition.globalAdmission.schema !== "receiz.wilds.arena_global_admission.v1"
      || payload.schema !== "receiz.wilds.arena_global_admission_payload.v1"
      || payload.definitionCommitment !== commitment || payload.rulesetId !== ARENA_RULESET_ID || payload.rulesetDigest !== ARENA_RULESET_DIGEST
      || payload.admittedUPulse !== definition.kai.uPulse || payload.expiresUPulse < definition.kai.uPulse
      || !identityPattern.test(payload.issuerId) || !verification.verifyGlobalAdmission(definition.globalAdmission, commitment)) {
      throw new Error("arena_ranked_global_admission_invalid");
    }
  }
  if (definition.mode === "mortal") {
    if (!definition.mortalCovenant) throw new Error("arena_mortal_covenant_required");
    if (!verification.verifyMortalCovenant) throw new Error("arena_mortal_covenant_verifier_required");
    const payload = definition.mortalCovenant.payload;
    const expected = createArenaMortalCovenantPayload(definition, { playerId: definition.teams[0].id, signerId: payload.signerId, expiresUPulse: payload.expiresUPulse, nonce: payload.nonce });
    if (definition.mortalCovenant.schema !== "receiz.wilds.arena_mortal_covenant.v1"
      || canonicalPortableCardJson(payload) !== canonicalPortableCardJson(expected)
      || payload.expiresUPulse < definition.kai.uPulse || payload.expiresUPulse > definition.kai.uPulse + 10_000_000
      || !identityPattern.test(payload.signerId) || !identityPattern.test(payload.nonce)
      || !verification.verifyMortalCovenant(definition.mortalCovenant, commitment)) {
      throw new Error("arena_mortal_covenant_invalid");
    }
  }
}

function distance(left: ArenaVec3, right: ArenaVec3) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

function event(state: ArenaMatchState, input: ArenaInputFrame, kind: ArenaEventKind, actorId: string, targetId: string | null, amount: number, detail: string): ArenaEvent {
  const basis = { sequence: input.sequence, frame: input.frame, kind, actorId, targetId, amount, detail };
  return { id: `arena:event:${digest({ matchId: state.id, ...basis }).slice(7, 31)}`, ...basis };
}

function teamState(definition: ArenaTeamDefinition, spawn: ArenaVec3): ArenaTeamState {
  if (definition.fighters.length < 1 || definition.fighters.length > 3) throw new Error("arena_roster_size_invalid");
  for (const fighter of definition.fighters) {
    try { assertArenaFighterPlayable(fighter); } catch { throw new Error("arena_roster_retired"); }
  }
  const order = definition.fighters.map((fighter) => fighter.assetId);
  if (new Set(order).size !== order.length) throw new Error("arena_roster_duplicate");
  const activeAssetId = order[0]!;
  const fighters = Object.fromEntries(definition.fighters.map((fighter, index) => [fighter.assetId, {
    definition: fighter,
    movement: initialArenaKinematicState(spawn),
    combat: createArenaCombatantState(fighter),
    status: index === 0 ? "active" as const : "ready" as const,
  }]));
  const itemCharges = Object.fromEntries(Object.entries(definition.items ?? {}).map(([key, value]) => {
    if (!/^[a-z0-9:_-]{1,64}$/i.test(key) || !Number.isSafeInteger(value) || value < 0 || value > 99) throw new Error("arena_roster_item_invalid");
    return [key, value];
  }));
  return { id: definition.id, order, activeAssetId, fighters, tagVulnerableUntil: 0, itemCharges, rescueCharges: 1 };
}

export function createArenaMatch(definition: ArenaMatchDefinition, verification: ArenaAdmissionVerification = {}): ArenaMatchState {
  if (!definition.seed.trim() || definition.teams[0].id === definition.teams[1].id) throw new Error("arena_definition_invalid");
  assertCanonicalKaiTemporalRoot(definition.kai);
  if (definition.kai.authority !== "admitted") throw new Error("arena_kai_authority_invalid");
  assertArenaAuthority(definition.mode, definition.authority);
  const policy = arenaModePolicy(definition.mode);
  const timeScale = definition.timeScale ?? 1;
  if (!Number.isFinite(timeScale) || timeScale <= 0 || timeScale > 2 || (policy.timeScale === "fixed" && timeScale !== 1)) throw new Error("arena_time_scale_invalid");
  if (!policy.aiOpponentAllowed && definition.teams.some((team) => team.controller === "ai")) throw new Error("arena_mode_ai_opponent_forbidden");
  validateStageDefinition(definition);
  validateAdmission(definition, verification);
  if (definition.mode !== "practice" && !verification.verifyFighterAdmission) throw new Error("arena_fighter_admission_verifier_required");
  for (const fighter of definition.teams.flatMap((team) => team.fighters)) validateFighterProjection(fighter, verification);
  const allIds = definition.teams.flatMap((team) => team.fighters.map((fighter) => fighter.assetId));
  if (new Set(allIds).size !== allIds.length) throw new Error("arena_roster_duplicate");
  const definitionDigest = arenaDefinitionDigest(definition);
  if (definition.boss && !definition.teams.some((team) => team.id === definition.boss!.teamId)) throw new Error("arena_boss_team_invalid");
  return {
    schema: "receiz.wilds.arena_match.v2",
    id: `arena:match:${definitionDigest.slice(7, 31)}`,
    rulesetId: ARENA_RULESET_ID,
    rulesetDigest: ARENA_RULESET_DIGEST,
    seed: definition.seed,
    kai: definition.kai,
    mode: definition.mode,
    authority: definition.authority,
    definitionDigest,
    frame: 0,
    sequence: 0,
    phase: "active",
    teams: [teamState(definition.teams[0], definition.spawns[0]), teamState(definition.teams[1], definition.spawns[1])],
    stage: {
      definition: definition.stage,
      pickups: definition.pickups,
      mechanisms: definition.mechanisms,
      hazards: definition.hazards,
      consumedPickupIds: [],
      activatedMechanismIds: [],
      hazardCooldowns: {},
      activeBossHazard: null,
      bossLegalActions: [],
    },
    events: [], inputs: [], resolvedHitIds: [], boss: definition.boss ? { teamId: definition.boss.teamId, phases: definition.boss.phases, transitionedPhaseIds: [] } : null, terminal: null,
  };
}

function applyBossTransition(state: ArenaMatchState, input: ArenaInputFrame) {
  if (!state.boss || state.phase === "terminal") return state;
  const team = state.teams.find((candidate) => candidate.id === state.boss!.teamId);
  if (!team) throw new Error("arena_boss_team_invalid");
  const fighter = team.fighters[team.activeAssetId]!;
  const ratio = fighter.combat.vitality / Math.max(1, fighter.definition.maxVitality);
  const phase = state.boss.phases.find((candidate) => !state.boss!.transitionedPhaseIds.includes(candidate.id)
    && input.frame >= candidate.transitionFrame
    && ratio <= candidate.vitalityThreshold);
  if (!phase) return state;
  return {
    ...state,
    boss: { ...state.boss, transitionedPhaseIds: [...state.boss.transitionedPhaseIds, phase.id] },
    stage: { ...state.stage, activeBossHazard: phase.hazard, bossLegalActions: phase.legalActions },
    events: [...state.events, event(state, input, "boss.phase-transition", fighter.definition.assetId, phase.id, Math.round(ratio * 1_000), `Boss phase exposed ${phase.weakness}.`)],
  };
}

function actorLocation(state: ArenaMatchState, actorId: string) {
  const teamIndex = state.teams.findIndex((team) => team.fighters[actorId]);
  if (teamIndex < 0) throw new Error("arena_input_actor_invalid");
  const team = state.teams[teamIndex as 0 | 1]!;
  if (team.activeAssetId !== actorId || team.fighters[actorId]!.status !== "active") throw new Error("arena_input_actor_inactive");
  return { teamIndex: teamIndex as 0 | 1, team, fighter: team.fighters[actorId]! };
}

function replaceFighter(team: ArenaTeamState, fighter: ArenaFighterRuntime): ArenaTeamState {
  return { ...team, fighters: { ...team.fighters, [fighter.definition.assetId]: fighter } };
}

function validateInput(state: ArenaMatchState, input: ArenaInputFrame) {
  if (state.phase === "terminal") throw new Error("arena_match_terminal");
  if (!Number.isSafeInteger(input.sequence) || input.sequence !== state.sequence + 1) throw new Error("arena_input_sequence_invalid");
  if (!Number.isSafeInteger(input.frame) || input.frame <= state.frame || input.frame > state.frame + 600) throw new Error("arena_input_frame_invalid");
}

function terminalFor(state: ArenaMatchState, loserIndex: 0 | 1, frame: number, reason: ArenaTerminalState["reason"]): ArenaMatchState {
  const winnerIndex = loserIndex === 0 ? 1 : 0;
  return { ...state, phase: "terminal", terminal: { reason, winnerTeamId: state.teams[winnerIndex].id, loserTeamId: state.teams[loserIndex].id, frame } };
}

function settleZero(state: ArenaMatchState, input: ArenaInputFrame, teamIndex: 0 | 1, assetId: string) {
  const team = state.teams[teamIndex];
  const current = team.fighters[assetId]!;
  const status: ArenaFighterRuntimeStatus = arenaModePolicy(state.mode).mortality === "retirement" ? "retired" : "knocked-out";
  let nextTeam = replaceFighter(team, { ...current, combat: { ...current.combat, vitality: 0 }, status });
  const nextId = nextTeam.order.find((id) => nextTeam.fighters[id]!.status === "ready");
  const zeroEvent = event(state, input, status === "retired" ? "fighter.retired" : "fighter.knocked-out", assetId, null, 0, status === "retired" ? "Verified zero Vitality sealed retirement." : "Practice knockout recorded without persistent mortality.");
  let next = { ...state, events: [...state.events, zeroEvent] };
  if (nextId) {
    nextTeam = replaceFighter(nextTeam, { ...nextTeam.fighters[nextId]!, status: "active" });
    nextTeam = { ...nextTeam, activeAssetId: nextId, tagVulnerableUntil: input.frame + 18 };
    const teams: [ArenaTeamState, ArenaTeamState] = [...next.teams];
    teams[teamIndex] = nextTeam;
    return { ...next, teams };
  }
  const teams: [ArenaTeamState, ArenaTeamState] = [...next.teams];
  teams[teamIndex] = nextTeam;
  next = { ...next, teams };
  return terminalFor(next, teamIndex, input.frame, "team-defeat");
}

function applyContextAction(state: ArenaMatchState, input: ArenaInputFrame, teamIndex: 0 | 1) {
  if (!input.contextTargetId) return state;
  const team = state.teams[teamIndex];
  const actor = team.fighters[input.actorId]!;
  if (input.contextTargetId.startsWith("item:")) {
    const id = input.contextTargetId.slice(5);
    if (id !== "heal" || (team.itemCharges[id] ?? 0) < 1 || actor.combat.vitality >= actor.definition.maxVitality) throw new Error("arena_item_invalid");
    const amount = Math.min(18, actor.definition.maxVitality - actor.combat.vitality);
    const nextActor = { ...actor, combat: { ...actor.combat, vitality: actor.combat.vitality + amount } };
    const teams: [ArenaTeamState, ArenaTeamState] = [...state.teams];
    teams[teamIndex] = { ...replaceFighter(team, nextActor), itemCharges: { ...team.itemCharges, [id]: team.itemCharges[id]! - 1 } };
    return { ...state, teams, events: [...state.events, event(state, input, "item.used", input.actorId, id, amount, "Locked loadout item spent once.")] };
  }
  if (input.contextTargetId.startsWith("rescue:")) {
    const targetId = input.contextTargetId.slice(7);
    const target = team.fighters[targetId];
    if (!target || target.status !== "ready" || team.rescueCharges < 1 || distance(actor.movement.position, target.movement.position) > 2) throw new Error("arena_rescue_invalid");
    const amount = Math.min(24, Math.max(8, Math.round(actor.definition.stats.bond * 0.2)));
    const rescued = { ...target, combat: { ...target.combat, vitality: Math.min(target.definition.maxVitality, target.combat.vitality + amount), break: Math.min(target.definition.maxBreak, target.combat.break + amount) } };
    const teams: [ArenaTeamState, ArenaTeamState] = [...state.teams];
    teams[teamIndex] = { ...replaceFighter(team, rescued), rescueCharges: team.rescueCharges - 1 };
    return { ...state, teams, events: [...state.events, event(state, input, "fighter.rescued", input.actorId, targetId, amount, "Bond-powered teammate rescue committed.")] };
  }
  if (input.contextTargetId.startsWith("pickup:")) {
    const id = input.contextTargetId.slice(7);
    const pickup = state.stage.pickups.find((value) => value.id === id);
    if (!pickup || state.stage.consumedPickupIds.includes(id) || distance(actor.movement.position, pickup.position) > 1.5) throw new Error("arena_pickup_invalid");
    const healed = Math.min(actor.definition.maxVitality, actor.combat.vitality + pickup.amount);
    const nextActor = { ...actor, combat: { ...actor.combat, vitality: healed } };
    const teams: [ArenaTeamState, ArenaTeamState] = [...state.teams];
    teams[teamIndex] = replaceFighter(team, nextActor);
    return {
      ...state,
      teams,
      stage: { ...state.stage, consumedPickupIds: [...state.stage.consumedPickupIds, id] },
      events: [...state.events, event(state, input, "pickup.consumed", input.actorId, id, healed - actor.combat.vitality, "Recovery pickup consumed once.")],
    };
  }
  if (input.contextTargetId.startsWith("mechanism:")) {
    const id = input.contextTargetId.slice(10);
    const mechanism = state.stage.mechanisms.find((value) => value.id === id);
    if (!mechanism || state.stage.activatedMechanismIds.includes(id) || distance(actor.movement.position, mechanism.position) > 1.5) throw new Error("arena_mechanism_invalid");
    return {
      ...state,
      stage: { ...state.stage, activatedMechanismIds: [...state.stage.activatedMechanismIds, id] },
      events: [...state.events, event(state, input, "mechanism.activated", input.actorId, id, 1, `${mechanism.kind} activated.`)],
    };
  }
  throw new Error("arena_context_target_invalid");
}

function applyHazards(state: ArenaMatchState, input: ArenaInputFrame, teamIndex: 0 | 1) {
  const team = state.teams[teamIndex];
  let actor = team.fighters[input.actorId]!;
  let next = state;
  for (const hazard of state.stage.hazards) {
    const key = `${input.actorId}:${hazard.id}`;
    if (distance(actor.movement.position, hazard.position) > hazard.radius || (state.stage.hazardCooldowns[key] ?? 0) > input.frame) continue;
    actor = { ...actor, combat: { ...actor.combat, vitality: Math.max(0, actor.combat.vitality - hazard.damage) } };
    const teams: [ArenaTeamState, ArenaTeamState] = [...next.teams];
    teams[teamIndex] = replaceFighter(next.teams[teamIndex], actor);
    next = {
      ...next,
      teams,
      stage: { ...next.stage, hazardCooldowns: { ...next.stage.hazardCooldowns, [key]: input.frame + 60 } },
      events: [...next.events, event(next, input, "hazard.hit", input.actorId, hazard.id, hazard.damage, "Sealed arena hazard applied.")],
    };
    if (actor.combat.vitality === 0) return settleZero(next, input, teamIndex, input.actorId);
  }
  return next;
}

function resolveActiveHit(state: ArenaMatchState, input: ArenaInputFrame, attackerTeamIndex: 0 | 1) {
  const targetTeamIndex = attackerTeamIndex === 0 ? 1 : 0;
  const attacker = state.teams[attackerTeamIndex].fighters[input.actorId]!;
  const targetId = state.teams[targetTeamIndex].activeAssetId;
  const target = state.teams[targetTeamIndex].fighters[targetId]!;
  const hitId = `${input.actorId}:${attacker.combat.action.startedFrame}:${targetId}`;
  if (state.resolvedHitIds.includes(hitId)) return state;
  const result = resolveArenaHit({
    frame: input.frame,
    attacker: attacker.definition,
    attackerState: attacker.combat,
    attackerPosition: attacker.movement.position,
    target: target.definition,
    targetState: target.combat,
    targetPosition: target.movement.position,
  });
  if (result.outcome === "inactive" || result.outcome === "miss") return state;
  const nextTarget = {
    ...target,
    combat: result.targetState,
    movement: { ...target.movement, velocity: { x: result.launch.x, y: result.launch.y, z: result.launch.z }, grounded: false },
  };
  const teams: [ArenaTeamState, ArenaTeamState] = [...state.teams];
  teams[targetTeamIndex] = replaceFighter(state.teams[targetTeamIndex], nextTarget);
  const kind = result.outcome === "guarded" ? "fighter.guarded" : result.outcome === "parried" ? "fighter.parried" : result.outcome === "dodged" ? "fighter.dodged" : "fighter.hit";
  let next: ArenaMatchState = {
    ...state,
    teams,
    resolvedHitIds: [...state.resolvedHitIds, hitId],
    events: [...state.events, event(state, input, kind, input.actorId, targetId, result.vitalityDamage, `${result.outcome} resolved from fixed-frame combat.`)],
  };
  if (result.knockedOut) next = settleZero(next, input, targetTeamIndex, targetId);
  return next;
}

function advanceOne(state: ArenaMatchState, input: ArenaInputFrame) {
  validateInput(state, input);
  const located = actorLocation(state, input.actorId);
  if (input.withdraw) {
    const withdrew = { ...state, frame: input.frame, sequence: input.sequence, inputs: [...state.inputs, input], events: [...state.events, event(state, input, "fighter.withdrew", input.actorId, null, 0, "Team withdrew before zero Vitality.")] };
    return terminalFor(withdrew, located.teamIndex, input.frame, "withdrawal");
  }
  const moved = stepArenaMovement(located.fighter.definition, state.stage.definition, located.fighter.movement, input.movement);
  let fighter = { ...located.fighter, movement: moved.state };
  if (input.combat) fighter = { ...fighter, combat: beginArenaAction({ actor: fighter.definition, state: fighter.combat, frame: input.frame }, input.combat).state };
  let team = replaceFighter(located.team, fighter);
  const events = [...state.events];
  if (input.combat) events.push(event(state, input, "fighter.action", input.actorId, null, 0, input.combat.kind));
  if (team.tagVulnerableUntil >= input.frame && input.combat?.kind === "dodge") {
    team = { ...team, tagVulnerableUntil: 0 };
    events.push(event(state, input, "fighter.tag-cancelled", input.actorId, null, 0, "Incoming fighter spent a dodge to cancel tag vulnerability."));
  }
  if (moved.events.some((value) => value.kind === "fall-damage")) {
    const fall = moved.events.find((value) => value.kind === "fall-damage")!;
    fighter = { ...fighter, combat: { ...fighter.combat, vitality: Math.max(0, fighter.combat.vitality - fall.amount) } };
    team = replaceFighter(team, fighter);
    events.push(event(state, input, "fighter.fell", input.actorId, null, fall.amount, "Aerial recovery failed before the sealed fall plane."));
  }
  if (input.tagAssetId) {
    const incoming = team.fighters[input.tagAssetId];
    if (!incoming || incoming.status !== "ready") throw new Error("arena_tag_target_invalid");
    team = replaceFighter(team, { ...fighter, status: "ready" });
    team = replaceFighter(team, { ...incoming, status: "active" });
    team = { ...team, activeAssetId: incoming.definition.assetId, tagVulnerableUntil: input.frame + 18 };
    events.push(event(state, input, "fighter.tagged", input.actorId, incoming.definition.assetId, 18, "Vulnerable tag window opened."));
  }
  const teams: [ArenaTeamState, ArenaTeamState] = [...state.teams];
  teams[located.teamIndex] = team;
  let next: ArenaMatchState = { ...state, frame: input.frame, sequence: input.sequence, teams, events, inputs: [...state.inputs, input] };
  if (fighter.combat.vitality === 0) return settleZero(next, input, located.teamIndex, input.actorId);
  next = applyContextAction(next, input, located.teamIndex);
  next = applyHazards(next, input, located.teamIndex);
  if (next.phase === "terminal") return next;
  return applyBossTransition(resolveActiveHit(next, input, located.teamIndex), input);
}

export function advanceArenaMatch(state: ArenaMatchState, inputs: readonly ArenaInputFrame[]): ArenaMatchState {
  return inputs.reduce(advanceOne, state);
}

const neutralMovement: ArenaMovementInput = { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false };

function canonicalFrameInputs(state: ArenaMatchState, batch: ArenaFrameBatch): readonly ArenaInputFrame[] {
  if (state.phase === "terminal") throw new Error("arena_match_terminal");
  if (!Number.isSafeInteger(batch.frame) || batch.frame !== state.frame + 1) throw new Error("arena_frame_invalid");
  const byActor = new Map<string, ArenaFrameIntent>();
  for (const intent of batch.intents) {
    if (byActor.has(intent.actorId)) throw new Error("arena_frame_actor_duplicate");
    byActor.set(intent.actorId, intent);
  }
  const activeIds = new Set(state.teams.map((team) => team.activeAssetId));
  if ([...byActor.keys()].some((actorId) => !activeIds.has(actorId))) throw new Error("arena_input_actor_inactive");
  return state.teams.map((team, index) => {
    const actorId = team.activeAssetId;
    const supplied = byActor.get(actorId);
    return {
      sequence: state.sequence + index + 1,
      frame: batch.frame,
      actorId,
      movement: supplied?.movement ?? neutralMovement,
      combat: supplied?.combat ?? null,
      tagAssetId: supplied?.tagAssetId ?? null,
      contextTargetId: supplied?.contextTargetId ?? null,
      withdraw: supplied?.withdraw ?? false,
    };
  });
}

function applyFrameIntent(state: ArenaMatchState, input: ArenaInputFrame) {
  const located = actorLocation(state, input.actorId);
  const moved = stepArenaMovement(located.fighter.definition, state.stage.definition, located.fighter.movement, input.movement);
  let combat = advanceArenaCombatantState(located.fighter.combat, input.frame);
  if (input.combat) combat = beginArenaAction({ actor: located.fighter.definition, state: combat, frame: input.frame }, input.combat).state;
  let fighter = { ...located.fighter, movement: moved.state, combat };
  let team = replaceFighter(located.team, fighter);
  const events = [...state.events];
  if (input.combat) events.push(event(state, input, "fighter.action", input.actorId, null, 0, input.combat.kind));
  if (team.tagVulnerableUntil >= input.frame && input.combat?.kind === "dodge") {
    team = { ...team, tagVulnerableUntil: 0 };
    events.push(event(state, input, "fighter.tag-cancelled", input.actorId, null, 0, "Incoming fighter spent a dodge to cancel tag vulnerability."));
  }
  const fall = moved.events.find((value) => value.kind === "fall-damage");
  if (fall) {
    fighter = { ...fighter, combat: { ...fighter.combat, vitality: Math.max(0, fighter.combat.vitality - fall.amount) } };
    team = replaceFighter(team, fighter);
    events.push(event(state, input, "fighter.fell", input.actorId, null, fall.amount, "Aerial recovery failed before the sealed fall plane."));
  }
  // Atomic v2 defers tags until committed active hits resolve against the
  // fighter who was active at the beginning of this frame.
  const teams: [ArenaTeamState, ArenaTeamState] = [...state.teams];
  teams[located.teamIndex] = team;
  let next: ArenaMatchState = {
    ...state,
    frame: input.frame,
    sequence: input.sequence,
    teams,
    events,
    inputs: [...state.inputs, input],
  };
  next = applyContextAction(next, input, located.teamIndex);
  return next;
}

function applyFrameHazards(state: ArenaMatchState, input: ArenaInputFrame) {
  const teamIndex = state.teams.findIndex((team) => team.fighters[input.actorId]) as 0 | 1;
  if (teamIndex < 0) throw new Error("arena_input_actor_invalid");
  const team = state.teams[teamIndex];
  let actor = team.fighters[input.actorId]!;
  let next = state;
  const bossHazardIds = new Set(state.boss?.phases.map((phase) => phase.hazard) ?? []);
  for (const hazard of state.stage.hazards) {
    if (bossHazardIds.has(hazard.id) && state.stage.activeBossHazard !== hazard.id) continue;
    const key = `${input.actorId}:${hazard.id}`;
    if (distance(actor.movement.position, hazard.position) > hazard.radius || (next.stage.hazardCooldowns[key] ?? 0) > input.frame) continue;
    actor = { ...actor, combat: { ...actor.combat, vitality: Math.max(0, actor.combat.vitality - hazard.damage) } };
    const teams: [ArenaTeamState, ArenaTeamState] = [...next.teams];
    teams[teamIndex] = replaceFighter(next.teams[teamIndex], actor);
    next = {
      ...next,
      teams,
      stage: { ...next.stage, hazardCooldowns: { ...next.stage.hazardCooldowns, [key]: input.frame + 60 } },
      events: [...next.events, event(next, input, "hazard.hit", input.actorId, hazard.id, hazard.damage, "Sealed arena hazard applied.")],
    };
  }
  return next;
}

function applyFrameTag(state: ArenaMatchState, input: ArenaInputFrame) {
  if (!input.tagAssetId || state.phase === "terminal") return state;
  const teamIndex = state.teams.findIndex((team) => team.fighters[input.actorId]) as 0 | 1;
  if (teamIndex < 0) throw new Error("arena_input_actor_invalid");
  const team = state.teams[teamIndex];
  const outgoing = team.fighters[input.actorId];
  const incoming = team.fighters[input.tagAssetId];
  if (!outgoing || outgoing.status !== "active" || team.activeAssetId !== input.actorId || !incoming || incoming.status !== "ready") {
    throw new Error("arena_tag_target_invalid");
  }
  let nextTeam = replaceFighter(team, { ...outgoing, status: "ready" });
  nextTeam = replaceFighter(nextTeam, { ...incoming, status: "active" });
  nextTeam = { ...nextTeam, activeAssetId: incoming.definition.assetId, tagVulnerableUntil: input.frame + 18 };
  const teams: [ArenaTeamState, ArenaTeamState] = [...state.teams];
  teams[teamIndex] = nextTeam;
  return {
    ...state,
    teams,
    events: [...state.events, event(state, input, "fighter.tagged", input.actorId, incoming.definition.assetId, 18, "Vulnerable tag window opened after committed hits resolved.")],
  };
}

function applySimultaneousHits(state: ArenaMatchState, inputs: readonly ArenaInputFrame[]) {
  const snapshot = state;
  const resolutions = inputs.flatMap((input) => {
    const attackerTeamIndex = snapshot.teams.findIndex((team) => team.activeAssetId === input.actorId) as 0 | 1;
    if (attackerTeamIndex < 0) return [];
    const targetTeamIndex = attackerTeamIndex === 0 ? 1 : 0;
    const attacker = snapshot.teams[attackerTeamIndex].fighters[input.actorId]!;
    const targetId = snapshot.teams[targetTeamIndex].activeAssetId;
    const target = snapshot.teams[targetTeamIndex].fighters[targetId]!;
    const hitId = `${input.actorId}:${attacker.combat.action.startedFrame}:${targetId}`;
    if (snapshot.resolvedHitIds.includes(hitId)) return [];
    const result = resolveArenaHit({
      frame: input.frame,
      attacker: attacker.definition,
      attackerState: attacker.combat,
      attackerPosition: attacker.movement.position,
      target: target.definition,
      targetState: target.combat,
      targetPosition: target.movement.position,
    });
    if (result.outcome === "inactive" || result.outcome === "miss") return [];
    return [{ input, targetTeamIndex, targetId, hitId, result }];
  });
  let next = state;
  for (const resolution of resolutions) {
    const target = next.teams[resolution.targetTeamIndex].fighters[resolution.targetId]!;
    const targetState = {
      ...resolution.result.targetState,
      vitality: Math.max(0, target.combat.vitality - resolution.result.vitalityDamage),
      break: Math.max(0, target.combat.break - resolution.result.breakDamage),
      statuses: [...target.combat.statuses, ...resolution.result.statusesAdded],
    };
    const nextTarget = {
      ...target,
      combat: targetState,
      movement: resolution.result.launch.length > 0
        ? { ...target.movement, velocity: { x: resolution.result.launch.x, y: resolution.result.launch.y, z: resolution.result.launch.z }, grounded: false }
        : target.movement,
    };
    const teams: [ArenaTeamState, ArenaTeamState] = [...next.teams];
    teams[resolution.targetTeamIndex] = replaceFighter(next.teams[resolution.targetTeamIndex], nextTarget);
    const kind = resolution.result.outcome === "guarded" ? "fighter.guarded" : resolution.result.outcome === "parried" ? "fighter.parried" : resolution.result.outcome === "dodged" ? "fighter.dodged" : "fighter.hit";
    next = {
      ...next,
      teams,
      resolvedHitIds: [...next.resolvedHitIds, resolution.hitId],
      events: [...next.events, event(next, resolution.input, kind, resolution.input.actorId, resolution.targetId, resolution.result.vitalityDamage, `${resolution.result.outcome} resolved from atomic fixed-frame combat.`)],
    };
  }
  return next;
}

function settleFrameZeros(state: ArenaMatchState, inputs: readonly ArenaInputFrame[]) {
  let next = state;
  const defeated: Array<0 | 1> = [];
  for (const teamIndex of [0, 1] as const) {
    const team = next.teams[teamIndex];
    const assetId = team.activeAssetId;
    const fighter = team.fighters[assetId]!;
    if (fighter.combat.vitality > 0) continue;
    const status: ArenaFighterRuntimeStatus = arenaModePolicy(next.mode).mortality === "retirement" ? "retired" : "knocked-out";
    let nextTeam = replaceFighter(team, { ...fighter, combat: { ...fighter.combat, vitality: 0 }, status });
    const replacementId = nextTeam.order.find((id) => nextTeam.fighters[id]!.status === "ready");
    const sourceInput = inputs[teamIndex === 0 ? 1 : 0] ?? inputs[0]!;
    next = {
      ...next,
      events: [...next.events, event(next, sourceInput, status === "retired" ? "fighter.retired" : "fighter.knocked-out", assetId, null, 0, status === "retired" ? "Verified zero Vitality sealed retirement." : "Non-mortal zero Vitality sealed a knockout.")],
    };
    if (replacementId) {
      nextTeam = replaceFighter(nextTeam, { ...nextTeam.fighters[replacementId]!, status: "active" });
      nextTeam = { ...nextTeam, activeAssetId: replacementId, tagVulnerableUntil: state.frame + 18 };
    } else {
      defeated.push(teamIndex);
    }
    const teams: [ArenaTeamState, ArenaTeamState] = [...next.teams];
    teams[teamIndex] = nextTeam;
    next = { ...next, teams };
  }
  if (defeated.length === 2) {
    return { ...next, phase: "terminal" as const, terminal: { reason: "double-defeat" as const, winnerTeamId: null, loserTeamId: null, frame: state.frame } };
  }
  if (defeated.length === 1) return terminalFor(next, defeated[0]!, state.frame, "team-defeat");
  return next;
}

export function advanceArenaFrame(state: ArenaMatchState, batch: ArenaFrameBatch): ArenaMatchState {
  const inputs = canonicalFrameInputs(state, batch);
  const withdrawals = inputs.filter((input) => input.withdraw);
  if (withdrawals.length) {
    const events = withdrawals.map((input) => event(state, input, "fighter.withdrew", input.actorId, null, 0, "Team withdrew before zero Vitality."));
    const recorded: ArenaMatchState = {
      ...state,
      frame: batch.frame,
      sequence: inputs.at(-1)!.sequence,
      inputs: [...state.inputs, ...inputs],
      events: [...state.events, ...events],
    };
    if (withdrawals.length === 2) return { ...recorded, phase: "terminal", terminal: { reason: "mutual-withdrawal", winnerTeamId: null, loserTeamId: null, frame: batch.frame } };
    const loserIndex = recorded.teams.findIndex((team) => team.fighters[withdrawals[0]!.actorId]) as 0 | 1;
    return terminalFor(recorded, loserIndex, batch.frame, "withdrawal");
  }
  let next = inputs.reduce(applyFrameIntent, state);
  next = inputs.reduce(applyFrameHazards, next);
  next = applySimultaneousHits(next, inputs);
  next = settleFrameZeros(next, inputs);
  if (next.phase === "terminal") return next;
  next = inputs.reduce(applyFrameTag, next);
  return applyBossTransition(next, inputs.at(-1)!);
}
