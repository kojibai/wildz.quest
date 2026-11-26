import { isAdmittedCreationProjection, type CreationPhysicalSnapshot } from "./creation/physical-store";
import type { CreationChunk } from "./creation/compiler";
import type { CreationPose } from "./creation/types";
import { WILDS_REGION_SIZE } from "./multiplayer-core";
import type { WildsAtlasProjection } from "./wilds-world-atlas";

export type WildsAtlasBuildingSource = Pick<CreationPhysicalSnapshot, "instances" | "projections">;
export type WildsAtlasBuildingMesh = { id: string; pose: CreationPose; chunks: readonly CreationChunk[] };

const maximumBuildings = 6;
const maximumPages = 18;
const maximumVertices = 24_000;
const focusedRadius = WILDS_REGION_SIZE * 2;

/** Mesh detail uses the same installed source as gameplay. Atlas visibility still comes from its existing marker projection. */
export function selectWildsAtlasBuildingMeshes(projection: Pick<WildsAtlasProjection, "gridCenterRegion" | "worldAdditions">, source?: WildsAtlasBuildingSource): WildsAtlasBuildingMesh[] {
  if (!source) return [];
  const centerX = (projection.gridCenterRegion.x + .5) * WILDS_REGION_SIZE;
  const centerZ = (projection.gridCenterRegion.z + .5) * WILDS_REGION_SIZE;
  const markers = projection.worldAdditions.flatMap(marker => {
    if (!marker.creationHead || marker.blueprint !== "custom-building" || marker.phase !== "complete") return [];
    const distance = Math.hypot(marker.position.x - centerX, marker.position.z - centerZ);
    return distance <= focusedRadius ? [{ marker, distance }] : [];
  }).sort((left, right) => left.distance - right.distance);
  if (!markers.length) return [];
  const projections = new Map(source.projections.map(candidate => [candidate.instanceId, candidate]));
  const buildings: WildsAtlasBuildingMesh[] = [];
  let pages = 0;
  let vertices = 0;
  for (const { marker } of markers) {
    if (buildings.length >= maximumBuildings || pages >= maximumPages) break;
    const instance = source.instances[marker.id];
    const projected = projections.get(marker.id);
    if (!instance || !projected || !isAdmittedCreationProjection(projected) || instance.head !== marker.creationHead || projected.head !== instance.head
      || instance.spaceId !== "wildz.space.outer.v1" || instance.ownerId !== marker.ownerReceizId) continue;
    const position = instance.pose.position;
    if (position.x !== marker.position.x || position.y !== marker.position.y || position.z !== marker.position.z) continue;
    const chunks: CreationChunk[] = [];
    for (const chunk of projected.chunks) {
      const count = chunk.positions.length / 3;
      if (pages >= maximumPages || vertices + count > maximumVertices) break;
      pages += 1;
      vertices += count;
      chunks.push(chunk);
    }
    if (chunks.length) buildings.push({ id: marker.id, pose: instance.pose, chunks });
  }
  return buildings;
}
