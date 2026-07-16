import { projectWildsBiome, type WildsBiomeTile } from "./wilds-biome";
import {
  expirePresence,
  presenceDistance,
  regionForPosition,
  WILDS_INTERACTION_DISTANCE,
  WILDS_REGION_SIZE,
  type WildsPresence
} from "./multiplayer-core";
import { WILDS_FLAGSHIP_LANDMARKS, type WildsLandmarkDefinition, type WildsLandmarkId } from "./wilds-landmarks";
import type { WildsWorldSiteProjection } from "./wilds-world-state";
import type { WildsWorldEcologyProjection } from "./wilds-world-state";
import type { WildsEcologyKnowledge, WildsEcologyKnowledgeVisibility } from "./wilds-ecology-history";
import type { WildsWorldBossProjection } from "./wilds-world-state";
import type { WildsBossKnowledge } from "./wilds-raid-history";
import type { WildsBossFamilyId } from "./wilds-boss-ecology";

export type WildsAtlasZoom = "world" | "region" | "landmark";

export type WildsAtlasNode = {
  id: string;
  regionX: number;
  regionZ: number;
  biome: WildsBiomeTile;
};

export type WildsAtlasLandmark = WildsLandmarkDefinition & {
  discovered: boolean;
};

export type WildsAtlasExactPlayer = Pick<WildsPresence, "playerId" | "handle" | "style" | "x" | "z" | "status">;

export type WildsAtlasPlayerCluster = {
  id: string;
  regionX: number;
  regionZ: number;
  count: number;
  position: { x: number; z: number };
};

export type WildsAtlasProjection = {
  centerRegion: { x: number; z: number };
  zoom: WildsAtlasZoom;
  nodes: WildsAtlasNode[];
  landmarks: WildsAtlasLandmark[];
  exactPlayers: WildsAtlasExactPlayer[];
  playerClusters: WildsAtlasPlayerCluster[];
  dynamicSites: (WildsWorldSiteProjection & { visibility: "signal" | "exact" | "memorial" })[];
  ecologySites: WildsAtlasEcologySite[];
  bosses: WildsAtlasBoss[];
};

type WildsAtlasBossCommon = {
  id: string; familyId: WildsBossFamilyId; name: string; phase: WildsWorldBossProjection["phase"];
  healthBand: "full" | "steady" | "wounded" | "critical" | "defeated"; regionId: string;
  territoryRadius: number; uncertaintyRadius: number;
};
export type WildsAtlasBoss = WildsAtlasBossCommon & (
  | { visibility: "rumor" | "trace" }
  | { visibility: "exact" | "contested" | "aftermath" | "historical"; position: { x: number; z: number } }
);

type WildsAtlasEcologyCommon = Pick<WildsWorldEcologyProjection, "id" | "familyId" | "name" | "phase" | "intensity" | "region" | "radius" | "activityId" | "audioMotif" | "aftermathModule" | "parentSiteId"> & {
  uncertaintyRadius: number;
};

export type WildsAtlasEcologySite = WildsAtlasEcologyCommon & (
  | { visibility: "rumor" | "approximate" }
  | { visibility: "exact" | "aftermath" | "historical"; position: { x: number; z: number } }
);

export type WildsAtlasInput = {
  center: { x: number; z: number };
  zoom: WildsAtlasZoom;
  missionProgress: number;
  worldMastery: number;
  discoveredLandmarkIds: readonly (WildsLandmarkId | string)[];
  selfId: string;
  players: WildsPresence[];
  dynamicSites?: readonly WildsWorldSiteProjection[];
  ecologySites?: readonly WildsWorldEcologyProjection[];
  ecologyKnowledge?: Record<string, WildsEcologyKnowledge>;
  bosses?: readonly WildsWorldBossProjection[];
  bossKnowledge?: Record<string, WildsBossKnowledge>;
  now?: number;
};

const radiusByZoom: Record<WildsAtlasZoom, number> = {
  world: 4,
  region: 2,
  landmark: 1
};

