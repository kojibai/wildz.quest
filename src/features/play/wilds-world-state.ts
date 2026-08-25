import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import {
  compareWildsWorldEvents,
  wildsWorldEventSequence,
  wildsWorldEventUPulse,
  verifyWildsWorldEvent,
  WILDS_WORLD_ID,
  type CompatibleWildsWorldEvent
} from "./wilds-world-event";
import type { WildsEcologySite } from "./wilds-ecology";
import type { WildsChapterMemory } from "./wilds-saga-director";
import type { WildsReward } from "./wilds-saga-types";
import { verifyWildsRegenerativeGrove, type WildsRegenerativeGroveV1 } from "./wilds-regenerative-grove";
import { verifyWildsLivingOperationPlan, type WildsLivingOperationPlanV1 } from "./wilds-living-operation";
import { verifyWildsWorldEmissionProof, wildsEmissionRegionRemaining, type WildsWorldEmissionProofV1 } from "./wilds-world-emission";
import { verifyWildsResourceLot, type WildsResourceLotV1 } from "./wilds-resource-lot";
import { isCanonicalWildsResourceSource, type WildsResourceSource } from "./wilds-resource-authority";
import {
  initialWildsHarvestedSourceState,
  verifyWildsStewardPhiAward,
  verifyWildsStewardTool,
  verifyWildsHarvestedSourceState,
  verifyWildsMaterialLot,
  verifyWildsStructure,
  type WildsHarvestedSourceStateV1,
  type WildsMaterialLotV1,
  type WildsStewardPhiAwardV1,
  type WildsStewardToolV1,
  type WildsStructureV1
} from "./wilds-steward-construction";
import { verifyWildsConstructionSite, type WildsConstructionSiteV1 } from "./wilds-construction-site";
import { wildsWorldSourceEmission } from "./wilds-world-genesis";

export type WildsDynamicSitePhase = "rumored" | "tracked" | "emerged" | "assaulting" | "engaged" | "defeated" | "memorialized" | "expired";

export type WildsWorldSiteProjection = {
  id: string;
  familyId: string;
  name: string;
  position: { x: number; z: number };
  radius: number;
  phase: WildsDynamicSitePhase;
  spawnedAt: string;
  expiresAt: string;
  bossId: string | null;
  seedDigest: string;
};

export type WildsWorldEcologyProjection = WildsEcologySite & {
  discoveredAt: string | null;
  discoveredBy: string | null;
  contributionTotal: number;
  participantIds: string[];
  resolvedAt: string | null;
};

export type WildsWorldBossProjection = {
  id: string;
  siteId: string;
  phase: "rumored" | "tracked" | "emerged" | "contested" | "engaged" | "transforming" | "vulnerable" | "defeated" | "memorialized" | "withdrawn";
  health: number;
  maxHealth: number;
  defeatedAt: string | null;
  [key: string]: unknown;
};

export type WildsWorldRaidProjection = {
  id: string;
  bossId: string;
  phase: "forming" | "active" | "transformation_lock" | "resolving" | "settled" | "expired";
  [key: string]: unknown;
};

export type WildsWorldTeamProjection = {
  id: string;
  name: string;
  captainId: string;
  memberIds: string[];
  createdAt: string;
  members?: import("./wilds-social-core").WildsSocialMember[];
  invites?: import("./wilds-social-core").WildsSocialInvite[];
  events?: import("./wilds-social-core").WildsSocialEvent[];
};

export type WildsLeagueProjection = {
  seasonId: "v3-genesis";
  scores: Record<string, number>;
  standings: { teamId: string; score: number; rank: number }[];
  scoredEventIds: string[];
};

export type WildsStoryChapterProjection = {
  dayId: string;
  chapterId: string;
  frameworkVersion: "kai-saga.v1";
  openedAt: string;
  endsAt: string;
};

export type WildsAchievementGrantProjection = {
  grantId: string;
  playerId: string;
  definitionId: string;
  scopeInstanceId: string;
  reward: WildsReward;
};

export type WildsPlayerSagaState = {
  trainerXp: number;
  trainerLevel: number;
  reputation: Record<string, number>;
  contributions: Record<string, number>;
  achievementGrantIds: string[];
  rewardIds: string[];
  achievementGrants: Record<string, WildsAchievementGrantProjection>;
};

export type WildsStoryProjection = {
  activeChapter: WildsStoryChapterProjection | null;
  objectiveTotals: Record<string, number>;
  memories: WildsChapterMemory[];
  settledDayIds: string[];
};

export type WildsTrainerWorldProjection = { id: string; [key: string]: unknown };
export type WildsTournamentWorldProjection = { id: string; phase?: string; [key: string]: unknown };

