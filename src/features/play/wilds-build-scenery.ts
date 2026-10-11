import { deeplyImmutable } from './wilds-construction-geometry';
import { WILDS_BUILD_FLAT_APRON, type WildsBuildFootprint } from './wilds-build-ground';
import { createWildsOrderedSpatialIndex } from './wilds-ordered-spatial-index';
import type { WildsTerrainObstacle } from './wilds-terrain-obstacles';

export type WildsBuildSceneryFootprint = Pick<WildsBuildFootprint, 'center' | 'yaw'> &
  Readonly<{ halfExtents: Readonly<{ x: number; z: number }> }>;
const indexes = new WeakMap<readonly WildsBuildSceneryFootprint[], ReturnType<typeof createWildsOrderedSpatialIndex<WildsBuildSceneryFootprint>>>();
let spatialIndexBuilds = 0;
export const wildsBuildSceneryDiagnostics = () => ({spatialIndexBuilds});
export const isWildsNaturalSceneryId = (id: string) => /^wildz\.terrain\.v1:-?\d+:-?\d+:(tree|rock):\d+$/.test(id) || /^waterfall-chute:[a-zA-Z0-9:._-]+:\d+$/.test(id);

/** Own the streamed projection so thousands of scenery queries reuse one index.
 * Imported coordinates stay mutable; their next projection observes changes. */
export function projectWildsBuildSceneryFootprints(footprints: readonly WildsBuildSceneryFootprint[]): readonly WildsBuildSceneryFootprint[] {
  return Object.freeze(footprints.map(pad => Object.freeze({
    center: Object.freeze({...pad.center}), halfExtents: Object.freeze({...pad.halfExtents}), yaw: pad.yaw
  })));
}

/** Disposable broad phase over admitted footprints. No proof work on movement frames. */
export function wildsBuildSceneryClearedAt(footprints: readonly WildsBuildSceneryFootprint[], x: number, z: number, radius = 0) {
  if (!footprints.length) return false;
  let nearby = indexes.get(footprints);
  if (!nearby) {
    spatialIndexBuilds++;
    nearby = createWildsOrderedSpatialIndex(footprints, pad => {
      const c = Math.abs(Math.cos(pad.yaw)), s = Math.abs(Math.sin(pad.yaw));
      const hx = c * (pad.halfExtents.x + WILDS_BUILD_FLAT_APRON) + s * (pad.halfExtents.z + WILDS_BUILD_FLAT_APRON);
      const hz = s * (pad.halfExtents.x + WILDS_BUILD_FLAT_APRON) + c * (pad.halfExtents.z + WILDS_BUILD_FLAT_APRON);
      return {minX: pad.center.x-hx, maxX: pad.center.x+hx, minZ: pad.center.z-hz, maxZ: pad.center.z+hz};
    });
    if (deeplyImmutable(footprints)) indexes.set(footprints, nearby);
  }
  for (const pad of nearby({minX:x-radius,maxX:x+radius,minZ:z-radius,maxZ:z+radius})) {
    const dx=x-pad.center.x,dz=z-pad.center.z,c=Math.cos(pad.yaw),s=Math.sin(pad.yaw);
    const outsideX = Math.max(0, Math.abs(dx*c-dz*s) - pad.halfExtents.x - WILDS_BUILD_FLAT_APRON),
      outsideZ = Math.max(0, Math.abs(dx*s+dz*c) - pad.halfExtents.z - WILDS_BUILD_FLAT_APRON);
    if (Math.hypot(outsideX, outsideZ) <= radius) return true;
  }
  return false;
}

export function filterWildsBuildScenery(obstacles: readonly WildsTerrainObstacle[], footprints: readonly WildsBuildSceneryFootprint[]) {
  if (!footprints.length) return obstacles;
  return obstacles.filter(obstacle => !isWildsNaturalSceneryId(obstacle.id)
    || !wildsBuildSceneryClearedAt(footprints,obstacle.position.x,obstacle.position.z,
      Math.max(obstacle.radius,obstacle.kind==='tree'?obstacle.visualScale*1.4:obstacle.radius)));
}
