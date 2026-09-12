import { settleWildsConstructionWork } from "./wilds-construction-work-reward";
import { createWildsBurrow, type WildsBurrowRequest } from "./wilds-burrow";
import { settleWildsBuild, verifyWildsBuildSettlement } from "./wilds-steward-build-settlement";
import { playerStewardBuilder } from "./wilds-steward-construction";
import { WILDS_COMMAND_LAW, worldConstitutionalDecision } from "./wilds-world-constitution";
import { WildsConstitutionalError, constitutionalDigest, constitutionalPredicate, deriveConstitutionalDecision } from "./wilds-constitution";
import { resolveWildsCraftWorkstation, resolveWildsMaterialCache } from "./wilds-construction-function";
import { generateCrystalBurrower, type WildsBoss } from "./wilds-boss-generator";
import { deriveWildsBossSuccessor, generateWildsBoss, WILDS_BOSS_FAMILIES, type WildsBossDefinition } from "./wilds-boss-ecology";
import { advanceDynamicSite, generateCrystalBurrow, type WildsDynamicSite } from "./wilds-dynamic-sites";
import { advanceWildsEcologySite, deriveWildsEcologyChild, generateWildsEcologyEnsemble, type WildsEcologyPhase, type WildsEcologySite } from "./wilds-ecology";
import { admitRaidPlayer, applyRaidContribution, createWildsRaid, type WildsRaid } from "./wilds-raid-core";
import { applyWildsRaidIntent, createWildsRaidEncounter, type WildsRaidIntent } from "./wilds-raid-encounter";
import { admitWildsRaidParticipant, createWildsRaidRound, renewWildsRaidLease, retreatWildsRaidParticipant, settleWildsRaidRound, type WildsRaidRound } from "./wilds-raid-round";
import { deriveKaiKlokMoment, deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString, KAI_N_DAY_MICRO, KAI_PULSE_DURATION_MS } from "./kai-klok-moment";
import type { KaiTemporalRoot } from "./kai-temporal-root";
import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "./portable-card";
import { creatureForm } from "./creature-catalog";
import { reverifyWildsCreatureMandate, type WildsCreatureMandateV1 } from "./wilds-creature-mandate";
import type { WildsResourceSource } from "./wilds-resource-authority";
import {
  createWildsMaterialHarvest,
  createWildsStewardHarvestOperation,
  createWildsStewardPhiAward,
  createWildsStewardStructureOperation,
  createWildsStewardTool,
  createWildsStewardToolOperation,
  createWildsTrailCache,
  createWildsTrailBridge,
  createWildsTrailShelter,
  createWildsWorkstation,
  initialWildsHarvestedSourceState,
  projectWildsCreatureWorkFamilies,
  wildsMaterialContributorReceizIds,
  type WildsStewardPhiAwardV1,
  type WildsStewardToolKind
} from "./wilds-steward-construction";
import { wildsWorldSourceEmission } from "./wilds-world-genesis";
import { sampleWildsTerrain } from "./wilds-terrain-authority";
import { achievementGrantCandidates } from "./wilds-saga-achievements";
import { wildsSagaFramework } from "./wilds-saga-content";
import { projectWildsSaga } from "./wilds-saga-director";
import { projectSagaTournament, settleSagaTournament, type WildsTournamentProjection } from "./wilds-saga-tournament";
import { projectSagaTrainers, type WildsTrainerBattleMemory, type WildsTrainerProjection } from "./wilds-saga-trainers";
import type { WildsGameplayVerb } from "./wilds-saga-types";
import { createWildsTeam, joinWildsTeam, scoreWildsLeague } from "./wilds-team-league";
import { acceptWildsInvite, assembleWildsSquad, changeWildsRole, inviteWildsPlayer, reportWildsAbuse, scheduleWildsTeamEvent, type WildsSocialTeam } from "./wilds-social-core";
import type { WildsRegenerativeGroveV1 } from "./wilds-regenerative-grove";
import type { WildsLivingOperationPlanV1 } from "./wilds-living-operation";
import { admitWildsEmission, previewWildsEmission, type WildsWorldEmissionProofV1 } from "./wilds-world-emission";
import type { WildsResourceLotV1 } from "./wilds-resource-lot";
import {
  completeWildsConstructionSite,
  contributeWildsConstructionSite,
  createWildsConstructionSite,
  type WildsConstructionBlueprint
} from "./wilds-construction-site";
import { projectWildsGroveGenesis } from "./wilds-grove-genesis";
import {
  createWildsWorldEvent,
  wildsWorldEventSequence,
  wildsWorldEventUPulse,
  type WildsWorldEvent,
  type WildsWorldEventKind
} from "./wilds-world-event";
import { verifyWildsWorldCommandCard, verifyWildsWorldCommandKai } from "./wilds-world-authority";
import {
  checkpointWildsWorld,
  initialWildsWorldProjection,
  replayWildsWorld,
  reduceWildsWorldEvent,
  wildsWorldCursorSequence,
  wildsWorldCursorUPulse,
  wildsMaterialCustodian,
  type WildsWorldCheckpoint,
  type WildsWorldEcologyProjection,
  type WildsWorldProjection
} from "./wilds-world-state";

import { reviseWildsConstructionChunkReference, createWildsConstructionProject, createWildsConstructionChunk, appendWildsConstructionChunkReference, appendWildsConstructionProjectChunk, constructionProofDigest, canWildsConstructionProject } from "./wilds-construction-project";
import { adjustWildsConstructionComponent, createWildsConstructionComponent, createWildsMaterialContribution, createWildsWorkContribution, projectWildsConstructionProgress } from "./wilds-construction-component";
import { previewWildsConstructionAdjustment, projectWildsProductionPlacementEvidence, type WildsConstructionPlacementRequest } from "./wilds-construction-placement";
import type { WildsBlueprintPlacement } from "./wilds-world-construction";

export type WildsWorldCommand = (
  | { type: "construction.project.create"; name: string; region: { x: number; z: number }; commandId: string }
  | { type: "construction.component.place"; projectId: string; placement: WildsBlueprintPlacement; request: WildsConstructionPlacementRequest; actorPosition: { x: number; z: number }; commandId: string }
  | { type: "construction.burrow.dig"; request:WildsBurrowRequest; actorPosition:{x:number;y:number;z:number};cardProofDigest:string;commandId:string }
  | { type: "construction.component.adjust"; componentId: string; componentHead: string; placement: WildsBlueprintPlacement; request: WildsConstructionPlacementRequest; actorPosition: { x: number; z: number }; commandId: string }
  | { type: "construction.component.deposit"; componentId: string; componentHead: string; lotIds: string[]; actorPosition: { x: number; z: number }; commandId: string }
  | { type: "construction.component.work"; componentId: string; componentHead: string; actorPosition: { x: number; z: number }; creature?: { subjectId: string; head: string }; commandId: string }
  | { type: "boss.track"; bossId: string; position: { x: number; z: number }; commandId: string }
  | { type: "raid.enter"; bossId: string; roundId: string; position: { x: number; z: number }; preferredSquad?: number; commandId: string }
  | { type: "raid.act"; bossId: string; roundId: string; intent: WildsRaidIntent["type"]; commandId: string }
  | { type: "raid.lease"; bossId: string; roundId: string; status: "connected" | "disconnected"; commandId: string }
  | { type: "raid.retreat"; bossId: string; roundId: string; commandId: string }
  | { type: "raid.join"; bossId: string; preferredSquad?: number; commandId: string }
  | { type: "raid.contribute"; bossId: string; damage: number; support: number; cardProofDigest: string; commandId: string }
  | { type: "team.create"; name: string; commandId: string }
  | { type: "team.join"; teamId: string; commandId: string }
  | { type: "team.invite"; teamId: string; inviteeId: string; expiresAt: string; inviteeAccountAgeDays?: number; commandId: string }
  | { type: "team.invite.accept"; teamId: string; inviteId: string; commandId: string }
  | { type: "team.role"; teamId: string; playerId: string; role: "captain" | "officer" | "member"; commandId: string }
  | { type: "team.role.change"; teamId: string; playerId: string; role: "captain" | "officer" | "member"; commandId: string }
  | { type: "team.event.schedule"; teamId: string; startsAt: string; endsAt: string; commandId: string }
  | { type: "team.squad.assemble"; teamId: string; eventId: string; playerIds: string[]; commandId: string }
  | { type: "social.report"; subjectId: string; reason: string; commandId: string }
  | { type: "ecology.discover"; siteId: string; position: { x: number; z: number }; commandId: string }
  | { type: "ecology.contribute"; siteId: string; position: { x: number; z: number }; amount: number; cardProofDigest: string; commandId: string }
  | { type: "grove.observe"; grove: WildsRegenerativeGroveV1; emission: WildsWorldEmissionProofV1; commandId: string }
  | { type: "grove.act"; operation: WildsLivingOperationPlanV1; grove: WildsRegenerativeGroveV1; emission: WildsWorldEmissionProofV1; amountPhiMicro: string; resourceLot?: WildsResourceLotV1 | null; commandId: string }
  | { type: "resource.transfer.admit"; lotId: string; ownerReceizId: string; subjectId: string; subjectHead: string; receiptId: string; transferId: string; commandId: string }
  | { type: "resource.material.transfer.admit"; lotId: string; ownerReceizId: string; subjectId: string; subjectHead: string; receiptId: string; transferId: string; commandId: string }
  | { type: "resource.material.harvest"; source: WildsResourceSource; sourceHead: string; actorPosition: { x: number; z: number }; toolId?: string; mandate?: WildsCreatureMandateV1; cardProofDigest?: string; operation?: WildsLivingOperationPlanV1; emission?: WildsWorldEmissionProofV1; amountPhiMicro?: string; phiAward?: WildsStewardPhiAwardV1; commandId: string }
  | { type: "construction.site.place"; blueprint: WildsConstructionBlueprint; position: { x: number; z: number }; actorPosition: { x: number; z: number }; rotationQuarterTurns: number; lotIds: string[]; cardProofDigest?: string; commandId: string }
  | { type: "construction.site.contribute"; siteId: string; siteHead: string; actorPosition: { x: number; z: number }; lotIds: string[]; cardProofDigest?: string; commandId: string }
  | { type: "construction.site.work"; siteId: string; siteHead: string; actorPosition: { x: number; z: number }; mandate?: WildsCreatureMandateV1; cardProofDigest?: string; operation?: WildsLivingOperationPlanV1; emission?: WildsWorldEmissionProofV1; amountPhiMicro?: string; phiAward?: WildsStewardPhiAwardV1; commandId: string }
  | { type: "structure.trail-shelter.build"; position: { x: number; z: number }; actorPosition: { x: number; z: number }; rotationQuarterTurns: number; lotIds: string[]; mandate?: WildsCreatureMandateV1; cardProofDigest?: string; operation?: WildsLivingOperationPlanV1; emission?: WildsWorldEmissionProofV1; amountPhiMicro?: string; phiAward?: WildsStewardPhiAwardV1; commandId: string }
  | { type: "structure.trail-bridge.build"; position: { x: number; z: number }; actorPosition: { x: number; z: number }; rotationQuarterTurns: number; lotIds: string[]; mandate?: WildsCreatureMandateV1; cardProofDigest?: string; operation?: WildsLivingOperationPlanV1; emission?: WildsWorldEmissionProofV1; amountPhiMicro?: string; phiAward?: WildsStewardPhiAwardV1; commandId: string }
  | { type: "structure.steward-workbench.build"; position: { x: number; z: number }; actorPosition: { x: number; z: number }; rotationQuarterTurns: number; lotIds: string[]; mandate?: WildsCreatureMandateV1; cardProofDigest?: string; operation?: WildsLivingOperationPlanV1; emission?: WildsWorldEmissionProofV1; amountPhiMicro?: string; phiAward?: WildsStewardPhiAwardV1; commandId: string }
  | { type: "structure.trail-cache.build"; position: { x: number; z: number }; actorPosition: { x: number; z: number }; rotationQuarterTurns: number; lotIds: string[]; mandate?: WildsCreatureMandateV1; cardProofDigest?: string; operation?: WildsLivingOperationPlanV1; emission?: WildsWorldEmissionProofV1; amountPhiMicro?: string; phiAward?: WildsStewardPhiAwardV1; commandId: string }
  | { type: "tool.steward.craft"; kind: WildsStewardToolKind; workstationId: string; actorPosition: { x: number; z: number }; lotIds: string[]; mandate?: WildsCreatureMandateV1; cardProofDigest?: string; operation?: WildsLivingOperationPlanV1; emission?: WildsWorldEmissionProofV1; amountPhiMicro?: string; phiAward?: WildsStewardPhiAwardV1; commandId: string }
  | { type: "tool.steward.equip"; toolId: string; commandId: string }
  | { type: "storage.material.move"; lotId: string; cacheId: string; direction: "deposit" | "withdraw"; actorPosition: { x: number; z: number }; commandId: string }
  | { type: "story.contribute"; dayId: string; objectiveId: string; verb: WildsGameplayVerb; amount: number; position?: { x: number; z: number }; cardProofDigest?: string; commandId: string }
  | { type: "story.trainer_battle"; dayId: string; trainerId: string; matchId: string; outcome: "player_victory" | "trainer_victory" | "fled"; cardProofDigest: string; commandId: string }
  | { type: "story.tournament_enter"; tournamentId: string; qualificationGrantId: string; cardProofDigest: string; commandId: string }
) & { kai?: KaiTemporalRoot };