export type WildsWorldProjection = {
  schema: "receiz.wilds_world_projection.v3";
  worldId: typeof WILDS_WORLD_ID;
  revision: number;
  cursor: {
    pulse: string;
    kaiKlok: number;
    eventId: string;
    /** Present on current checkpoints; absent only on exact legacy V3 checkpoints. */
    uPulse?: number;
    /** Present on current checkpoints; kaiKlok is the legacy alias. */
    sequence?: number;
  } | null;
  sites: Record<string, WildsWorldSiteProjection>;
  ecologySites: Record<string, WildsWorldEcologyProjection>;
  ecologyHistory: string[];
  groves: Record<string, WildsRegenerativeGroveV1>;
  resourceLots: Record<string, WildsResourceLotV1>;
  resourceCustody: Record<string, Readonly<{ ownerReceizId: string; subjectId: string; subjectHead: string; receiptId: string; transferId: string }>>;
  harvestedSources: Record<string, WildsHarvestedSourceStateV1>;
  materialLots: Record<string, WildsMaterialLotV1>;
  consumedMaterialLots: Record<string, string>;
  structures: Record<string, WildsStructureV1>;
  constructionSites: Record<string, WildsConstructionSiteV1>;
  reservedMaterialLots: Record<string, string>;
  stewardTools: Record<string, WildsStewardToolV1>;
  equippedStewardTools: Record<string, string>;
  storedMaterialLots: Record<string, string>;
  stewardPhiAwards: Record<string, WildsStewardPhiAwardV1>;
  livingOperations: Record<string, WildsLivingOperationPlanV1>;
  worldEmission: WildsWorldEmissionProofV1 | null;
  contributionHistory: Readonly<{ operationId: string; amountPhiMicro: string; eventId: string }>[];
  bosses: Record<string, WildsWorldBossProjection>;
  raids: Record<string, WildsWorldRaidProjection>;
  teams: Record<string, WildsWorldTeamProjection>;
  league: WildsLeagueProjection;
  story: WildsStoryProjection;
  players: Record<string, WildsPlayerSagaState>;
  trainers: Record<string, WildsTrainerWorldProjection>;
  tournaments: Record<string, WildsTournamentWorldProjection>;
  defeatedBossIds: string[];
  recentEventIds: string[];
};

export type WildsWorldCheckpoint = {
  schema: "receiz.wilds_world_checkpoint.v3";
  worldId: typeof WILDS_WORLD_ID;
  revision: number;
  lastEventId: string | null;
  projectionDigest: string;
  projection: WildsWorldProjection;
};

export function initialWildsWorldProjection(): WildsWorldProjection {
  return {
    schema: "receiz.wilds_world_projection.v3",
    worldId: WILDS_WORLD_ID,
    revision: 0,
    cursor: null,
    sites: {},
    ecologySites: {},
    ecologyHistory: [],
    groves: {},
    resourceLots: {},
    resourceCustody: {},
    harvestedSources: {},
    materialLots: {},
    consumedMaterialLots: {},
    structures: {},
    constructionSites: {},
    reservedMaterialLots: {},
    stewardTools: {},
    equippedStewardTools: {},
    storedMaterialLots: {},
    stewardPhiAwards: {},
    livingOperations: {},
    worldEmission: null,
    contributionHistory: [],
    bosses: {},
    raids: {},
    teams: {},
    league: { seasonId: "v3-genesis", scores: {}, standings: [], scoredEventIds: [] },
    story: { activeChapter: null, objectiveTotals: {}, memories: [], settledDayIds: [] },
    players: {},
    trainers: {},
    tournaments: {},
    defeatedBossIds: [],
    recentEventIds: []
  };
}

function recordPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wilds_world_event_payload_invalid");
  return value as Record<string, unknown>;
}

function entity<T extends { id: string }>(value: unknown, label: string): T {
  const record = recordPayload(value);
  if (typeof record.id !== "string" || !record.id) throw new Error(`wilds_world_${label}_invalid`);
  return record as T;
}

function appendEvent(state: WildsWorldProjection, event: CompatibleWildsWorldEvent, patch: Partial<WildsWorldProjection>): WildsWorldProjection {
  return {
    ...state,
    ...patch,
    revision: state.revision + 1,
    cursor: {
      pulse: event.pulse,
      kaiKlok: event.kaiKlok,
      eventId: event.eventId,
      uPulse: wildsWorldEventUPulse(event),
      sequence: wildsWorldEventSequence(event)
    },
    recentEventIds: [...state.recentEventIds, event.eventId].slice(-512)
  };
}

function playerSagaState(state: WildsWorldProjection, playerId: string): WildsPlayerSagaState {
  return state.players[playerId] ?? {
    trainerXp: 0,
    trainerLevel: 1,
    reputation: {},
    contributions: {},
    achievementGrantIds: [],
    rewardIds: [],
    achievementGrants: {}
  };
}

function sagaIdentity(value: unknown, label: string) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9:._-]{2,179}$/i.test(value)) throw new Error(`wilds_story_${label}_invalid`);
  return value;
}

function sagaTime(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("wilds_story_time_invalid");
  return value;
}

export function wildsWorldCursorUPulse(cursor: NonNullable<WildsWorldProjection["cursor"]>) {
  return cursor.uPulse ?? deriveCursorUPulse(cursor.pulse);
}

function deriveCursorUPulse(pulse: string) {
  return wildsWorldEventUPulse({ pulse });
}

export function wildsWorldCursorSequence(cursor: NonNullable<WildsWorldProjection["cursor"]>) {
  return cursor.sequence ?? cursor.kaiKlok;
}

function cursorAsEvent(cursor: NonNullable<WildsWorldProjection["cursor"]>) {
  return {
    eventId: cursor.eventId,
    pulse: cursor.pulse,
    kaiKlok: cursor.kaiKlok,
    ...(cursor.uPulse === undefined ? {} : { uPulse: cursor.uPulse }),
    ...(cursor.sequence === undefined ? {} : { sequence: cursor.sequence })
  } as CompatibleWildsWorldEvent;
}

