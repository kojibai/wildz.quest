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
import type { WildsTrainerProjection } from "./wilds-saga-trainers";
import type { WildsConstructionSiteV1 } from "./wilds-construction-site";
import type { WildsStructureV1 } from "./wilds-steward-construction";
import {
  wildsExplorationBounds,
  wildsExplorationContainsRegion,
  wildsExplorationContainsWorld,
  wildsExplorationRegions,
  type WildsExplorationAtlas
} from "./wilds-exploration-atlas";

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

export type WildsAtlasWorldAddition = {
  id: string;
  blueprint: WildsConstructionSiteV1["blueprint"] | WildsStructureV1["blueprint"];
  phase: "construction" | "complete";
  ownerReceizId: string;
  position: { x: number; y: number; z: number };
  progress: number;
};

export type WildsAtlasProjection = {
  /** Physical region-space origin used to normalize exact world coordinates for rendering. */
  centerRegion: { x: number; z: number };
  /** Region-index center used to choose a bounded Region or Landmark grid window. */
  gridCenterRegion: { x: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; count: number };
  regionUnit: number;
  zoom: WildsAtlasZoom;
  nodes: WildsAtlasNode[];
  landmarks: WildsAtlasLandmark[];
  exactPlayers: WildsAtlasExactPlayer[];
  playerClusters: WildsAtlasPlayerCluster[];
  dynamicSites: (WildsWorldSiteProjection & { visibility: "signal" | "exact" | "memorial" })[];
  ecologySites: WildsAtlasEcologySite[];
  bosses: WildsAtlasBoss[];
  trainers: WildsTrainerProjection[];
  worldAdditions: WildsAtlasWorldAddition[];
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
  /** Stable render-space origin for this atlas session. It must not follow discovery bounds. */
  atlasOrigin?: { x: number; z: number };
  zoom: WildsAtlasZoom;
  missionProgress: number;
  worldMastery: number;
  discoveredLandmarkIds: readonly (WildsLandmarkId | string)[];
  selfId: string;
  players: WildsPresence[];
  explorationAtlas: WildsExplorationAtlas;
  dynamicSites?: readonly WildsWorldSiteProjection[];
  ecologySites?: readonly WildsWorldEcologyProjection[];
  ecologyKnowledge?: Record<string, WildsEcologyKnowledge>;
  bosses?: readonly WildsWorldBossProjection[];
  trainers?: readonly WildsTrainerProjection[];
  constructionSites?: readonly WildsConstructionSiteV1[];
  structures?: readonly WildsStructureV1[];
  bossKnowledge?: Record<string, WildsBossKnowledge>;
  now?: number;
};

const radiusByZoom: Record<WildsAtlasZoom, number> = {
  world: 4,
  region: 2,
  landmark: 1
};

export const WILDS_ATLAS_REGION_UNIT = 1.35;
const DEFAULT_ATLAS_ORIGIN = Object.freeze({ x: 0.5, z: 0.5 });

type VisibleRegion = Pick<WildsAtlasNode, "regionX" | "regionZ">;

function regionKey(regionX: number, regionZ: number) {
  return `${regionX}:${regionZ}`;
}

function visibleRegionKeys(regions: readonly VisibleRegion[]) {
  return new Set(regions.map((region) => regionKey(region.regionX, region.regionZ)));
}

function worldPositionBelongsToNodes(position: { x: number; z: number }, nodeKeys: ReadonlySet<string>) {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
  const region = regionForPosition(position);
  return nodeKeys.has(regionKey(region.x, region.z));
}

export function filterWildsAtlasPresence(
  presence: { exactPlayers: readonly WildsAtlasExactPlayer[]; playerClusters: readonly WildsAtlasPlayerCluster[] },
  visibleRegions: readonly VisibleRegion[]
) {
  const nodeKeys = visibleRegionKeys(visibleRegions);
  return {
    exactPlayers: presence.exactPlayers.filter((player) => worldPositionBelongsToNodes(player, nodeKeys)),
    playerClusters: presence.playerClusters.filter((cluster) => nodeKeys.has(regionKey(cluster.regionX, cluster.regionZ)))
  };
}

export function projectWildsAtlasPresence(
  input: Pick<WildsAtlasInput, "center" | "now" | "players" | "selfId" | "explorationAtlas"> & {
    visibleRegions?: readonly VisibleRegion[];
  }
) {
  const projectedRegionKeys = input.visibleRegions ? visibleRegionKeys(input.visibleRegions) : null;
  const visiblePlayers = expirePresence(input.players, input.now)
    .filter((player) => player.playerId !== input.selfId)
    .filter((player) => wildsExplorationContainsWorld(input.explorationAtlas, player))
    .filter((player) => {
      if (!projectedRegionKeys) return true;
      const region = regionForPosition(player);
      return projectedRegionKeys.has(regionKey(region.x, region.z));
    })
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
  return { exactPlayers, playerClusters: [...clusters.values()] };
}