export type WildsWorldAuthority = {
  actorId: string;
  canonical: boolean;
  pulse: string;
  occurredAt: string;
  /** Exact admitted Kai root. ISO pulse is descriptive when this is present. */
  uPulse?: number;
  card?: PortableCardAsset;
};

type WildsWorldTemporalAuthority = Pick<WildsWorldAuthority, "actorId" | "pulse" | "occurredAt" | "uPulse">;

function authorityMoment(authority: Pick<WildsWorldAuthority, "pulse" | "uPulse">) {
  return authority.uPulse === undefined
    ? deriveKaiKlokMoment({ occurredAt: authority.pulse, authority: "world" })
    : deriveKaiKlokMomentFromUPulse({ uPulse: authority.uPulse, authority: "world" });
}

function commandIdValid(value: string) {
  return value.length >= 6 && value.length <= 180 && /^[a-z0-9][a-z0-9:._-]*$/i.test(value);
}

export class WildsWorldService {
  private projection: WildsWorldProjection;
  private eventTail: WildsWorldEvent[];
  private constitutionalCommand: { digest: string; type: string } | null = null;

  constructor(input?: { checkpoint?: WildsWorldCheckpoint; events?: WildsWorldEvent[] }) {
    this.projection = input?.checkpoint ? replayWildsWorld([], input.checkpoint) : initialWildsWorldProjection();
    this.eventTail = [];
    const checkpointCursor = input?.checkpoint?.projection.cursor ?? null;
    for (const event of input?.events ?? []) {
      if (checkpointCursor) {
        const eventUPulse = wildsWorldEventUPulse(event);
        const cursorUPulse = wildsWorldCursorUPulse(checkpointCursor);
        if (eventUPulse < cursorUPulse
          || (eventUPulse === cursorUPulse && wildsWorldEventSequence(event) <= wildsWorldCursorSequence(checkpointCursor))) continue;
      }
      this.appendExisting(event);
    }
  }

  snapshot() {
    return this.projection;
  }

  checkpoint() {
    return checkpointWildsWorld(this.projection);
  }

  events() {
    return [...this.eventTail];
  }

  private appendExisting(event: WildsWorldEvent) {
    this.projection = reduceWildsWorldEvent(this.projection, event);
    this.eventTail = [...this.eventTail, event].slice(-2_048);
  }

  private append(kind: WildsWorldEventKind, payload: unknown, authority: WildsWorldTemporalAuthority, causeId: string) {
    const moment = authorityMoment(authority);
    const kaiKlok = this.projection.cursor && wildsWorldCursorUPulse(this.projection.cursor) === moment.uPulse
      ? wildsWorldCursorSequence(this.projection.cursor) + 1
      : 1;
    const event = createWildsWorldEvent({
      kind,
      actorId: authority.actorId,
      causeId,
      uPulse: moment.uPulse,
      pulse: authority.pulse,
      kaiKlok,
      occurredAt: authority.occurredAt,
      previousEventId: this.projection.cursor?.eventId ?? null,
      payload: this.constitutionalCommand ? { ...(payload as Record<string, unknown>), constitutionalCommand: this.constitutionalCommand } : payload
    });
    this.appendExisting(event);
    return event;
  }

  private sagaAt(authority: Pick<WildsWorldAuthority, "pulse" | "uPulse">) {
    const moment = authorityMoment(authority);
    const saga = projectWildsSaga({ moment, framework: wildsSagaFramework(), memories: this.projection.story.memories });
    return { moment, saga };
  }

  private sagaTrainers(saga: ReturnType<WildsWorldService["sagaAt"]>["saga"]) {
    const memories = Object.values(this.projection.trainers).flatMap((trainer) => Array.isArray(trainer.battleMemories) ? trainer.battleMemories as WildsTrainerBattleMemory[] : []);
    const playerLevel = Math.max(1, ...Object.values(this.projection.players).map((player) => player.trainerLevel));
    return projectSagaTrainers({ saga, playerLevel, battleMemories: memories });
  }

  private settleTournamentForDay(dayId: string, occurredAt: string, authority: WildsWorldTemporalAuthority, causeId: string, events: WildsWorldEvent[]) {
    const current = Object.values(this.projection.tournaments).find((tournament) => tournament.dayId === dayId && tournament.phase !== "settled") as WildsTournamentProjection | undefined;
    if (!current) return;
    const tournament = settleSagaTournament({ tournament: current, occurredAt });
    events.push(this.append("story.tournament_settled", { tournament }, authority, causeId));
  }

  private advanceSaga(input: { occurredAt: string }, authority: WildsWorldTemporalAuthority, causeId: string, events: WildsWorldEvent[]) {
    const { moment, saga } = this.sagaAt(authority);
    const prior = this.projection.story.activeChapter;
    if (prior && prior.dayId !== saga.dayId && !this.projection.story.settledDayIds.includes(prior.dayId)) {
      this.settleTournamentForDay(prior.dayId, input.occurredAt, authority, causeId, events);
      const definition = wildsSagaFramework().dailyChapters.find((chapter) => chapter.id === prior.chapterId);
      if (!definition) throw new Error("wilds_story_definition_missing");
      const objectives = definition.missions.filter((mission) => mission.primary).flatMap((mission) => mission.nodes);
      const target = objectives.reduce((total, objective) => total + objective.target, 0);
      const progress = objectives.reduce((total, objective) => total + Math.min(objective.target, this.projection.story.objectiveTotals[objective.id] ?? 0), 0);
      const outcome = progress === 0 ? "unopposed" : progress >= target ? "success" : progress * 2 >= target ? "partial" : "failure";
      const memory = {
        chapterId: prior.chapterId,
        dayId: prior.dayId,
        outcome,
        hookId: definition.outcomeHooks[outcome],
        settledEventId: `settlement:${prior.dayId}`,
        settledAt: input.occurredAt
      };
      events.push(this.append("story.chapter_settled", { memory }, authority, causeId));
    }

    if (this.projection.story.activeChapter?.dayId !== saga.dayId) {
      const dayDurationMs = Number(KAI_N_DAY_MICRO) / 1_000_000 * KAI_PULSE_DURATION_MS;
      const instant = Date.parse(input.occurredAt);
      const openedAt = new Date(instant - moment.dayProgress * dayDurationMs).toISOString();
      const endsAt = new Date(instant + (1 - moment.dayProgress) * dayDurationMs).toISOString();
      const chapter = { dayId: saga.dayId, chapterId: saga.chapter.id, frameworkVersion: saga.frameworkVersion, openedAt, endsAt };
      events.push(this.append("story.chapter_opened", { chapter }, authority, causeId));
      for (const trainer of this.sagaTrainers(saga)) events.push(this.append("story.trainer_encountered", { trainer }, authority, causeId));
    }

    const openTournament = Object.values(this.projection.tournaments).find((tournament) => tournament.dayId === saga.dayId) as WildsTournamentProjection | undefined;
    if (openTournament && moment.ark === "Dream" && openTournament.phase !== "settled") {
      this.settleTournamentForDay(saga.dayId, input.occurredAt, authority, causeId, events);
    } else if (!openTournament && moment.arkIndex >= 4) {
      const qualifiedPlayers = Object.values(this.projection.players).flatMap((player) => Object.values(player.achievementGrants))
        .filter((grant) => grant.definitionId === saga.chapter.tournament.qualificationAchievementId && grant.scopeInstanceId === saga.dayId)
        .map((grant) => ({ id: grant.playerId, seedScore: this.projection.players[grant.playerId]?.trainerXp ?? 0 }));
      const tournament = projectSagaTournament({ saga, moment, qualifiedPlayers, trainers: this.sagaTrainers(saga), results: [] });
      events.push(this.append("story.tournament_opened", { tournament }, authority, causeId));
      if (moment.ark === "Dream") this.settleTournamentForDay(saga.dayId, input.occurredAt, authority, causeId, events);
    }
  }