function stewardEconomyPatch(state: WildsWorldProjection, event: CompatibleWildsWorldEvent, payload: Record<string, unknown>) {
  const operation = recordPayload(payload.operation) as unknown as WildsLivingOperationPlanV1;
  const emission = recordPayload(payload.emission) as unknown as WildsWorldEmissionProofV1;
  const phiAward = recordPayload(payload.phiAward) as unknown as WildsStewardPhiAwardV1;
  const amountPhiMicro = String(payload.amountPhiMicro ?? "");
  const currentEmission = wildsWorldSourceEmission(state);
  if (!verifyWildsLivingOperationPlan(operation).ok || operation.category !== "construction"
    || !operation.participants.some((participant) => participant.kind === "player" && participant.id === event.actorId)
    || state.livingOperations[operation.operationId] || !verifyWildsWorldEmissionProof(emission)
    || emission.parentHead !== currentEmission.head || emission.revision !== currentEmission.revision + 1
    || canonicalPortableCardJson(emission.consumedOperationIds) !== canonicalPortableCardJson([...currentEmission.consumedOperationIds, operation.operationId].sort())
    || !verifyWildsStewardPhiAward(phiAward) || phiAward.ownerReceizId !== event.actorId
    || phiAward.operationId !== operation.operationId || phiAward.operationPlanDigest !== operation.planDigest
    || phiAward.sourceEmissionHead !== currentEmission.head || phiAward.admittedEmissionHead !== emission.head
    || phiAward.amountPhiMicro !== amountPhiMicro || state.stewardPhiAwards[phiAward.awardId]
    || !/^[1-9][0-9]{0,39}$/.test(amountPhiMicro)) throw new Error("wilds_world_steward_economy_invalid");
  const amount = BigInt(amountPhiMicro);
  const regionId = String(operation.intention.regionId ?? "");
  const globalDelta = BigInt(currentEmission.globalRemainingPhiMicro) - BigInt(emission.globalRemainingPhiMicro);
  const regionDelta = BigInt(wildsEmissionRegionRemaining(currentEmission, regionId)) - BigInt(wildsEmissionRegionRemaining(emission, regionId));
  const classDelta = BigInt(currentEmission.classRemainingPhiMicro.construction ?? "-1") - BigInt(emission.classRemainingPhiMicro.construction ?? "-1");
  if (globalDelta !== amount || regionDelta !== amount || classDelta !== amount) throw new Error("wilds_world_steward_emission_invalid");
  return {
    livingOperations: { ...state.livingOperations, [operation.operationId]: operation },
    worldEmission: emission,
    stewardPhiAwards: { ...state.stewardPhiAwards, [phiAward.awardId]: phiAward },
    contributionHistory: [...state.contributionHistory, { operationId: operation.operationId, amountPhiMicro, eventId: event.eventId }].slice(-4_096)
  };
}

