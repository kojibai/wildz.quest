import { projectWildsObstaclePlacement, type WildsTerrainObstacle } from "./wilds-terrain-obstacles";
import { projectWildsResourcePresentationAvailability, projectWildsResourceSourceForObstacle } from "./wilds-resource-authority";
import { projectWildsResourceBody, type WildsActiveWorkSource } from "./wilds-work-presentation";
import type { WildsWorldProjection } from "./wilds-world-state";

/** Scene-local cache. Clock ticks only invalidate GPU transforms when the
 * admitted capacity or the exact work animation actually changes. */
export function createWildsResourcePlacementProjector() {
  type Placement = ReturnType<typeof projectWildsObstaclePlacement> & {
    resourceBody: ReturnType<typeof projectWildsResourceBody>;
    working: boolean;
    workStartedAtMs: number | undefined;
  };
  const cache = new WeakMap<WildsTerrainObstacle, {
    source: ReturnType<typeof projectWildsResourceSourceForObstacle>;
    availableCapacity: number;
    placement: Placement;
  }>();
  let trees: Placement[] = [];
  let rocks: Placement[] = [];
  return (obstacles: readonly WildsTerrainObstacle[], harvested: WildsWorldProjection["harvestedSources"] | undefined,
    kaiUPulse: number, work: WildsActiveWorkSource | null | undefined) => {
    const nextTrees: Placement[] = [];
    const nextRocks: Placement[] = [];
    const currentKaiPulse = String(kaiUPulse);
    for (const obstacle of obstacles) {
      if (obstacle.kind !== "tree" && obstacle.kind !== "rock") continue;
      const cached = cache.get(obstacle);
      const source = cached?.source ?? projectWildsResourceSourceForObstacle(obstacle);
      const state = harvested?.[source.sourceId];
      const { availableCapacity } = projectWildsResourcePresentationAvailability(source, {
        admittedHarvestedCapacity: state?.harvestedCapacity ?? 0,
        lastHarvestKaiPulse: state?.lastHarvestKaiPulse ?? "0",
        currentKaiPulse
      });
      const working = work?.sourceId === source.sourceId;
      const workStartedAtMs = working ? work.startedAtMs : undefined;
      let placement = cached?.placement;
      if (!cached || cached.availableCapacity !== availableCapacity || placement?.working !== working
        || placement.workStartedAtMs !== workStartedAtMs) {
        placement = {
          ...projectWildsObstaclePlacement(obstacle),
          resourceBody: projectWildsResourceBody({ kind: source.kind === "timber" ? "timber" : "stone", capacity: source.capacity, availableCapacity }),
          working,
          workStartedAtMs
        };
        cache.set(obstacle, { source, availableCapacity, placement });
      }
      (obstacle.kind === "tree" ? nextTrees : nextRocks).push(placement!);
    }
    if (trees.length !== nextTrees.length || trees.some((item, index) => item !== nextTrees[index])) trees = nextTrees;
    if (rocks.length !== nextRocks.length || rocks.some((item, index) => item !== nextRocks[index])) rocks = nextRocks;
    return { trees, rocks };
  };
}