  private constitutionalSystemTransition(law: string, actor: string, action: () => { events: WildsWorldEvent[]; projection: WildsWorldProjection }) {
    const before = this.projection, previousTail = this.eventTail;
    try {
      if (actor !== "receiz:pulse") throw new Error("wilds_constitution_system_scope_invalid");
      const result = action();
      const constitution = deriveConstitutionalDecision({ sourceState: constitutionalDigest(before), actor,
        standing: "DELEGATED_EXECUTION_AUTHORITY", authority: law, successor: constitutionalDigest(result.projection), predicates: [
          constitutionalPredicate("TOB-54/74", "System execution remains within its declared deterministic simulation rule", true, [law]),
          constitutionalPredicate("TOB-60/62/75", "Ordered source transitions preserve predecessor continuity", true, result.events.map(event => event.digest))
        ] });
      return { ...result, constitution };
    } catch (error) { this.projection = before; this.eventTail = previousTail; throw error; }
  }

  tick(input: { pulse: string; occurredAt: string; uPulse?: number; systemActorId: "receiz:pulse" }) {
    return this.constitutionalSystemTransition("wildz:simulation:site-boss-saga", input.systemActorId, () => this.tickUnderSourceLaw(input));
  }
  private tickUnderSourceLaw(input: { pulse: string; occurredAt: string; uPulse?: number; systemActorId: "receiz:pulse" }) {
    if (input.systemActorId !== "receiz:pulse") throw new Error("wilds_world_pulse_authority_invalid");
    // A scheduler retry may arrive after a newer pulse has already been
    // committed (for example after a process restart).  Reject that stale
    // tick before generating any deterministic sites so it can never append
    // an out-of-order event or accidentally fork the world timeline.
    const moment = authorityMoment(input);
    if (this.projection.cursor && moment.uPulse < wildsWorldCursorUPulse(this.projection.cursor)) {
      throw new Error("wilds_world_pulse_order_invalid");
    }
    const causeId = `pulse:${moment.uPulse}`;
    if (this.eventTail.some((event) => event.causeId === causeId)) return { events: [], projection: this.projection };
    const authority = { actorId: input.systemActorId, pulse: input.pulse, occurredAt: input.occurredAt, uPulse: moment.uPulse };
    const events: WildsWorldEvent[] = [];
    this.advanceSaga(input, authority, causeId, events);
    const existingBosses = Object.values(this.projection.bosses) as WildsBossDefinition[];
    const undefeated = existingBosses.filter((boss) => !["defeated", "memorialized", "withdrawn"].includes(boss.phase));
    if (undefeated.length >= 3) return { events, projection: this.projection };

    const defeatedParent = existingBosses.find((boss) => (boss.phase === "defeated" || boss.phase === "memorialized") && !existingBosses.some((candidate) => candidate.parentBossId === boss.id));
    if (defeatedParent) {
      const successor = deriveWildsBossSuccessor({
        parent: defeatedParent,
        causeEventId: `defeat:${defeatedParent.id}`,
        pulse: input.pulse,
        ordinal: existingBosses.length + 1,
        existingBosses
      });
      if (successor && !undefeated.some((boss) => boss.regionId === successor.regionId)) {
        const site: WildsDynamicSite = {
          id: successor.siteId,
          familyId: "crystal-burrow",
          name: "Crystal Burrow",
          position: { ...successor.position },
          radius: 9,
          phase: "emerged",
          spawnedAt: successor.emergedAt,
          expiresAt: new Date(Date.parse(successor.emergedAt) + 30 * 24 * 60 * 60 * 1_000).toISOString(),
          bossId: null,
          seedDigest: successor.seedDigest
        };
        events.push(this.append("site.spawned", { site }, authority, causeId));
        const raid = createWildsRaidRound({ boss: successor, ordinal: 1, openedAt: input.occurredAt });
        events.push(this.append("boss.emerged", { boss: successor, raid }, authority, causeId));
        return { events, projection: this.projection };
      }
    }

    const activeSites = Object.values(this.projection.sites).filter((site): site is WildsDynamicSite => site.familyId === "crystal-burrow") as WildsDynamicSite[];
    const occupiedRegions = new Set(undefeated.map((boss) => boss.regionId));
    let site: WildsDynamicSite | null = null;
    for (let probe = 0; probe < 128; probe += 1) {
      const candidate = generateCrystalBurrow({ pulse: input.pulse, ordinal: activeSites.length + probe + 1, activeSites });
      const candidateRegion = `region:${Math.floor(candidate.position.x / 64)}:${Math.floor(candidate.position.z / 64)}`;
      if (!occupiedRegions.has(candidateRegion)) { site = candidate; break; }
    }
    if (!site) return { events, projection: this.projection };
    events.push(this.append("site.spawned", { site }, authority, causeId));
    const tracked = advanceDynamicSite(site, "tracked");
    events.push(this.append("site.phase_changed", { siteId: site.id, phase: tracked.phase }, authority, causeId));
    const emerged = advanceDynamicSite(tracked, "emerged");
    events.push(this.append("site.phase_changed", { siteId: site.id, phase: emerged.phase }, authority, causeId));
    const familyId = WILDS_BOSS_FAMILIES[existingBosses.length % WILDS_BOSS_FAMILIES.length]!;
    const boss = generateWildsBoss({ familyId, site: emerged, pulse: input.pulse, ordinal: existingBosses.filter((candidate) => candidate.familyId === familyId).length + 1, existingBosses });
    const raid = createWildsRaidRound({ boss, ordinal: 1, openedAt: input.occurredAt });
    events.push(this.append("boss.emerged", { boss, raid }, authority, causeId));
    return { events, projection: this.projection };
  }

  tickEcology(input: { pulse: string; occurredAt: string; uPulse?: number; systemActorId: "receiz:pulse" }) {
    return this.constitutionalSystemTransition("wildz:simulation:ecology", input.systemActorId, () => this.tickEcologyUnderSourceLaw(input));
  }
  private tickEcologyUnderSourceLaw(input: { pulse: string; occurredAt: string; uPulse?: number; systemActorId: "receiz:pulse" }) {
    if (input.systemActorId !== "receiz:pulse") throw new Error("wilds_world_pulse_authority_invalid");
    const moment = authorityMoment(input);
    if (this.projection.cursor && moment.uPulse < wildsWorldCursorUPulse(this.projection.cursor)) {
      throw new Error("wilds_world_pulse_order_invalid");
    }
    const causeId = `ecology-pulse:${moment.uPulse}`;
    if (this.eventTail.some((event) => event.causeId === causeId)) return { events: [], projection: this.projection };
    const authority = { actorId: input.systemActorId, pulse: input.pulse, occurredAt: input.occurredAt, uPulse: moment.uPulse };
    const events: WildsWorldEvent[] = [];
    const pulseMs = Date.parse(input.pulse);
    const orderedSites = () => Object.values(this.projection.ecologySites)
      .sort((left, right) => left.spawnedAt.localeCompare(right.spawnedAt) || left.id.localeCompare(right.id));
    const due = (at: string) => pulseMs >= Date.parse(at);
    const changePhase = (site: WildsWorldEcologyProjection, phase: WildsEcologyPhase) => {
      const advanced = advanceWildsEcologySite(site, phase);
      events.push(this.append("ecology.phase_changed", { siteId: site.id, phase: advanced.phase }, authority, causeId));
      return this.projection.ecologySites[site.id]!;
    };
    const resolve = (site: WildsWorldEcologyProjection) => {
      const resolving = site.phase === "resolving" ? site : changePhase(site, "resolving");
      const aftermath = advanceWildsEcologySite(resolving, "aftermath");
      const resolved: WildsWorldEcologyProjection = { ...resolving, phase: aftermath.phase, resolvedAt: resolving.resolvesAt };
      events.push(this.append("ecology.resolved", { site: resolved }, authority, causeId));
    };

    // Resolve an admitted site when resolution and expiry share a deadline;
    // untouched foreshadowed sites expire and release capacity instead.
    for (const candidate of orderedSites()) {
      let site = this.projection.ecologySites[candidate.id];
      if (!site || site.phase === "aftermath" || site.phase === "historical" || site.phase === "expired") continue;
      const resolvesBeforeExpiry = Date.parse(site.resolvesAt) <= Date.parse(site.expiresAt);
      const expiresBeforeActivation = Date.parse(site.expiresAt) < Date.parse(site.activatesAt);

      if (site.phase === "foreshadowed") {
        if (due(site.expiresAt)) changePhase(site, "expired");
        continue;
      }
      if (site.phase === "discovered" && due(site.expiresAt) && expiresBeforeActivation) {
        changePhase(site, "expired");
        continue;
      }
      if (site.phase === "discovered" && due(site.activatesAt)) site = changePhase(site, "active");
      if (site.phase === "discovered") {
        if (due(site.expiresAt)) changePhase(site, "expired");
        continue;
      }
      if (site.phase === "active") {
        if (due(site.resolvesAt) && resolvesBeforeExpiry) resolve(site);
        else if (due(site.expiresAt)) changePhase(site, "expired");
        continue;
      }
      if (site.phase === "resolving" && due(site.resolvesAt)) resolve(site);
    }

    const aftermath = orderedSites()
      .filter((site) => site.phase === "aftermath")
      .filter((site) => !Object.values(this.projection.ecologySites).some((candidate) => candidate.parentSiteId === site.id));
    for (const site of orderedSites().filter((candidate) => candidate.phase === "aftermath" && due(candidate.historicizesAt))) {
      const historical = advanceWildsEcologySite(site, "historical");
      events.push(this.append("ecology.historicized", { site: { ...site, phase: historical.phase } }, authority, causeId));
    }
    for (const parent of aftermath) {
      const existingSites = Object.values(this.projection.ecologySites) as WildsEcologySite[];
      if (existingSites.some((candidate) => candidate.parentSiteId === parent.id)) continue;
      const child = deriveWildsEcologyChild({ parent, ordinal: existingSites.length + 1, existingSites });
      if (child) events.push(this.append("ecology.spawned", { site: ecologyProjection(child) }, authority, causeId));
    }
    const existingSites = Object.values(this.projection.ecologySites) as WildsEcologySite[];
    const ensemble = generateWildsEcologyEnsemble({ pulse: input.pulse, existingSites, ordinalStart: existingSites.length + 1 });
    for (const site of ensemble) events.push(this.append("ecology.spawned", { site: ecologyProjection(site) }, authority, causeId));
    return { events, projection: this.projection };
  }