export function reduceWildsWorldEvent(state: WildsWorldProjection, event: CompatibleWildsWorldEvent): WildsWorldProjection {
  if (state.recentEventIds.includes(event.eventId)) return state;
  if (state.cursor) {
    const prior = cursorAsEvent(state.cursor);
    if (compareWildsWorldEvents(prior, event) >= 0) {
      throw new Error("wilds_world_event_order_invalid");
    }
  }
  const continuity = verifyWildsWorldEvent(event, state.cursor ? cursorAsEvent(state.cursor) : null);
  if (!continuity.ok) throw new Error(continuity.errors[0] ?? "wilds_world_event_invalid");
  const payload = recordPayload(event.payload);

  switch (event.kind) {
    case "site.spawned": {
      const site = entity<WildsWorldSiteProjection>(payload.site, "site");
      if (state.sites[site.id]) throw new Error("wilds_world_site_exists");
      return appendEvent(state, event, { sites: { ...state.sites, [site.id]: site } });
    }
    case "site.phase_changed": {
      const siteId = String(payload.siteId ?? "");
      const phase = String(payload.phase ?? "") as WildsDynamicSitePhase;
      const site = state.sites[siteId];
      if (!site) throw new Error("wilds_world_site_missing");
      return appendEvent(state, event, { sites: { ...state.sites, [siteId]: { ...site, phase } } });
    }
    case "boss.emerged": {
      const boss = entity<WildsWorldBossProjection>(payload.boss, "boss");
      const raid = payload.raid ? entity<WildsWorldRaidProjection>(payload.raid, "raid") : null;
      const site = state.sites[boss.siteId];
      if (!site || state.bosses[boss.id] || state.defeatedBossIds.includes(boss.id)) throw new Error("wilds_world_boss_emergence_invalid");
      return appendEvent(state, event, {
        bosses: { ...state.bosses, [boss.id]: boss },
        raids: raid ? { ...state.raids, [raid.id]: raid } : state.raids,
        sites: { ...state.sites, [site.id]: { ...site, bossId: boss.id, phase: "emerged" } }
      });
    }
    case "raid.joined":
    case "raid.contributed":
    case "raid.entered":
    case "raid.acted":
    case "raid.lease_changed":
    case "raid.retreated": {
      const raid = entity<WildsWorldRaidProjection>(payload.raid, "raid");
      const boss = payload.boss ? entity<WildsWorldBossProjection>(payload.boss, "boss") : null;
      return appendEvent(state, event, {
        raids: { ...state.raids, [raid.id]: raid },
        bosses: boss ? { ...state.bosses, [boss.id]: boss } : state.bosses
      });
    }
    case "boss.defeated": {
      const bossId = String(payload.bossId ?? "");
      const boss = state.bosses[bossId];
      if (!boss || state.defeatedBossIds.includes(bossId)) throw new Error("wilds_world_boss_defeat_invalid");
      const defeatedAt = String(payload.defeatedAt ?? event.occurredAt);
      return appendEvent(state, event, {
        bosses: { ...state.bosses, [bossId]: { ...boss, phase: "defeated", health: 0, defeatedAt } },
        defeatedBossIds: [...state.defeatedBossIds, bossId]
      });
    }
    case "site.memorialized": {
      const siteId = String(payload.siteId ?? "");
      const site = state.sites[siteId];
      if (!site) throw new Error("wilds_world_site_missing");
      return appendEvent(state, event, { sites: { ...state.sites, [siteId]: { ...site, phase: "memorialized" } } });
    }
    case "ecology.spawned": {
      const site = entity<WildsWorldEcologyProjection>(payload.site, "ecology_site");
      if (state.ecologySites[site.id]) throw new Error("wilds_world_ecology_site_exists");
      return appendEvent(state, event, { ecologySites: { ...state.ecologySites, [site.id]: site } });
    }
    case "ecology.phase_changed": {
      const siteId = String(payload.siteId ?? "");
      const phase = String(payload.phase ?? "") as WildsWorldEcologyProjection["phase"];
      const site = state.ecologySites[siteId];
      if (!site) throw new Error("wilds_world_ecology_site_missing");
      return appendEvent(state, event, { ecologySites: { ...state.ecologySites, [siteId]: { ...site, phase } } });
    }
    case "ecology.discovered":
    case "ecology.contributed": {
      const site = entity<WildsWorldEcologyProjection>(payload.site, "ecology_site");
      if (!state.ecologySites[site.id]) throw new Error("wilds_world_ecology_site_missing");
      return appendEvent(state, event, { ecologySites: { ...state.ecologySites, [site.id]: site } });
    }
    case "ecology.resolved":
    case "ecology.historicized": {
      const site = entity<WildsWorldEcologyProjection>(payload.site, "ecology_site");
      if (!state.ecologySites[site.id]) throw new Error("wilds_world_ecology_site_missing");
      return appendEvent(state, event, {
        ecologySites: { ...state.ecologySites, [site.id]: site },
        ecologyHistory: state.ecologyHistory.includes(site.id) ? state.ecologyHistory : [...state.ecologyHistory, site.id].slice(-512)
      });
    }
    case "grove.discovered": {
      const grove = recordPayload(payload.grove) as unknown as WildsRegenerativeGroveV1;
      const emission = recordPayload(payload.emission) as unknown as WildsWorldEmissionProofV1;
      if (!verifyWildsRegenerativeGrove(grove) || !verifyWildsWorldEmissionProof(emission)) throw new Error("wilds_world_grove_discovery_invalid");
      if (state.groves[grove.groveId]) throw new Error("wilds_world_grove_exists");
      if (state.worldEmission && state.worldEmission.head !== emission.head) throw new Error("wilds_world_emission_conflict");
      return appendEvent(state, event, {
        groves: { ...state.groves, [grove.groveId]: grove },
        worldEmission: emission
      });
    }
    case "grove.operation_admitted": {
      const grove = recordPayload(payload.grove) as unknown as WildsRegenerativeGroveV1;
      const operation = recordPayload(payload.operation) as unknown as WildsLivingOperationPlanV1;
      const emission = recordPayload(payload.emission) as unknown as WildsWorldEmissionProofV1;
      const amountPhiMicro = String(payload.amountPhiMicro ?? "");
      const resourceLot = payload.resourceLot ?? null;
      const currentGrove = state.groves[grove.groveId];
      const currentEmission = wildsWorldSourceEmission(state);
      if (!currentGrove || grove.parentHead !== currentGrove.head || grove.revision !== currentGrove.revision + 1
        || grove.lastKaiUPulse !== operation.kaiUPulse || !verifyWildsRegenerativeGrove(grove)
        || !verifyWildsLivingOperationPlan(operation).ok || operation.intention.featureId !== grove.groveId
        || emission.parentHead !== currentEmission.head
        || emission.revision !== currentEmission.revision + 1 || !verifyWildsWorldEmissionProof(emission)
        || canonicalPortableCardJson(emission.consumedOperationIds) !== canonicalPortableCardJson([...currentEmission.consumedOperationIds, operation.operationId].sort())
        || !/^(?:0|[1-9][0-9]{0,39})$/.test(amountPhiMicro)) {
        throw new Error("wilds_world_grove_operation_invalid");
      }
      const harvest = operation.intention.kind === "grove.harvest-honey";
      if (harvest) {
        if (!verifyWildsResourceLot(resourceLot)
          || resourceLot.ownerReceizId !== event.actorId
          || resourceLot.source.groveId !== grove.groveId
          || resourceLot.source.groveSourceHead !== currentGrove.head
          || resourceLot.source.groveAdmittedHead !== grove.head
          || resourceLot.source.operationId !== operation.operationId
          || resourceLot.source.operationPlanDigest !== operation.planDigest
          || state.resourceLots[resourceLot.lotId]) {
          throw new Error("wilds_world_grove_resource_lot_invalid");
        }
      } else if (resourceLot !== null) {
        throw new Error("wilds_world_grove_resource_lot_invalid");
      }
      const emitted = BigInt(currentEmission.globalRemainingPhiMicro) - BigInt(emission.globalRemainingPhiMicro);
      const regionId = String(operation.intention.regionId ?? "");
      const contributionClass = operation.category === "construction" ? "construction" : "ecology";
      const regionEmitted = BigInt(currentEmission.regionRemainingPhiMicro[regionId] ?? "-1") - BigInt(emission.regionRemainingPhiMicro[regionId] ?? "-1");
      const classEmitted = BigInt(currentEmission.classRemainingPhiMicro[contributionClass] ?? "-1") - BigInt(emission.classRemainingPhiMicro[contributionClass] ?? "-1");
      if (emitted.toString() !== amountPhiMicro || regionEmitted !== emitted || classEmitted !== emitted) throw new Error("wilds_world_grove_emission_invalid");
      return appendEvent(state, event, {
        groves: { ...state.groves, [grove.groveId]: grove },
        resourceLots: harvest ? { ...state.resourceLots, [(resourceLot as WildsResourceLotV1).lotId]: resourceLot as WildsResourceLotV1 } : state.resourceLots,
        resourceCustody: harvest ? { ...state.resourceCustody, [(resourceLot as WildsResourceLotV1).lotId]: {
          ownerReceizId: (resourceLot as WildsResourceLotV1).ownerReceizId,
          subjectId: "",
          subjectHead: (resourceLot as WildsResourceLotV1).head.replace(/^sha256:/, ""),
          receiptId: "genesis",
          transferId: "genesis"
        } } : state.resourceCustody,
        livingOperations: { ...state.livingOperations, [operation.operationId]: operation },
        worldEmission: emission,
        contributionHistory: [...state.contributionHistory, { operationId: operation.operationId, amountPhiMicro, eventId: event.eventId }].slice(-4_096)
      });
    }
    case "resource.custody_transferred": {
      const lotId = String(payload.lotId ?? "");
      const ownerReceizId = String(payload.ownerReceizId ?? "");
      const subjectId = String(payload.subjectId ?? "");
      const subjectHead = String(payload.subjectHead ?? "");
      const receiptId = String(payload.receiptId ?? "");
      const transferId = String(payload.transferId ?? "");
      if (!state.resourceLots[lotId] || !ownerReceizId || !subjectId || !/^[a-f0-9]{64}$/.test(subjectHead)
        || !receiptId || !transferId || ownerReceizId !== event.actorId) throw new Error("wilds_world_resource_transfer_invalid");
      const current = state.resourceCustody[lotId];
      if (current?.transferId === transferId) {
        throw new Error("wilds_world_resource_transfer_replay");
      }
      return appendEvent(state, event, { resourceCustody: { ...state.resourceCustody, [lotId]: { ownerReceizId, subjectId, subjectHead, receiptId, transferId } } });
    }
    case "resource.material_harvested": {
      const source = recordPayload(payload.source) as unknown as WildsResourceSource;
      const sourceState = recordPayload(payload.sourceState) as unknown as WildsHarvestedSourceStateV1;
      const lot = recordPayload(payload.lot) as unknown as WildsMaterialLotV1;
      if (!isCanonicalWildsResourceSource(source)
        || !verifyWildsHarvestedSourceState(sourceState) || sourceState.sourceId !== source.sourceId
        || !verifyWildsMaterialLot(lot) || lot.ownerReceizId !== event.actorId || lot.source.sourceId !== source.sourceId
        || lot.source.admittedSourceHead !== sourceState.head || state.materialLots[lot.lotId]) {
        throw new Error("wilds_world_material_harvest_invalid");
      }
      const current = state.harvestedSources[source.sourceId] ?? initialWildsHarvestedSourceState(source);
      if (sourceState.parentHead !== current.head || sourceState.revision !== current.revision + 1
        || lot.source.sourceHead !== current.head || sourceState.harvestedCapacity < 1
        || sourceState.harvestedCapacity > source.capacity) throw new Error("wilds_world_material_conservation_invalid");
      const nextToolValue = payload.tool;
      let stewardTools = state.stewardTools;
      if (nextToolValue) {
        const nextTool = recordPayload(nextToolValue) as unknown as WildsStewardToolV1;
        const currentTool = state.stewardTools[nextTool.toolId];
        if (!currentTool || !verifyWildsStewardTool(nextTool) || currentTool.ownerReceizId !== event.actorId
          || nextTool.parentHead !== currentTool.head || nextTool.revision !== currentTool.revision + 1
          || nextTool.durability.remaining !== currentTool.durability.remaining - 1
          || state.equippedStewardTools[event.actorId] !== nextTool.toolId
          || nextTool.capability !== source.requirements.creature) throw new Error("wilds_world_material_tool_invalid");
        stewardTools = { ...state.stewardTools, [nextTool.toolId]: nextTool };
      }
      const economyValues = [payload.emission, payload.amountPhiMicro, payload.phiAward];
      const economy = economyValues.every((value) => value === undefined)
        ? {}
        : economyValues.every((value) => value !== undefined)
          ? stewardEconomyPatch(state, event, payload)
          : (() => { throw new Error("wilds_world_steward_economy_invalid"); })();
      return appendEvent(state, event, {
        harvestedSources: { ...state.harvestedSources, [source.sourceId]: sourceState },
        materialLots: { ...state.materialLots, [lot.lotId]: lot },
        stewardTools,
        ...economy
      });
    }
    case "structure.built": {
      const structure = recordPayload(payload.structure) as unknown as WildsStructureV1;
      if (!verifyWildsStructure(structure) || structure.ownerReceizId !== event.actorId || state.structures[structure.structureId]) {
        throw new Error("wilds_world_structure_invalid");
      }
      for (let index = 0; index < structure.consumedLotIds.length; index += 1) {
        const lotId = structure.consumedLotIds[index]!;
        const lot = state.materialLots[lotId];
        if (!lot || lot.ownerReceizId !== event.actorId || lot.head !== structure.consumedLotHeads[index]
          || state.consumedMaterialLots[lotId] || state.storedMaterialLots[lotId]) throw new Error("wilds_world_structure_material_invalid");
      }
      const economy = stewardEconomyPatch(state, event, payload);
      return appendEvent(state, event, {
        structures: { ...state.structures, [structure.structureId]: structure },
        consumedMaterialLots: {
          ...state.consumedMaterialLots,
          ...Object.fromEntries(structure.consumedLotIds.map((lotId) => [lotId, structure.structureId]))
        },
        ...economy
      });
    }
    case "construction.site_placed": {
      const site = recordPayload(payload.site) as unknown as WildsConstructionSiteV1;
      if (!verifyWildsConstructionSite(site) || site.stage !== "placed" || site.revision !== 0
        || site.placedByReceizId !== event.actorId || state.constructionSites[site.siteId]
        || Object.values(state.structures).some((structure) => Math.hypot(structure.position.x - site.position.x, structure.position.z - site.position.z) < (site.blueprint === "trail-bridge" ? 9.25 : 7.25))
        || Object.values(state.constructionSites).some((existing) => existing.stage !== "complete" && Math.hypot(existing.position.x - site.position.x, existing.position.z - site.position.z) < (site.blueprint === "trail-bridge" ? 9.25 : 7.25))) {
        throw new Error("wilds_world_construction_site_invalid");
      }
      return appendEvent(state, event, { constructionSites: { ...state.constructionSites, [site.siteId]: site } });
    }
    case "construction.site_contributed": {
      const site = recordPayload(payload.site) as unknown as WildsConstructionSiteV1;
      const current = state.constructionSites[site.siteId];
      if (!current || !verifyWildsConstructionSite(site) || current.stage === "complete" || site.stage === "complete"
        || site.parentHead !== current.head || site.revision !== current.revision + 1) throw new Error("wilds_world_construction_site_transition_invalid");
      const prior = new Map(current.contributedLots.map((entry) => [entry.lotId, entry]));
      if (current.contributedLots.some((entry) => canonicalPortableCardJson(site.contributedLots.find((candidate) => candidate.lotId === entry.lotId)) !== canonicalPortableCardJson(entry))) {
        throw new Error("wilds_world_construction_site_transition_invalid");
      }
      const additions = site.contributedLots.filter((entry) => !prior.has(entry.lotId));
      if (additions.length < 1 || additions.some((entry) => {
        const lot = state.materialLots[entry.lotId];
        return entry.ownerReceizId !== event.actorId || !lot || lot.ownerReceizId !== event.actorId || lot.head !== entry.lotHead || lot.kind !== entry.kind
          || state.consumedMaterialLots[entry.lotId] || state.storedMaterialLots[entry.lotId] || state.reservedMaterialLots[entry.lotId];
      })) throw new Error("wilds_world_construction_material_invalid");
      return appendEvent(state, event, {
        constructionSites: { ...state.constructionSites, [site.siteId]: site },
        reservedMaterialLots: { ...state.reservedMaterialLots, ...Object.fromEntries(additions.map((entry) => [entry.lotId, site.siteId])) }
      });
    }
    case "construction.site_worked": {
      const site = recordPayload(payload.site) as unknown as WildsConstructionSiteV1;
      const structure = recordPayload(payload.structure) as unknown as WildsStructureV1;
      const current = state.constructionSites[site.siteId];
      if (!current || !verifyWildsConstructionSite(site) || current.stage !== "materials-ready" || site.stage !== "complete"
        || site.parentHead !== current.head || site.revision !== current.revision + 1
        || !verifyWildsStructure(structure) || state.structures[structure.structureId]
        || site.terminalStructureId !== structure.structureId || site.terminalStructureHead !== structure.head
        || structure.ownerReceizId !== current.placedByReceizId
        || canonicalPortableCardJson(structure.consumedLotIds) !== canonicalPortableCardJson(current.contributedLots.map((entry) => entry.lotId))
        || canonicalPortableCardJson(structure.consumedLotHeads) !== canonicalPortableCardJson(current.contributedLots.map((entry) => entry.lotHead))) {
        throw new Error("wilds_world_construction_completion_invalid");
      }
      for (const entry of current.contributedLots) {
        const lot = state.materialLots[entry.lotId];
        if (!lot || lot.head !== entry.lotHead || state.reservedMaterialLots[entry.lotId] !== site.siteId || state.consumedMaterialLots[entry.lotId]) {
          throw new Error("wilds_world_construction_material_invalid");
        }
      }
      const reservedMaterialLots = { ...state.reservedMaterialLots };
      for (const entry of current.contributedLots) delete reservedMaterialLots[entry.lotId];
      const economy = stewardEconomyPatch(state, event, payload);
      return appendEvent(state, event, {
        constructionSites: { ...state.constructionSites, [site.siteId]: site },
        structures: { ...state.structures, [structure.structureId]: structure },
        reservedMaterialLots,
        consumedMaterialLots: { ...state.consumedMaterialLots, ...Object.fromEntries(structure.consumedLotIds.map((lotId) => [lotId, structure.structureId])) },
        ...economy
      });
    }
    case "tool.crafted": {
      const tool = recordPayload(payload.tool) as unknown as WildsStewardToolV1;
      if (!verifyWildsStewardTool(tool) || tool.ownerReceizId !== event.actorId || state.stewardTools[tool.toolId]
        || state.structures[tool.workstationId]?.head !== tool.workstationHead) throw new Error("wilds_world_tool_invalid");
      for (let index = 0; index < tool.consumedLotIds.length; index += 1) {
        const lotId = tool.consumedLotIds[index]!;
        const lot = state.materialLots[lotId];
        if (!lot || lot.ownerReceizId !== event.actorId || lot.head !== tool.consumedLotHeads[index]
          || state.consumedMaterialLots[lotId] || state.storedMaterialLots[lotId]) throw new Error("wilds_world_tool_material_invalid");
      }
      const economy = stewardEconomyPatch(state, event, payload);
      return appendEvent(state, event, {
        stewardTools: { ...state.stewardTools, [tool.toolId]: tool },
        consumedMaterialLots: { ...state.consumedMaterialLots, ...Object.fromEntries(tool.consumedLotIds.map((lotId) => [lotId, tool.toolId])) },
        ...economy
      });
    }
    case "tool.equipped": {
      const toolId = String(payload.toolId ?? "");
      const tool = state.stewardTools[toolId];
      if (!tool || tool.ownerReceizId !== event.actorId || tool.durability.remaining < 1) throw new Error("wilds_world_tool_equip_invalid");
      return appendEvent(state, event, { equippedStewardTools: { ...state.equippedStewardTools, [event.actorId]: toolId } });
    }
    case "storage.material_moved": {
      const lotId = String(payload.lotId ?? "");
      const cacheId = String(payload.cacheId ?? "");
      const direction = String(payload.direction ?? "");
      const lot = state.materialLots[lotId];
      const cache = state.structures[cacheId];
      if (!lot || lot.ownerReceizId !== event.actorId || state.consumedMaterialLots[lotId]
        || !cache || cache.blueprint !== "trail-cache" || cache.ownerReceizId !== event.actorId
        || (direction !== "deposit" && direction !== "withdraw")) throw new Error("wilds_world_storage_invalid");
      if (direction === "deposit") {
        if (state.storedMaterialLots[lotId]) throw new Error("wilds_world_storage_already_stored");
        return appendEvent(state, event, { storedMaterialLots: { ...state.storedMaterialLots, [lotId]: cacheId } });
      }
      if (state.storedMaterialLots[lotId] !== cacheId) throw new Error("wilds_world_storage_lot_missing");
      const storedMaterialLots = { ...state.storedMaterialLots };
      delete storedMaterialLots[lotId];
      return appendEvent(state, event, { storedMaterialLots });
    }
    case "team.created":
    case "team.joined":
    case "team.invited":
    case "team.invite_accepted":
    case "team.role_changed":
    case "team.event_scheduled":
    case "team.squad_assembled": {
      const team = entity<WildsWorldTeamProjection>(payload.team, "team");
      return appendEvent(state, event, { teams: { ...state.teams, [team.id]: team } });
    }
    case "social.abuse_reported":
      return appendEvent(state, event, {});
    case "league.scored": {
      const league = recordPayload(payload.league) as WildsLeagueProjection;
      if (league.seasonId !== "v3-genesis") throw new Error("wilds_world_league_invalid");
      return appendEvent(state, event, { league });
    }
    case "story.chapter_opened": {
      const chapter = recordPayload(payload.chapter) as WildsStoryChapterProjection;
      sagaIdentity(chapter.dayId, "day");
      sagaIdentity(chapter.chapterId, "chapter");
      if (chapter.frameworkVersion !== "kai-saga.v1") throw new Error("wilds_story_framework_invalid");
      sagaTime(chapter.openedAt);
      sagaTime(chapter.endsAt);
      if (chapter.endsAt <= chapter.openedAt) throw new Error("wilds_story_window_invalid");
      if (state.story.activeChapter && state.story.activeChapter.dayId !== chapter.dayId && !state.story.settledDayIds.includes(state.story.activeChapter.dayId)) {
        throw new Error("wilds_story_prior_chapter_unsettled");
      }
      return appendEvent(state, event, { story: { ...state.story, activeChapter: { ...chapter } } });
    }
    case "story.objective_contributed": {
      const dayId = sagaIdentity(payload.dayId, "day");
      const objectiveId = sagaIdentity(payload.objectiveId, "objective");
      const playerId = sagaIdentity(payload.playerId, "player");
      sagaIdentity(payload.verb, "verb");
      const amount = Number(payload.amount);
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100) throw new Error("wilds_story_contribution_invalid");
      if (state.story.activeChapter?.dayId !== dayId || state.story.settledDayIds.includes(dayId)) throw new Error("wilds_story_chapter_inactive");
      const player = playerSagaState(state, playerId);
      const trainerXp = Math.min(10_000, player.trainerXp + amount);
      return appendEvent(state, event, {
        story: { ...state.story, objectiveTotals: { ...state.story.objectiveTotals, [objectiveId]: (state.story.objectiveTotals[objectiveId] ?? 0) + amount } },
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            trainerXp,
            trainerLevel: Math.min(100, 1 + Math.floor(trainerXp / 100)),
            contributions: { ...player.contributions, [objectiveId]: (player.contributions[objectiveId] ?? 0) + amount }
          }
        }
      });
    }
    case "story.chapter_settled": {
      const memory = recordPayload(payload.memory) as unknown as WildsChapterMemory;
      sagaIdentity(memory.chapterId, "chapter");
      sagaIdentity(memory.dayId, "day");
      sagaIdentity(memory.hookId, "hook");
      sagaIdentity(memory.settledEventId, "settlement");
      sagaTime(memory.settledAt);
      if (!new Set(["success", "partial", "failure", "unopposed"]).has(memory.outcome)) throw new Error("wilds_story_outcome_invalid");
      if (state.story.settledDayIds.includes(memory.dayId)) throw new Error("wilds_story_chapter_already_settled");
      if (state.story.activeChapter?.dayId !== memory.dayId || state.story.activeChapter.chapterId !== memory.chapterId) throw new Error("wilds_story_chapter_inactive");
      return appendEvent(state, event, {
        story: {
          ...state.story,
          memories: [...state.story.memories, { ...memory }].slice(-2_048),
          settledDayIds: [...state.story.settledDayIds, memory.dayId].slice(-2_048)
        }
      });
    }
    case "story.achievement_granted": {
      const grant = recordPayload(payload.grant) as unknown as WildsAchievementGrantProjection;
      const grantId = sagaIdentity(grant.grantId, "achievement_grant");
      const playerId = sagaIdentity(grant.playerId, "player");
      sagaIdentity(grant.definitionId, "achievement");
      sagaIdentity(grant.scopeInstanceId, "scope");
      const reward = recordPayload(grant.reward) as unknown as WildsReward;
      sagaIdentity(reward.id, "reward");
      const player = playerSagaState(state, playerId);
      const existing = player.achievementGrants[grantId];
      if (existing && canonicalPortableCardJson(existing) !== canonicalPortableCardJson(grant)) throw new Error("wilds_story_achievement_divergent");
      if (existing) return appendEvent(state, event, {});
      return appendEvent(state, event, {
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            achievementGrantIds: [...player.achievementGrantIds, grantId].slice(-4_096),
            rewardIds: player.rewardIds.includes(reward.id) ? player.rewardIds : [...player.rewardIds, reward.id].slice(-4_096),
            achievementGrants: { ...player.achievementGrants, [grantId]: { ...grant, reward: { ...reward } } }
          }
        }
      });
    }
    case "story.trainer_encountered":
    case "story.trainer_battle_settled": {
      const trainer = entity<WildsTrainerWorldProjection>(payload.trainer, "story_trainer");
      const existing = state.trainers[trainer.id];
      if (existing && event.kind === "story.trainer_battle_settled" && existing.settledMatchId === trainer.settledMatchId && canonicalPortableCardJson(existing) !== canonicalPortableCardJson(trainer)) {
        throw new Error("wilds_story_trainer_battle_divergent");
      }
      if (event.kind === "story.trainer_battle_settled") {
        const playerId = sagaIdentity(payload.playerId, "player");
        const xpAward = Number(payload.xpAward);
        if (!Number.isSafeInteger(xpAward) || xpAward < 0 || xpAward > 100) throw new Error("wilds_story_trainer_xp_invalid");
        const player = playerSagaState(state, playerId);
        const trainerXp = Math.min(10_000, player.trainerXp + xpAward);
        return appendEvent(state, event, {
          trainers: { ...state.trainers, [trainer.id]: trainer },
          players: { ...state.players, [playerId]: { ...player, trainerXp, trainerLevel: Math.min(100, 1 + Math.floor(trainerXp / 100)) } }
        });
      }
      return appendEvent(state, event, { trainers: { ...state.trainers, [trainer.id]: trainer } });
    }
    case "story.tournament_opened":
    case "story.tournament_entered":
    case "story.tournament_round_settled":
    case "story.tournament_settled": {
      const tournament = entity<WildsTournamentWorldProjection>(payload.tournament, "story_tournament");
      const existing = state.tournaments[tournament.id];
      if (existing?.phase === "settled" && canonicalPortableCardJson(existing) !== canonicalPortableCardJson(tournament)) throw new Error("wilds_story_tournament_divergent");
      return appendEvent(state, event, { tournaments: { ...state.tournaments, [tournament.id]: tournament } });
    }
  }
}

