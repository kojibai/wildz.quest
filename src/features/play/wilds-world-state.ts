import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import {
  compareWildsWorldEvents,
  verifyWildsWorldEvent,
  WILDS_WORLD_ID,
  type WildsWorldEvent
} from "./wilds-world-event";

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

export type WildsWorldBossProjection = {
  id: string;
  siteId: string;
  phase: "emerged" | "engaged" | "defeated";
  health: number;
  maxHealth: number;
  defeatedAt: string | null;
  [key: string]: unknown;
};

export type WildsWorldRaidProjection = {
  id: string;
  bossId: string;
  phase: "forming" | "active" | "settled";
  [key: string]: unknown;
};

export type WildsWorldTeamProjection = {
  id: string;
  name: string;
  captainId: string;
  memberIds: string[];
  createdAt: string;
};

export type WildsLeagueProjection = {
  seasonId: "v3-genesis";
  scores: Record<string, number>;
  standings: { teamId: string; score: number; rank: number }[];
  scoredEventIds: string[];
};

export type WildsWorldProjection = {
  schema: "receiz.wilds_world_projection.v3";
  worldId: typeof WILDS_WORLD_ID;
  revision: number;
  cursor: { pulse: string; kaiKlok: number; eventId: string } | null;
  sites: Record<string, WildsWorldSiteProjection>;
  bosses: Record<string, WildsWorldBossProjection>;
  raids: Record<string, WildsWorldRaidProjection>;
  teams: Record<string, WildsWorldTeamProjection>;
  league: WildsLeagueProjection;
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
    bosses: {},
    raids: {},
    teams: {},
    league: { seasonId: "v3-genesis", scores: {}, standings: [], scoredEventIds: [] },
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

function appendEvent(state: WildsWorldProjection, event: WildsWorldEvent, patch: Partial<WildsWorldProjection>): WildsWorldProjection {
  return {
    ...state,
    ...patch,
    revision: state.revision + 1,
    cursor: { pulse: event.pulse, kaiKlok: event.kaiKlok, eventId: event.eventId },
    recentEventIds: [...state.recentEventIds, event.eventId].slice(-512)
  };
}

export function reduceWildsWorldEvent(state: WildsWorldProjection, event: WildsWorldEvent): WildsWorldProjection {
  if (state.recentEventIds.includes(event.eventId)) return state;
  if (state.cursor) {
    if (event.pulse < state.cursor.pulse || (event.pulse === state.cursor.pulse && event.kaiKlok <= state.cursor.kaiKlok)) {
      throw new Error("wilds_world_event_order_invalid");
    }
  }
  const continuity = verifyWildsWorldEvent(event, state.cursor ? ({ eventId: state.cursor.eventId, pulse: state.cursor.pulse, kaiKlok: state.cursor.kaiKlok } as WildsWorldEvent) : null);
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
    case "raid.contributed": {
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
    case "team.created":
    case "team.joined": {
      const team = entity<WildsWorldTeamProjection>(payload.team, "team");
      return appendEvent(state, event, { teams: { ...state.teams, [team.id]: team } });
    }
    case "league.scored": {
      const league = recordPayload(payload.league) as WildsLeagueProjection;
      if (league.seasonId !== "v3-genesis") throw new Error("wilds_world_league_invalid");
      return appendEvent(state, event, { league });
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

export function replayWildsWorld(events: readonly WildsWorldEvent[], checkpoint?: WildsWorldCheckpoint) {
  if (checkpoint && !verifyCheckpoint(checkpoint)) throw new Error("wilds_world_checkpoint_invalid");
  return events.reduce(reduceWildsWorldEvent, checkpoint?.projection ?? initialWildsWorldProjection());
}