  tickGroves(input: { pulse: string; occurredAt: string; uPulse?: number; systemActorId: "receiz:pulse" }) {
    return this.constitutionalSystemTransition("wildz:simulation:grove-regeneration", input.systemActorId, () => this.tickGrovesUnderSourceLaw(input));
  }
  private tickGrovesUnderSourceLaw(input: { pulse: string; occurredAt: string; uPulse?: number; systemActorId: "receiz:pulse" }) {
    if (input.systemActorId !== "receiz:pulse") throw new Error("wilds_world_pulse_authority_invalid");
    const moment = authorityMoment(input);
    if (this.projection.cursor && moment.uPulse < wildsWorldCursorUPulse(this.projection.cursor)) {
      throw new Error("wilds_world_pulse_order_invalid");
    }
    const hasGroves = Object.keys(this.projection.groves).length > 0;
    if (hasGroves || this.projection.worldEmission) {
      if (!hasGroves || !this.projection.worldEmission) throw new Error("wilds_world_grove_genesis_incomplete");
      return { events: [] as WildsWorldEvent[], projection: this.projection };
    }
    const causeId = `grove-genesis:${moment.year}`;
    const authority = { actorId: input.systemActorId, pulse: input.pulse, occurredAt: input.occurredAt, uPulse: moment.uPulse };
    const genesis = projectWildsGroveGenesis(moment);
    const events = genesis.groves.map((grove) =>
      this.append("grove.discovered", { grove, emission: genesis.emission }, authority, causeId)
    );
    return { events, projection: this.projection };
  }

  execute(command: WildsWorldCommand, authority: WildsWorldAuthority) {
    const before = this.projection;
    const previousTail = this.eventTail;
    try {
      if (!Object.hasOwn(WILDS_COMMAND_LAW, command.type)) throw new Error("wilds_constitution_action_undefined");
      const preflight = worldConstitutionalDecision({ before, command, authority });
      if (preflight.predicatesFailed.some(p => p.rule === "TOB-23/54/56")) throw new Error("wilds_social_organizer_forbidden");
      const priorReceipt = before.constitutionalCommandReceipts?.[command.commandId];
      if (priorReceipt && (priorReceipt.digest !== constitutionalDigest(command) || priorReceipt.actorId !== authority.actorId)) throw new Error("wilds_constitution_command_conflict");
      this.constitutionalCommand = { digest: constitutionalDigest(command), type: command.type };
      const result = priorReceipt ? { events: [], projection: before } : this.executeUnderSourceLaw(command, authority);
      const constitution = worldConstitutionalDecision({ before, command, authority, after: result.projection, events: result.events });
      if (constitution.result !== "VALID") throw new WildsConstitutionalError("wilds_constitution_authority_unproven", constitution);
      return { ...result, constitution };
    } catch (cause) {
      // A failed late predicate cannot leave a partially accepted story or economic transition.
      this.projection = before;
      this.eventTail = previousTail;
      if (cause instanceof WildsConstitutionalError) throw cause;
      const message = cause instanceof Error ? cause.message : "wilds_constitution_transition_unresolved";
      throw new WildsConstitutionalError(message, worldConstitutionalDecision({ before, command, authority, failure: message }));
    } finally { this.constitutionalCommand = null; }
  }