function projectionDigest(projection: WildsWorldProjection) {
  return sha256PortableBasis(canonicalPortableCardJson(projection));
}

export function checkpointWildsWorld(projection: WildsWorldProjection): WildsWorldCheckpoint {
  return {
    schema: "receiz.wilds_world_checkpoint.v3",
    worldId: WILDS_WORLD_ID,
    revision: projection.revision,
    lastEventId: projection.cursor?.eventId ?? null,
    projectionDigest: projectionDigest(projection),
    projection
  };
}

function verifyCheckpoint(checkpoint: WildsWorldCheckpoint) {
  return checkpoint.schema === "receiz.wilds_world_checkpoint.v3"
    && checkpoint.worldId === WILDS_WORLD_ID
    && checkpoint.revision === checkpoint.projection.revision
    && checkpoint.lastEventId === (checkpoint.projection.cursor?.eventId ?? null)
    && checkpoint.projectionDigest === projectionDigest(checkpoint.projection);
}

export function replayWildsWorld(events: readonly CompatibleWildsWorldEvent[], checkpoint?: WildsWorldCheckpoint) {
  if (checkpoint && !verifyCheckpoint(checkpoint)) throw new Error("wilds_world_checkpoint_invalid");
  const projection = checkpoint?.projection;
  const hydrated = projection ? {
    ...projection,
    groves: projection.groves ?? {},
    resourceLots: projection.resourceLots ?? {},
    resourceCustody: projection.resourceCustody ?? {},
    harvestedSources: projection.harvestedSources ?? {},
    materialLots: projection.materialLots ?? {},
    consumedMaterialLots: projection.consumedMaterialLots ?? {},
    structures: projection.structures ?? {},
    constructionSites: projection.constructionSites ?? {},
    reservedMaterialLots: projection.reservedMaterialLots ?? {},
    stewardTools: projection.stewardTools ?? {},
    equippedStewardTools: projection.equippedStewardTools ?? {},
    storedMaterialLots: projection.storedMaterialLots ?? {},
    stewardPhiAwards: projection.stewardPhiAwards ?? {},
    livingOperations: projection.livingOperations ?? {},
    worldEmission: projection.worldEmission ?? null,
    contributionHistory: projection.contributionHistory ?? []
  } : initialWildsWorldProjection();
  return events.reduce(reduceWildsWorldEvent, hydrated);
}