export function projectWildsAtlas(input: WildsAtlasInput): WildsAtlasProjection {
  const bounds = wildsExplorationBounds(input.explorationAtlas);
  const gridCenterRegion = input.zoom === "world"
    ? { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 }
    : regionForPosition(input.center);
  // Keep one immutable physical projection. Discovery changes what exists, never the
  // size or position of terrain that was already visible.
  const centerRegion = input.atlasOrigin ?? DEFAULT_ATLAS_ORIGIN;
  const regionUnit = WILDS_ATLAS_REGION_UNIT;
  const nodes: WildsAtlasNode[] = [];
  const regions = input.zoom === "world"
    ? wildsExplorationRegions(input.explorationAtlas)
    : localKnownRegions(input.explorationAtlas, gridCenterRegion, radiusByZoom[input.zoom]);
  for (const { x: regionX, z: regionZ } of regions) {
    nodes.push({
      id: `region:${regionX}:${regionZ}`,
      regionX,
      regionZ,
      biome: projectWildsBiome(regionX, regionZ, input.missionProgress, input.worldMastery)
    });
  }

  const nodeKeys = visibleRegionKeys(nodes);
  const knownPosition = (position: { x: number; z: number }) => worldPositionBelongsToNodes(position, nodeKeys);
  const presence = projectWildsAtlasPresence({ ...input, visibleRegions: nodes });

  const discovered = new Set(input.discoveredLandmarkIds);
  return {
    centerRegion,
    gridCenterRegion,
    bounds,
    regionUnit,
    zoom: input.zoom,
    nodes,
    landmarks: WILDS_FLAGSHIP_LANDMARKS
      .filter((landmark) => knownPosition(landmark.position))
      .map((landmark) => ({ ...landmark, discovered: discovered.has(landmark.id) })),
    exactPlayers: presence.exactPlayers,
    playerClusters: presence.playerClusters,
    dynamicSites: (input.dynamicSites ?? [])
      .filter((site) => site.phase !== "expired")
      .filter((site) => knownPosition(site.position))
      .map((site) => ({
        ...site,
        visibility: site.phase === "rumored" ? "signal" as const : site.phase === "memorialized" ? "memorial" as const : "exact" as const
      })),
    ecologySites: (input.ecologySites ?? [])
      .filter((site) => site.phase !== "expired")
      .filter((site) => knownPosition(site.position))
      .map((site) => projectEcologySite(site, input.ecologyKnowledge?.[site.id])),
    bosses: (input.bosses ?? [])
      .filter((boss) => boss.phase !== "withdrawn")
      .filter((boss) => {
        const position = boss.position as { x: number; z: number } | undefined;
        return Boolean(position && knownPosition(position));
      })
      .map((boss) => projectAtlasBoss(boss, input.bossKnowledge?.[boss.id])),
    trainers: (input.trainers ?? [])
      .filter((trainer) => trainer.available)
      .filter((trainer) => knownPosition({ x: trainer.position[0], z: trainer.position[2] })),
    worldAdditions: [
      ...(input.constructionSites ?? [])
        .filter((site) => site.stage !== "complete")
        .filter((site) => knownPosition(site.position))
        .map((site) => ({
          id: site.siteId,
          blueprint: site.blueprint,
          phase: "construction" as const,
          ownerReceizId: site.placedByReceizId,
          position: { ...site.position },
          progress: Math.max(0, Math.min(1, (
            site.contributedLots.length / (site.materialsRequired.timber + site.materialsRequired.stone) * .8
          ) + site.workCompleted * .2))
        })),
      ...(input.structures ?? [])
        .filter((structure) => knownPosition(structure.position))
        .map((structure) => ({
          id: structure.structureId,
          blueprint: structure.blueprint,
          phase: "complete" as const,
          ownerReceizId: structure.ownerReceizId,
          position: { ...structure.position },
          progress: 1
        }))
    ].sort((left, right) => left.id.localeCompare(right.id))
  };
}

function *localKnownRegions(
  explorationAtlas: WildsExplorationAtlas,
  center: { x: number; z: number },
  radius: number
) {
  for (let z = center.z - radius; z <= center.z + radius; z += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (wildsExplorationContainsRegion(explorationAtlas, x, z)) yield { x, z };
    }
  }
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