  private executeUnderSourceLaw(command: WildsWorldCommand, authority: WildsWorldAuthority) {
    if (!authority.canonical) throw new Error("wilds_world_canonical_authority_required");
    if (!commandIdValid(command.commandId)) throw new Error("wilds_world_command_id_invalid");
    const commandDigest = constructionProofDigest(command);
    const receipt = this.projection.constructionCommandReceipts[command.commandId];
    if (receipt) {
      if (receipt.commandDigest !== commandDigest || receipt.actorId !== authority.actorId) throw new Error("wilds_construction_command_conflict");
      return { events: [], projection: this.projection };
    }
    if (this.eventTail.some((event) => event.causeId === command.commandId)) {
      if (command.type.startsWith("construction.component.") || command.type === "construction.project.create") throw new Error("wilds_construction_command_conflict");
      return { events: [], projection: this.projection };
    }
    const commandKai = command.kai ? verifyWildsWorldCommandKai(command) : null;
    const kaiOccurredAt = commandKai ? kaiUPulseToISOString(commandKai.uPulse) : null;
    authority = {
      ...authority,
      ...(commandKai ? { uPulse: commandKai.uPulse, pulse: kaiOccurredAt!, occurredAt: kaiOccurredAt! } : {}),
      card: verifyWildsWorldCommandCard({ command, card: authority.card })
    };
    const events: WildsWorldEvent[] = [];
    const storyCommand = command.type === "story.contribute"
      || command.type === "story.trainer_battle"
      || command.type === "story.tournament_enter";
    if (storyCommand) {
      const { saga } = this.sagaAt(authority);
      if ((command.type === "story.contribute" || command.type === "story.trainer_battle") && command.dayId !== saga.dayId) {
        throw new Error("wilds_story_chapter_mismatch");
      }
      this.advanceSaga({ occurredAt: authority.occurredAt }, authority, command.commandId, events);
    }

    const kaiUPulse = authorityMoment(authority).uPulse;
    if (command.type === "construction.project.create") {
      const project = createWildsConstructionProject({ ownerReceizId: authority.actorId, name: command.name, region: command.region, commandId: command.commandId, kaiUPulse });
      events.push(this.append("construction.project_created", { project, commandDigest }, authority, command.commandId));
    } else if (command.type === "construction.component.place") {
      const project = this.projection.constructionProjects[command.projectId];
      if (!project || !canWildsConstructionProject(project, authority.actorId, "plan")) throw new Error("wilds_construction_access_denied");
      requireConstructionReach(command.actorPosition, command.placement.transform.position);
      const evidence = projectWildsProductionPlacementEvidence(this.projection, command.projectId, command.request);
      const component = createWildsConstructionComponent({ project, placement: command.placement, evidence, ownerReceizId: authority.actorId, commandId: command.commandId, kaiUPulse });
      let page = project.firstChunkId ? this.projection.constructionChunks[project.firstChunkId] : createWildsConstructionChunk({ project, kaiUPulse });
      const visited = new Set<string>();
      while (page?.nextChunkId) {
        if (visited.has(page.chunkId)) throw new Error("wilds_construction_chunk_cycle");
        visited.add(page.chunkId);
        page = this.projection.constructionChunks[page.nextChunkId];
      }
      if (!page) throw new Error("wilds_construction_chunk_missing");
      const appended = appendWildsConstructionChunkReference({ chunk: page, component, kaiUPulse });
      const successor = project.firstChunkId ? project : appendWildsConstructionProjectChunk({ project, chunk: appended.chunk, kaiUPulse });
      events.push(this.append("construction.component_placed", { component, ...appended, project: successor, commandDigest }, authority, command.commandId));
    } else if (command.type === "construction.burrow.dig") {
      if(!authority.card)throw new Error("wilds_world_verified_card_required");
      const burrow=createWildsBurrow({burrows:this.projection.burrows??{},request:command.request,ownerReceizId:authority.actorId,creature:authority.card,commandId:command.commandId,kaiUPulse:authorityMoment(authority).uPulse,actorPosition:command.actorPosition});
      events.push(this.append("construction.burrow_dug",{burrow,actorPosition:command.actorPosition,commandDigest},authority,command.commandId));
    } else if (command.type === "construction.component.adjust") {
      const previous = this.projection.constructionComponents[command.componentId];
      if (!previous || previous.head !== command.componentHead) throw new Error("wilds_construction_component_stale");
      const project = this.projection.constructionProjects[previous.projectId];
      if (!project || previous.ownerReceizId !== authority.actorId || !canWildsConstructionProject(project, authority.actorId, "renovate")) throw new Error("wilds_construction_access_denied");
      requireConstructionReach(command.actorPosition, previous.transform.position);
      requireConstructionReach(command.actorPosition, command.placement.transform.position);
      const preview = previewWildsConstructionAdjustment(this.projection, previous.componentId, command.request);
      if (preview.blocker || constructionProofDigest(preview.placement) !== constructionProofDigest(command.placement)) throw new Error("wilds_construction_adjustment_conflict");
      const component = adjustWildsConstructionComponent({component: previous, placement: command.placement, evidence: preview.evidence, commandId: command.commandId, kaiUPulse});
      const page = Object.values(this.projection.constructionChunks).find(chunk => chunk.projectId === previous.projectId && chunk.references.some(ref => ref.componentId === previous.componentId && ref.componentHead === previous.head));
      if (!page) throw new Error("wilds_construction_chunk_missing");
      const chunk = reviseWildsConstructionChunkReference(page, previous, component, kaiUPulse);
      events.push(this.append("construction.component_adjusted", {component, chunk, request: command.request, actorPosition: command.actorPosition, commandDigest}, authority, command.commandId));
    } else if (command.type === "construction.component.deposit" || command.type === "construction.component.work") {
      const component = this.projection.constructionComponents[command.componentId];
      if (!component || component.head !== command.componentHead) throw new Error("wilds_construction_component_stale");
      requireConstructionReach(command.actorPosition, component.transform.position);
      const project = this.projection.constructionProjects[component.projectId];
      if (!project || !canWildsConstructionProject(project, authority.actorId, command.type === "construction.component.deposit" ? "contribute" : "work")) throw new Error("wilds_construction_access_denied");
      if (command.type === "construction.component.deposit") {
        if (!command.lotIds.length || command.lotIds.length > 64 || new Set(command.lotIds).size !== command.lotIds.length) throw new Error("wilds_construction_lots_invalid");
        const contributions = command.lotIds.map((lotId) => {
          const lot = this.projection.materialLots[lotId];
          if (!lot || wildsMaterialCustodian(this.projection, lot) !== authority.actorId || this.projection.consumedMaterialLots[lotId] || this.projection.storedMaterialLots[lotId] || this.projection.reservedMaterialLots[lotId]) throw new Error("wilds_construction_lot_unavailable");
          return createWildsMaterialContribution({ component, lot, custodianReceizId: authority.actorId, contributorReceizId: authority.actorId, commandId: command.commandId, kaiUPulse });
        });
        const materials = Object.values(this.projection.constructionMaterialContributions);
        const work = Object.values(this.projection.constructionWorkContributions);
        const previouslyUnused = new Set(projectWildsConstructionProgress(component, materials, work).unusedLotIds);
        const nextProgress = projectWildsConstructionProgress(component, [...materials, ...contributions], work);
        // Reject both surplus new lots and new allocations that strand an earlier
        // reservation. Existing historical surplus remains valid replay evidence.
        if (nextProgress.unusedLotIds.some(lotId => !previouslyUnused.has(lotId))) {
          throw new Error("wilds_construction_lots_exceed_remaining");
        }
        events.push(this.append("construction.material_contributed", { contributions, commandDigest }, authority, command.commandId));
      } else {
        if (command.creature) throw new Error("wilds_construction_creature_authority_required");
        const contribution = createWildsWorkContribution({ component, materials: Object.values(this.projection.constructionMaterialContributions), work: Object.values(this.projection.constructionWorkContributions), worker: { kind: "player", receizId: authority.actorId }, amount: 1, commandId: command.commandId, kaiUPulse });
        const settlement = settleWildsConstructionWork({ component, contribution, currentEmission: wildsWorldSourceEmission(this.projection) });
        events.push(this.append("construction.work_contributed", { contribution, commandDigest, ...settlement }, authority, command.commandId));
      }
    } else if (command.type === "grove.observe") {
      events.push(this.append("grove.discovered", { grove: command.grove, emission: command.emission }, authority, command.commandId));
    } else if (command.type === "grove.act") {
      const harvest = command.operation.intention.kind === "grove.harvest-honey";
      if (harvest && !command.resourceLot) throw new Error("wilds_world_grove_resource_lot_required");
      if (!harvest && command.resourceLot) throw new Error("wilds_world_grove_resource_lot_invalid");
      events.push(this.append("grove.operation_admitted", {
        operation: command.operation,
        grove: command.grove,
        emission: command.emission,
        amountPhiMicro: command.amountPhiMicro,
        resourceLot: command.resourceLot ?? null
      }, authority, command.commandId));
    } else if (command.type === "resource.transfer.admit") {
      events.push(this.append("resource.custody_transferred", {
        lotId: command.lotId,
        ownerReceizId: command.ownerReceizId,
        subjectId: command.subjectId,
        subjectHead: command.subjectHead,
        receiptId: command.receiptId,
        transferId: command.transferId
      }, authority, command.commandId));
    } else if (command.type === "resource.material.transfer.admit") {
      events.push(this.append("resource.material_custody_transferred", {
        lotId: command.lotId,
        ownerReceizId: command.ownerReceizId,
        subjectId: command.subjectId,
        subjectHead: command.subjectHead,
        receiptId: command.receiptId,
        transferId: command.transferId
      }, authority, command.commandId));
    } else if (command.type === "resource.material.harvest") {
      const creatureHead = authority.card ? sha256PortableBasis(authority.card.proof.digest) : undefined;
      const creatureSubjectId = authority.card ? `creature:${sha256PortableBasis(authority.card.id).slice(0, 32)}` : undefined;
      if (authority.card) {
        if (!command.mandate || !creatureHead || !creatureSubjectId) throw new Error("wilds_world_resource_mandate_invalid");
        const mandate = reverifyWildsCreatureMandate(command.mandate, { creatureHead, kaiUPulse: authorityMoment(authority).uPulse, revokedMandateIds: [] });
        if (!mandate.ok || command.mandate.creatureSubjectId !== creatureSubjectId
          || !command.mandate.professions.includes(command.source.requirements.creature)
          || !command.mandate.allowedResourceIds.includes(command.source.sourceId)) throw new Error("wilds_world_resource_mandate_invalid");
      } else if (command.mandate || command.cardProofDigest) {
        throw new Error("wilds_world_resource_mandate_invalid");
      }
      const element = authority.card ? creatureForm(authority.card.manifest.formId)?.element ?? "" : "";
      const current = this.projection.harvestedSources[command.source.sourceId] ?? initialWildsHarvestedSourceState(command.source);
      if (current.head !== command.sourceHead) throw new Error("wilds_world_resource_source_stale");
      const equippedToolId = this.projection.equippedStewardTools[authority.actorId];
      const tool = command.toolId ? this.projection.stewardTools[command.toolId] : null;
      if (command.toolId && (equippedToolId !== command.toolId || !tool || tool.ownerReceizId !== authority.actorId)) throw new Error("wilds_world_material_tool_invalid");
      const harvest = createWildsMaterialHarvest({
        source: command.source,
        current,
        ownerReceizId: authority.actorId,
        actorPosition: command.actorPosition,
        creature: creatureSubjectId && creatureHead ? { subjectId: creatureSubjectId, head: creatureHead, workFamilies: projectWildsCreatureWorkFamilies(element), willing: true } : undefined,
        tool,
        kaiUPulse: authorityMoment(authority).uPulse
      });
      const operation = createWildsStewardHarvestOperation({
        source: command.source,
        currentSource: current,
        harvestedSource: harvest.source,
        lot: harvest.lot,
        ownerReceizId: authority.actorId,
        playerHead: sha256PortableBasis(authority.actorId),
        ...(creatureSubjectId && creatureHead ? { creatureSubjectId, creatureHead } : {}),
        tool,
        nextTool: harvest.tool,
        kaiUPulse: authorityMoment(authority).uPulse
      });
      const currentEmission = wildsWorldSourceEmission(this.projection);
      const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
      if (!command.operation || canonicalPortableCardJson(command.operation) !== canonicalPortableCardJson(operation)) throw new Error("wilds_world_steward_operation_mismatch");
      const economy = preview.eligible && preview.amountPhiMicro !== "0"
        ? (() => {
            const emission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
            const phiAward = createWildsStewardPhiAward({ ownerReceizId: authority.actorId, operation, currentEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
            if (!command.emission || !command.amountPhiMicro || !command.phiAward
              || canonicalPortableCardJson(command.emission) !== canonicalPortableCardJson(emission)
              || command.amountPhiMicro !== preview.amountPhiMicro
              || canonicalPortableCardJson(command.phiAward) !== canonicalPortableCardJson(phiAward)) throw new Error("wilds_world_steward_economy_mismatch");
            return { emission, amountPhiMicro: preview.amountPhiMicro, phiAward };
          })()
        : (() => {
            if (command.emission || command.amountPhiMicro || command.phiAward) throw new Error("wilds_world_steward_economy_mismatch");
            return null;
          })();
      events.push(this.append("resource.material_harvested", {
        source: command.source,
        sourceState: harvest.source,
        lot: harvest.lot,
        tool: harvest.tool,
        operation,
        ...(economy ?? {})
      }, authority, command.commandId));
    } else if (command.type === "construction.site.place") {
      if (!Array.isArray(command.lotIds) || new Set(command.lotIds).size !== command.lotIds.length) throw new Error("wilds_construction_material_invalid");
      const lots = command.lotIds.map((lotId) => this.projection.materialLots[lotId]).filter(Boolean);
      const required = command.blueprint === "trail-shelter" ? { timber: 2, stone: 1 } : { timber: 4, stone: 2 };
      if (lots.length !== command.lotIds.length || lots.length !== required.timber + required.stone
        || lots.filter((lot) => lot.kind === "timber").length !== required.timber
        || lots.filter((lot) => lot.kind === "stone").length !== required.stone
        || lots.some((lot) => wildsMaterialCustodian(this.projection, lot) !== authority.actorId)
        || command.lotIds.some((lotId) => this.projection.consumedMaterialLots[lotId] || this.projection.storedMaterialLots[lotId] || this.projection.reservedMaterialLots[lotId])) {
        throw new Error("wilds_construction_material_invalid");
      }
      const site = createWildsConstructionSite({
        blueprint: command.blueprint,
        placedByReceizId: authority.actorId,
        actorPosition: command.actorPosition,
        position: command.position,
        rotationQuarterTurns: command.rotationQuarterTurns,
        existingStructures: Object.values(this.projection.structures),
        existingSites: Object.values(this.projection.constructionSites),
        kaiUPulse: authorityMoment(authority).uPulse
      });
      const fundedSite = contributeWildsConstructionSite({
        site,
        expectedSiteHead: site.head,
        contributorReceizId: authority.actorId,
        lots,
        lotCustodians: Object.fromEntries(lots.map((lot) => [lot.lotId, wildsMaterialCustodian(this.projection, lot)])),
        kaiUPulse: authorityMoment(authority).uPulse
      });
      events.push(this.append("construction.site_placed", { site }, authority, command.commandId));
      events.push(this.append("construction.site_contributed", { site: fundedSite }, authority, command.commandId));
    } else if (command.type === "construction.site.contribute") {
      const currentSite = this.projection.constructionSites[command.siteId];
      if (!currentSite || currentSite.head !== command.siteHead) throw new Error("wilds_construction_site_stale");
      if (!Number.isFinite(command.actorPosition.x) || !Number.isFinite(command.actorPosition.z) || Math.hypot(command.actorPosition.x - currentSite.position.x, command.actorPosition.z - currentSite.position.z) > 6) throw new Error("wilds_construction_site_unreachable");
      if (new Set(command.lotIds).size !== command.lotIds.length) throw new Error("wilds_construction_material_invalid");
      const lots = command.lotIds.map((lotId) => this.projection.materialLots[lotId]).filter(Boolean);
      if (lots.length !== command.lotIds.length || lots.some((lot) => wildsMaterialCustodian(this.projection, lot) !== authority.actorId)
        || command.lotIds.some((lotId) => this.projection.consumedMaterialLots[lotId] || this.projection.storedMaterialLots[lotId] || this.projection.reservedMaterialLots[lotId])) {
        throw new Error("wilds_construction_material_invalid");
      }
      const site = contributeWildsConstructionSite({ site: currentSite, expectedSiteHead: command.siteHead, contributorReceizId: authority.actorId, lots,
        lotCustodians: Object.fromEntries(lots.map((lot) => [lot.lotId, wildsMaterialCustodian(this.projection, lot)])), kaiUPulse: authorityMoment(authority).uPulse });
      events.push(this.append("construction.site_contributed", { site }, authority, command.commandId));
    } else if (command.type === "construction.site.work") {
      if (command.mandate && !authority.card) throw new Error("wilds_world_verified_card_required");
      const currentSite = this.projection.constructionSites[command.siteId];
      if (!currentSite || currentSite.head !== command.siteHead) throw new Error("wilds_construction_site_stale");
      if (!Number.isFinite(command.actorPosition.x) || !Number.isFinite(command.actorPosition.z) || Math.hypot(command.actorPosition.x - currentSite.position.x, command.actorPosition.z - currentSite.position.z) > 6) throw new Error("wilds_construction_site_unreachable");
      const creatureHead = authority.card ? sha256PortableBasis(authority.card.proof.digest) : "";
      const creatureSubjectId = authority.card ? `creature:${sha256PortableBasis(authority.card.id).slice(0, 32)}` : "";
      if (command.mandate) {
        const mandate = reverifyWildsCreatureMandate(command.mandate, { creatureHead, kaiUPulse: authorityMoment(authority).uPulse, revokedMandateIds: [] });
        if (!mandate.ok || command.mandate.creatureSubjectId !== creatureSubjectId || !command.mandate.professions.includes("build")) throw new Error("wilds_world_structure_mandate_invalid");
        const expectedRegion = { x: Math.floor(currentSite.position.x / 128), z: Math.floor(currentSite.position.z / 128) };
        if (command.mandate.region.x !== expectedRegion.x || command.mandate.region.z !== expectedRegion.z) throw new Error("wilds_world_structure_mandate_region_invalid");
      }
      const lots = currentSite.contributedLots.map((entry) => this.projection.materialLots[entry.lotId]).filter(Boolean);
      if (lots.length !== currentSite.contributedLots.length || currentSite.contributedLots.some((entry) => this.projection.reservedMaterialLots[entry.lotId] !== currentSite.siteId)) {
        throw new Error("wilds_construction_material_lineage_invalid");
      }
      const completed = completeWildsConstructionSite({ site: currentSite, expectedSiteHead: command.siteHead, lots, workerReceizId: authority.actorId,
        ...(command.mandate ? { creature: { subjectId: creatureSubjectId, head: creatureHead } } : {}), existingStructures: Object.values(this.projection.structures), kaiUPulse: authorityMoment(authority).uPulse });
      const operation = createWildsStewardStructureOperation({ structure: completed.structure, lots, ownerReceizId: completed.structure.ownerReceizId,
        actorReceizId: authority.actorId, playerHead: sha256PortableBasis(authority.actorId) });
      const currentEmission = wildsWorldSourceEmission(this.projection);
      const settlement = settleWildsBuild({ operation, currentEmission, actorId: authority.actorId });
      verifyWildsBuildSettlement(command, settlement);
      events.push(this.append("construction.site_worked", { site: completed.site, structure: completed.structure, ...settlement }, authority, command.commandId));
    } else if (command.type === "structure.trail-shelter.build" || command.type === "structure.trail-bridge.build"
      || command.type === "structure.steward-workbench.build" || command.type === "structure.trail-cache.build") {
      if (command.mandate && !authority.card) throw new Error("wilds_world_verified_card_required");
      const creatureHead = authority.card ? sha256PortableBasis(authority.card.proof.digest) : "";
      const creatureSubjectId = authority.card ? `creature:${sha256PortableBasis(authority.card.id).slice(0, 32)}` : "";
      const builder = command.mandate ? { creatureSubjectId, creatureHead } : playerStewardBuilder(authority.actorId);
      if (command.mandate) {
        const mandate = reverifyWildsCreatureMandate(command.mandate, { creatureHead, kaiUPulse: authorityMoment(authority).uPulse, revokedMandateIds: [] });
        if (!mandate.ok || command.mandate.creatureSubjectId !== creatureSubjectId || !command.mandate.professions.includes("build")) {
          throw new Error("wilds_world_structure_mandate_invalid");
        }
        const expectedRegion = { x: Math.floor(command.position.x / 128), z: Math.floor(command.position.z / 128) };
        if (command.mandate.region.x !== expectedRegion.x || command.mandate.region.z !== expectedRegion.z) {
          throw new Error("wilds_world_structure_mandate_region_invalid");
        }
      }
      if (!Number.isFinite(command.actorPosition.x) || !Number.isFinite(command.actorPosition.z)
        || Math.hypot(command.actorPosition.x - command.position.x, command.actorPosition.z - command.position.z) > 7) throw new Error("wilds_world_structure_unreachable");
      const lots = command.lotIds.map((lotId) => this.projection.materialLots[lotId]).filter((lot) => Boolean(lot));
      if (lots.length !== command.lotIds.length || lots.some((lot) => wildsMaterialCustodian(this.projection, lot) !== authority.actorId)
        || command.lotIds.some((lotId) => this.projection.consumedMaterialLots[lotId] || this.projection.storedMaterialLots[lotId] || this.projection.reservedMaterialLots[lotId])) {
        throw new Error("wilds_world_structure_material_invalid");
      }
      const structure = command.type === "structure.trail-bridge.build"
        ? createWildsTrailBridge({
            ownerReceizId: authority.actorId,
            position: command.position,
            rotationQuarterTurns: command.rotationQuarterTurns,
            lots,
            builder,
            existingStructures: Object.values(this.projection.structures),
            materialContributorReceizIds: wildsMaterialContributorReceizIds(lots, authority.actorId),
            kaiUPulse: authorityMoment(authority).uPulse
          })
        : (() => {
            const terrain = sampleWildsTerrain(command.position.x, command.position.z);
            if (terrain.surface === "shallow-water" || terrain.surface === "deep-water") throw new Error("wilds_world_structure_water_invalid");
            const groundInput = {
              ownerReceizId: authority.actorId,
              position: { x: command.position.x, y: terrain.elevation, z: command.position.z },
              rotationQuarterTurns: command.rotationQuarterTurns,
              lots,
              builder,
              existingStructures: Object.values(this.projection.structures),
              materialContributorReceizIds: wildsMaterialContributorReceizIds(lots, authority.actorId),
              kaiUPulse: authorityMoment(authority).uPulse
            };
            return command.type === "structure.steward-workbench.build" ? createWildsWorkstation(groundInput)
              : command.type === "structure.trail-cache.build" ? createWildsTrailCache(groundInput)
                : createWildsTrailShelter(groundInput);
          })();
      const operation = createWildsStewardStructureOperation({
        structure,
        lots,
        ownerReceizId: authority.actorId,
        playerHead: sha256PortableBasis(authority.actorId)
      });
      const currentEmission = wildsWorldSourceEmission(this.projection);
      const settlement = settleWildsBuild({ operation, currentEmission, actorId: authority.actorId });
      verifyWildsBuildSettlement(command, settlement);
      events.push(this.append("structure.built", { structure, ...settlement }, authority, command.commandId));
    } else if (command.type === "tool.steward.craft") {
      if (command.mandate && !authority.card) throw new Error("wilds_world_verified_card_required");
      const workstation = resolveWildsCraftWorkstation(this.projection, command.workstationId);
      if (!workstation || workstation.ownerReceizId !== authority.actorId) throw new Error("wilds_world_tool_workstation_invalid");
      if (!Number.isFinite(command.actorPosition.x) || !Number.isFinite(command.actorPosition.z) || Math.hypot(command.actorPosition.x - workstation.position.x, command.actorPosition.z - workstation.position.z) > 6) throw new Error("wilds_world_tool_workstation_unreachable");
      const creatureHead = authority.card ? sha256PortableBasis(authority.card.proof.digest) : "";
      const creatureSubjectId = authority.card ? `creature:${sha256PortableBasis(authority.card.id).slice(0, 32)}` : "";
      const builder = command.mandate ? { creatureSubjectId, creatureHead } : playerStewardBuilder(authority.actorId);
      if (command.mandate) {
        const mandate = reverifyWildsCreatureMandate(command.mandate, { creatureHead, kaiUPulse: authorityMoment(authority).uPulse, revokedMandateIds: [] });
        if (!mandate.ok || command.mandate.creatureSubjectId !== creatureSubjectId || !command.mandate.professions.includes("craft")) throw new Error("wilds_world_tool_mandate_invalid");
      }
      const lots = command.lotIds.map((lotId) => this.projection.materialLots[lotId]).filter(Boolean);
      if (lots.length !== command.lotIds.length || lots.some((lot) => wildsMaterialCustodian(this.projection, lot) !== authority.actorId)
        || command.lotIds.some((lotId) => this.projection.consumedMaterialLots[lotId] || this.projection.storedMaterialLots[lotId] || this.projection.reservedMaterialLots[lotId])) throw new Error("wilds_world_tool_material_invalid");
      const tool = createWildsStewardTool({ kind: command.kind, ownerReceizId: authority.actorId, workstation, lots,
        materialContributorReceizIds: wildsMaterialContributorReceizIds(lots, authority.actorId),
        builder, kaiUPulse: authorityMoment(authority).uPulse });
      const operation = createWildsStewardToolOperation({ tool, lots, workstation, ownerReceizId: authority.actorId, playerHead: sha256PortableBasis(authority.actorId) });
      const currentEmission = wildsWorldSourceEmission(this.projection);
      const settlement = settleWildsBuild({ operation, currentEmission, actorId: authority.actorId });
      verifyWildsBuildSettlement(command, settlement);
      events.push(this.append("tool.crafted", { tool, ...settlement }, authority, command.commandId));
    } else if (command.type === "tool.steward.equip") {
      const tool = this.projection.stewardTools[command.toolId];
      if (!tool || tool.ownerReceizId !== authority.actorId) throw new Error("wilds_world_tool_equip_invalid");
      events.push(this.append("tool.equipped", { toolId: command.toolId }, authority, command.commandId));
    } else if (command.type === "storage.material.move") {
      const cache = resolveWildsMaterialCache(this.projection, command.cacheId);
      if (!cache || cache.ownerReceizId !== authority.actorId) throw new Error("wilds_world_storage_invalid");
      if (Math.hypot(command.actorPosition.x - cache.position.x, command.actorPosition.z - cache.position.z) > 6) throw new Error("wilds_world_storage_unreachable");
      events.push(this.append("storage.material_moved", { lotId: command.lotId, cacheId: command.cacheId, direction: command.direction }, authority, command.commandId));
    } else if (command.type === "story.contribute") {
      const { saga } = this.sagaAt(authority);
      const nodes = saga.chapter.missions.flatMap((mission) => mission.nodes);
      const node = nodes.find((candidate) => candidate.id === command.objectiveId);
      if (!node || !node.acceptedVerbs.includes(command.verb)) throw new Error("wilds_story_objective_invalid");
      const player = this.projection.players[authority.actorId];
      if (!node.prerequisites.every((prerequisite) => (player?.contributions[prerequisite] ?? 0) >= (nodes.find((candidate) => candidate.id === prerequisite)?.target ?? Number.POSITIVE_INFINITY))) {
        throw new Error("wilds_story_objective_locked");
      }
      const current = player?.contributions[node.id] ?? 0;
      if (!Number.isSafeInteger(command.amount) || command.amount < 1 || command.amount > node.target - current) throw new Error("wilds_story_contribution_invalid");
      events.push(this.append("story.objective_contributed", { dayId: command.dayId, objectiveId: command.objectiveId, playerId: authority.actorId, verb: command.verb, amount: command.amount }, authority, command.commandId));

      const updatedPlayer = this.projection.players[authority.actorId]!;
      const progressEvents = nodes.flatMap((candidate) => {
        const amount = updatedPlayer.contributions[candidate.id] ?? 0;
        const verb = candidate.acceptedVerbs.find((accepted) => saga.chapter.achievements.some((definition) => definition.acceptedVerbs.includes(accepted)));
        return amount > 0 && verb ? [{ eventId: `objective:${command.dayId}:${authority.actorId}:${candidate.id}`, playerId: authority.actorId, verb, amount }] : [];
      });
      const scopeInstanceIds = { day: saga.dayId, week: saga.weekId, month: saga.monthId, year: saga.yearId, lifetime: "saga:lifetime" };
      for (const grant of achievementGrantCandidates({ definitions: saga.chapter.achievements, playerId: authority.actorId, scopeInstanceIds, events: progressEvents, existingGrantIds: updatedPlayer.achievementGrantIds })) {
        events.push(this.append("story.achievement_granted", { grant }, authority, command.commandId));
      }
    } else if (command.type === "story.trainer_battle") {
      if (!authority.card) throw new Error("wilds_world_verified_card_required");
      const current = this.projection.trainers[command.trainerId] as WildsTrainerProjection & { battleMemories?: WildsTrainerBattleMemory[] } | undefined;
      if (!current) throw new Error("wilds_story_trainer_missing");
      const battleMemories = current.battleMemories ?? [];
      const existing = battleMemories.find((memory) => memory.settledEventId === command.matchId);
      if (existing) {
        if (existing.outcome !== command.outcome || existing.playerId !== authority.actorId) throw new Error("wilds_story_trainer_battle_divergent");
        return { events: [], projection: this.projection };
      }
      const memory: WildsTrainerBattleMemory = { trainerId: command.trainerId, playerId: authority.actorId, outcome: command.outcome, settledEventId: command.matchId, settledAt: authority.occurredAt };
      const trainer = { ...current, battleMemories: [...battleMemories, memory].slice(-128), settledMatchId: command.matchId, lastOutcome: command.outcome };
      const xpAward = command.outcome === "player_victory" ? 50 : command.outcome === "trainer_victory" ? 15 : 0;
      events.push(this.append("story.trainer_battle_settled", { trainer, playerId: authority.actorId, outcome: command.outcome, xpAward }, authority, command.commandId));
    } else if (command.type === "story.tournament_enter") {
      if (!authority.card) throw new Error("wilds_world_verified_card_required");
      const current = this.projection.tournaments[command.tournamentId] as WildsTournamentProjection & { enteredPlayerIds?: string[] } | undefined;
      const player = this.projection.players[authority.actorId];
      const grant = player?.achievementGrants[command.qualificationGrantId];
      if (!current || current.phase === "settled") throw new Error("wilds_story_tournament_inactive");
      if (!grant || grant.playerId !== authority.actorId || grant.definitionId !== this.sagaAt(authority).saga.chapter.tournament.qualificationAchievementId) throw new Error("wilds_story_tournament_qualification_required");
      const enteredPlayerIds = current.enteredPlayerIds?.includes(authority.actorId) ? current.enteredPlayerIds : [...(current.enteredPlayerIds ?? []), authority.actorId];
      events.push(this.append("story.tournament_entered", { tournament: { ...current, enteredPlayerIds } }, authority, command.commandId));
    } else if (command.type === "boss.track") {
      const boss = this.projection.bosses[command.bossId];
      if (!boss) throw new Error("wilds_world_boss_missing");
      const position = boss.position as { x: number; z: number } | undefined;
      const radius = Number(boss.territoryRadius ?? 18);
      if (!position || !positionNear(command.position, position, radius * 2)) throw new Error("wilds_boss_tracking_location_invalid");
      events.push(this.append("site.phase_changed", { siteId: boss.siteId, phase: "tracked", bossId: boss.id, playerId: authority.actorId }, authority, command.commandId));
    } else if (command.type === "raid.enter") {
      const boss = this.projection.bosses[command.bossId];
      const raid = this.projection.raids[command.roundId] as WildsRaidRound | undefined;
      if (!boss || !raid || raid.bossId !== boss.id) throw new Error("wilds_world_raid_missing");
      const position = boss.position as { x: number; z: number } | undefined;
      if (!position || !positionNear(command.position, position, Number(boss.territoryRadius ?? 18))) throw new Error("wilds_raid_location_invalid");
      const admitted = admitWildsRaidParticipant(raid, { playerId: authority.actorId, occurredAt: authority.occurredAt, eventOrdinal: this.projection.revision + 1, preferredSquad: command.preferredSquad });
      events.push(this.append("raid.entered", { raid: admitted.round, boss, playerId: authority.actorId, role: admitted.role, squad: admitted.squad }, authority, command.commandId));
    } else if (command.type === "raid.lease") {
      const boss = this.projection.bosses[command.bossId];
      const raid = this.projection.raids[command.roundId] as WildsRaidRound | undefined;
      if (!boss || !raid || raid.bossId !== boss.id) throw new Error("wilds_world_raid_missing");
      const nextRound = renewWildsRaidLease(raid, { playerId: authority.actorId, status: command.status, occurredAt: authority.occurredAt });
      events.push(this.append("raid.lease_changed", { raid: nextRound, boss, playerId: authority.actorId, status: command.status }, authority, command.commandId));
    } else if (command.type === "raid.retreat") {
      const boss = this.projection.bosses[command.bossId];
      const raid = this.projection.raids[command.roundId] as WildsRaidRound | undefined;
      if (!boss || !raid || raid.bossId !== boss.id) throw new Error("wilds_world_raid_missing");
      const nextRound = retreatWildsRaidParticipant(raid, { playerId: authority.actorId, occurredAt: authority.occurredAt });
      events.push(this.append("raid.retreated", { raid: nextRound, boss, playerId: authority.actorId }, authority, command.commandId));
    } else if (command.type === "raid.act") {
      if (!authority.card) throw new Error("wilds_world_verified_card_required");
      const boss = this.projection.bosses[command.bossId] as unknown as WildsBossDefinition | undefined;
      const raid = this.projection.raids[command.roundId] as WildsRaidRound & { encounter?: ReturnType<typeof createWildsRaidEncounter> } | undefined;
      if (!boss || !raid || raid.bossId !== boss.id) throw new Error("wilds_world_raid_missing");
      if (!raid.squads.flat().includes(authority.actorId) && !raid.supportPlayerIds.includes(authority.actorId)) throw new Error("wilds_raid_player_not_admitted");
      const encounter = raid.encounter ?? createWildsRaidEncounter({ boss, roundId: raid.id, openedAt: raid.openedAt });
      const nextEncounter = applyWildsRaidIntent(encounter, { type: command.intent, commandId: command.commandId }, {
        actorId: authority.actorId, card: authority.card, eventOrdinal: this.projection.revision + 1, occurredAt: authority.occurredAt
      });
      const nextBoss = { ...boss, health: nextEncounter.bossHealth, phase: nextEncounter.phase === "active" ? "contested" : nextEncounter.phase } as WildsBossDefinition;
      const nextRound = nextEncounter.phase === "defeated"
        ? { ...settleWildsRaidRound(raid, { occurredAt: authority.occurredAt, winningEventId: command.commandId }), encounter: nextEncounter }
        : { ...raid, phase: nextEncounter.phase === "transforming" ? "transformation_lock" as const : "active" as const, encounter: nextEncounter };
      const acceptedAction = nextEncounter.actions.at(-1);
      events.push(this.append("raid.acted", { raid: nextRound, boss: nextBoss, playerId: authority.actorId, acceptedAction: acceptedAction ? { ...acceptedAction } : null }, authority, command.commandId));
      if (nextEncounter.phase === "defeated") {
        events.push(this.append("boss.defeated", { bossId: boss.id, defeatedAt: authority.occurredAt, winningCommandId: command.commandId }, authority, command.commandId));
      }
    } else if (command.type === "ecology.discover") {
      const site = this.projection.ecologySites[command.siteId];
      if (!site || site.phase !== "foreshadowed") throw new Error("wilds_ecology_discovery_phase_invalid");
      if (!positionNear(command.position, site.position, site.radius)) throw new Error("wilds_ecology_location_invalid");
      const discovered: WildsWorldEcologyProjection = {
        ...site,
        phase: "discovered",
        discoveredAt: authority.occurredAt,
        discoveredBy: authority.actorId
      };
      events.push(this.append("ecology.discovered", { site: discovered, playerId: authority.actorId }, authority, command.commandId));
    } else if (command.type === "ecology.contribute") {
      if (!/^sha256:[a-f0-9]{64}$/.test(command.cardProofDigest)) throw new Error("wilds_world_card_proof_invalid");
      if (!Number.isSafeInteger(command.amount) || command.amount < 1 || command.amount > 10) throw new Error("wilds_ecology_contribution_invalid");
      let site = this.projection.ecologySites[command.siteId];
      if (!site || (site.phase !== "discovered" && site.phase !== "active")) throw new Error("wilds_ecology_contribution_phase_invalid");
      if (!positionNear(command.position, site.position, site.radius)) throw new Error("wilds_ecology_location_invalid");
      if (site.phase === "discovered") {
        events.push(this.append("ecology.phase_changed", { siteId: site.id, phase: "active" }, authority, command.commandId));
        site = this.projection.ecologySites[site.id]!;
      }
      const contributed: WildsWorldEcologyProjection = {
        ...site,
        contributionTotal: Math.min(10, site.contributionTotal + command.amount),
        participantIds: site.participantIds.includes(authority.actorId) ? site.participantIds : [...site.participantIds, authority.actorId].slice(-128)
      };
      events.push(this.append("ecology.contributed", { site: contributed, playerId: authority.actorId, amount: command.amount, cardProofDigest: command.cardProofDigest }, authority, command.commandId));
      if (contributed.contributionTotal >= 10) {
        events.push(this.append("ecology.phase_changed", { siteId: site.id, phase: "resolving" }, authority, command.commandId));
        const resolved: WildsWorldEcologyProjection = { ...contributed, phase: "aftermath", resolvedAt: authority.occurredAt };
        events.push(this.append("ecology.resolved", { site: resolved }, authority, command.commandId));
      }
    } else if (command.type === "raid.join") {
      const raid = Object.values(this.projection.raids).find((item) => item.bossId === command.bossId) as WildsRaid | undefined;
      if (!raid) throw new Error("wilds_world_raid_missing");
      const admitted = admitRaidPlayer(raid, authority.actorId, command.preferredSquad);
      events.push(this.append("raid.joined", { raid: admitted.raid, playerId: authority.actorId, role: admitted.role, squad: admitted.squad }, authority, command.commandId));
    } else if (command.type === "raid.contribute") {
      if (!/^sha256:[a-f0-9]{64}$/.test(command.cardProofDigest)) throw new Error("wilds_world_card_proof_invalid");
      const raid = Object.values(this.projection.raids).find((item) => item.bossId === command.bossId) as WildsRaid | undefined;
      const boss = this.projection.bosses[command.bossId] as WildsBoss | undefined;
      if (!raid || !boss) throw new Error("wilds_world_raid_missing");
      const contributionId = `contribution:${command.commandId}`;
      const result = applyRaidContribution({ ...command, raid, boss, playerId: authority.actorId, eventId: contributionId, occurredAt: authority.occurredAt });
      events.push(this.append("raid.contributed", { raid: result.raid, boss: result.boss, playerId: authority.actorId, cardProofDigest: command.cardProofDigest }, authority, command.commandId));
      const team = Object.values(this.projection.teams).find((item) => item.memberIds.includes(authority.actorId));
      if (team) {
        const league = scoreWildsLeague({ league: this.projection.league, teamId: team.id, eventId: contributionId, raidContribution: command.damage + command.support });
        events.push(this.append("league.scored", { league, teamId: team.id, contributionId }, authority, command.commandId));
      }
      if (result.defeated) {
        events.push(this.append("boss.defeated", { bossId: boss.id, defeatedAt: result.boss.defeatedAt }, authority, command.commandId));
        events.push(this.append("site.phase_changed", { siteId: boss.siteId, phase: "defeated" }, authority, command.commandId));
        events.push(this.append("site.memorialized", { siteId: boss.siteId, bossId: boss.id }, authority, command.commandId));
      }
    } else if (command.type === "team.create") {
      if (Object.values(this.projection.teams).some((team) => team.memberIds.includes(authority.actorId))) throw new Error("wilds_team_membership_exists");
      const team = createWildsTeam({ captainId: authority.actorId, name: command.name, occurredAt: authority.occurredAt, existingTeams: Object.values(this.projection.teams) });
      events.push(this.append("team.created", { team }, authority, command.commandId));
    } else if (command.type === "team.join") {
      if (Object.values(this.projection.teams).some((team) => team.memberIds.includes(authority.actorId))) throw new Error("wilds_team_membership_exists");
      const team = this.projection.teams[command.teamId];
      if (!team) throw new Error("wilds_team_missing");
      events.push(this.append("team.joined", { team: joinWildsTeam(team, authority.actorId) }, authority, command.commandId));
    } else if (command.type === "team.invite" || command.type === "team.invite.accept" || command.type === "team.role" || command.type === "team.role.change" || command.type === "team.event.schedule" || command.type === "team.squad.assemble") {
      const current = this.projection.teams[command.teamId];
      if (!current) throw new Error("wilds_team_missing");
      const social = socialTeam(current);
      let next: WildsSocialTeam;
      let kind: WildsWorldEventKind;
      if (command.type === "team.invite") {
        const result = inviteWildsPlayer({ team: social, inviterId: authority.actorId, inviteeId: command.inviteeId, occurredAt: authority.occurredAt, expiresAt: command.expiresAt, inviteeAccountAgeDays: command.inviteeAccountAgeDays }); next = result.team; kind = "team.invited";
      } else if (command.type === "team.invite.accept") {
        next = acceptWildsInvite({ team: social, inviteId: command.inviteId, playerId: authority.actorId, occurredAt: authority.occurredAt }).team; kind = "team.invite_accepted";
      } else if (command.type === "team.role" || command.type === "team.role.change") {
        next = changeWildsRole({ team: social, actorId: authority.actorId, playerId: command.playerId, role: command.role }).team; kind = "team.role_changed";
      } else if (command.type === "team.event.schedule") {
        next = scheduleWildsTeamEvent({ team: social, organizerId: authority.actorId, startsAt: command.startsAt, endsAt: command.endsAt, occurredAt: authority.occurredAt }).team; kind = "team.event_scheduled";
      } else {
        next = assembleWildsSquad({ team: social, eventId: command.eventId, playerIds: command.playerIds }).team; kind = "team.squad_assembled";
      }
      events.push(this.append(kind, { team: projectionTeam(next, current) }, authority, command.commandId));
    } else if (command.type === "social.report") {
      const report = reportWildsAbuse({ reporterId: authority.actorId, subjectId: command.subjectId, reason: command.reason, occurredAt: authority.occurredAt, existingReportIds: Object.keys(this.projection.constitutionalClaims ?? {}) });
      events.push(this.append("social.abuse_reported", { report }, authority, command.commandId));
    }
    return { events, projection: this.projection };
  }
}

function positionNear(left: { x: number; z: number }, right: { x: number; z: number }, radius: number) {
  return Number.isFinite(left.x) && Number.isFinite(left.z) && Math.hypot(left.x - right.x, left.z - right.z) <= radius;
}

function ecologyProjection(site: WildsEcologySite): WildsWorldEcologyProjection {
  return {
    ...site,
    discoveredAt: null,
    discoveredBy: null,
    contributionTotal: 0,
    participantIds: [],
    resolvedAt: null
  };
}

function socialTeam(team: import("./wilds-team-league").WildsTeam): WildsSocialTeam {
  const members = team.members ?? team.memberIds.map((playerId) => ({ playerId, role: playerId === team.captainId ? "captain" as const : "member" as const, joinedAt: team.createdAt }));
  return { id: team.id, name: team.name, captainId: team.captainId, members, invites: team.invites ?? [], events: team.events ?? [] };
}

function projectionTeam(team: WildsSocialTeam, previous: import("./wilds-team-league").WildsTeam) {
  return { ...previous, captainId: team.captainId, memberIds: team.members.map((member) => member.playerId), members: team.members, invites: team.invites, events: team.events };
}

function requireConstructionReach(actor: { x: number; z: number }, target: { x: number; z: number }) {
  if (![actor.x, actor.z, target.x, target.z].every(Number.isFinite) || Math.hypot(actor.x - target.x, actor.z - target.z) > 6) throw new Error("wilds_construction_unreachable");
}
