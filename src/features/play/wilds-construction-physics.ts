import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsTerrainObstacle } from "./wilds-terrain-obstacles";
import { projectWildsConstructionStageGeometry } from "./wilds-construction-geometry";

export function projectWildsConstructionObstacles(world?: WildsWorldProjection | null): WildsTerrainObstacle[] {
  if (!world) return [];
  return Object.values(world.constructionComponents ?? {}).flatMap(component => {
    const geometry = projectWildsConstructionStageGeometry(component, Object.values(world.constructionMaterialContributions), Object.values(world.constructionWorkContributions));
    return geometry.solids.map(solid => ({ id: `wildz.component:${solid.id}`, kind: "structure" as const,
      material: "solid" as const, position: solid.center, radius: Math.hypot(solid.halfExtents.x, solid.halfExtents.z),
      shape: { kind: "box" as const, halfX: solid.halfExtents.x, halfY: solid.halfExtents.y, halfZ: solid.halfExtents.z }, visualScale: 1,
      airbornePolicy: "clearable" as const }));
  });
}