export function projectWildsAtlas(input: WildsAtlasInput): WildsAtlasProjection {
  // The world view is a stable, learnable atlas. Closer zooms follow the explorer.
  const centerRegion = input.zoom === "world" ? { x: 0, z: 0 } : regionForPosition(input.center);
  const radius = radiusByZoom[input.zoom];
  const nodes: WildsAtlasNode[] = [];
  for (let regionZ = centerRegion.z - radius; regionZ <= centerRegion.z + radius; regionZ += 1) {
    for (let regionX = centerRegion.x - radius; regionX <= centerRegion.x + radius; regionX += 1) {
      nodes.push({
        id: `region:${regionX}:${regionZ}`,
        regionX,
        regionZ,
        biome: projectWildsBiome(regionX, regionZ, input.missionProgress, input.worldMastery)
      });
    }
  }

  const visiblePlayers = expirePresence(input.players, input.now)
    .filter((player) => player.playerId !== input.selfId)
    .sort((left, right) => presenceDistance(left, input.center) - presenceDistance(right, input.center))
    .slice(0, 24);
  const exactPlayers = visiblePlayers
    .filter((player) => player.status !== "private")
    .map(({ playerId, handle, style, x, z, status }) => ({ playerId, handle, style, x, z, status }));
  const exactIds = new Set(exactPlayers.map((player) => player.playerId));
  const clusters = new Map<string, WildsAtlasPlayerCluster>();
  for (const player of visiblePlayers) {
    if (exactIds.has(player.playerId)) continue;
    const region = regionForPosition(player);
    const id = `cluster:${region.x}:${region.z}`;
    const cluster = clusters.get(id);
    if (cluster) {
      cluster.count += 1;
    } else {
      clusters.set(id, {
        id,
        regionX: region.x,
        regionZ: region.z,
        count: 1,
        position: {
          x: region.x * WILDS_REGION_SIZE + WILDS_REGION_SIZE / 2,
          z: region.z * WILDS_REGION_SIZE + WILDS_REGION_SIZE / 2
        }
      });
    }
  }

  const discovered = new Set(input.discoveredLandmarkIds);
  return {
    centerRegion,
    zoom: input.zoom,
    nodes,
    landmarks: WILDS_FLAGSHIP_LANDMARKS.map((landmark) => ({ ...landmark, discovered: discovered.has(landmark.id) })),
    exactPlayers,
    playerClusters: [...clusters.values()],
    dynamicSites: (input.dynamicSites ?? [])
      .filter((site) => site.phase !== "expired")
      .map((site) => ({
        ...site,
        visibility: site.phase === "rumored" ? "signal" as const : site.phase === "memorialized" ? "memorial" as const : "exact" as const
      })),
    ecologySites: (input.ecologySites ?? [])
      .filter((site) => site.phase !== "expired")
      .map((site) => projectEcologySite(site, input.ecologyKnowledge?.[site.id])),
    bosses: (input.bosses ?? [])
      .filter((boss) => boss.phase !== "withdrawn")
      .map((boss) => projectAtlasBoss(boss, input.bossKnowledge?.[boss.id]))
  };
}

function projectAtlasBoss(boss: WildsWorldBossProjection, knowledge?: WildsBossKnowledge): WildsAtlasBoss {
  const ratio = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 0;
  const common: WildsAtlasBossCommon = {
    id: boss.id,
    familyId: boss.familyId as WildsBossFamilyId,
    name: String(boss.name ?? boss.familyId ?? "Unknown boss"),
    phase: boss.phase,
    healthBand: boss.phase === "defeated" || boss.phase === "memorialized" ? "defeated" : ratio > 0.8 ? "full" : ratio > 0.45 ? "steady" : ratio > 0.2 ? "wounded" : "critical",
    regionId: String(boss.regionId ?? "region:unknown"),
    territoryRadius: Number(boss.territoryRadius ?? 18),
    uncertaintyRadius: knowledge ? 0 : WILDS_REGION_SIZE * 0.8
  };
  const position = boss.position as { x: number; z: number } | undefined;
  if (!knowledge || !position) return { ...common, visibility: "rumor" };
  if (boss.phase === "memorialized") return { ...common, visibility: "historical", position: { ...position } };
  if (boss.phase === "defeated") return { ...common, visibility: "aftermath", position: { ...position } };
  return { ...common, visibility: boss.phase === "contested" || boss.phase === "transforming" || boss.phase === "vulnerable" ? "contested" : "exact", position: { ...position } };
}

function projectEcologySite(site: WildsWorldEcologyProjection, knowledge?: WildsEcologyKnowledge): WildsAtlasEcologySite {
  const common: WildsAtlasEcologyCommon = {
    id: site.id,
    familyId: site.familyId,
    name: site.name,
    phase: site.phase,
    intensity: site.intensity,
    region: site.region,
    radius: site.radius,
    activityId: site.activityId,
    audioMotif: site.audioMotif,
    aftermathModule: site.aftermathModule,
    parentSiteId: site.parentSiteId,
    uncertaintyRadius: 0
  };
  if (site.phase === "historical") return { ...common, visibility: "historical", position: { ...site.position } };
  if (site.phase === "aftermath") return { ...common, visibility: "aftermath", position: { ...site.position } };
  const known = knowledge?.visibility ?? "rumor";
  if (known === "exact" || known === "aftermath" || known === "historical") {
    return { ...common, visibility: "exact", position: { ...site.position } };
  }
  const visibility: Extract<WildsEcologyKnowledgeVisibility, "rumor" | "approximate"> = known === "approximate" ? "approximate" : "rumor";
  return { ...common, visibility, uncertaintyRadius: visibility === "rumor" ? WILDS_REGION_SIZE * 0.8 : WILDS_REGION_SIZE * 0.35 };
}
