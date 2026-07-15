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
};

export type WildsAtlasInput = {
  center: { x: number; z: number };
  zoom: WildsAtlasZoom;
  missionProgress: number;
  worldMastery: number;
  discoveredLandmarkIds: readonly (WildsLandmarkId | string)[];
  selfId: string;
  players: WildsPresence[];
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
    playerClusters: [...clusters.values()]
  };
}
