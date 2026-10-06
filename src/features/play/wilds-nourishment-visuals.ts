import type { WildsNourishmentPlant } from './wilds-nourishment';
import { projectWildsTreePart } from './wilds-tree-structure';
import type { projectWildsObstaclePlacement } from './wilds-terrain-obstacles';
import type { WildsResourceBodyProjection } from './wilds-work-presentation';

type TreePlacement = ReturnType<typeof projectWildsObstaclePlacement> & { resourceBody?: WildsResourceBodyProjection };
/** Fruit shares the tree's rendered, harvested canopy. Cleared trees never leave floating fruit. */
export function projectWildsFruitAttachments(plant: WildsNourishmentPlant, tree: TreePlacement, remaining: number) {
  if (Math.hypot(tree.x, tree.z) < 13.6) return [];
  const seed = Math.sin((tree.x * 73 + tree.z * 137) * .0000137 + (tree.variant + 17) * 91.733) * 43758.5453123;
  const heading = (seed - Math.floor(seed)) * Math.PI * 2;
  const fallen = Boolean(tree.resourceBody?.tree.stumpVisible);
  return Array.from({ length: Math.max(0, Math.min(plant.capacity, Math.floor(remaining))) }, (_, index) => {
    const angle = index * 2.399963 + tree.variant * .8;
    const canopyPart = index % 2 ? 'upper' as const : 'lower' as const;
    const canopy = projectWildsTreePart(tree, canopyPart);
    const localX = Math.cos(angle) * (fallen ? .34 : canopy.scale[0] * .43);
    const localZ = Math.sin(angle) * (fallen ? .34 : canopy.scale[2] * .43);
    const radius = .065 + (index % 2) * .008;
    // Keep forgiving touch padding local to the fruit, outside the trunk corridor.
    const touchRadius = Math.min(.24, Math.max(radius, Math.hypot(localX, localZ) - tree.scale * .3));
    return { canopyPart, localX, localZ, fallen, radius, touchRadius, position: {
      x: plant.position.x + localX * Math.cos(heading) + localZ * Math.sin(heading),
      y: plant.position.y + (fallen ? radius : canopy.y - canopy.scale[1] * .16),
      z: plant.position.z + localZ * Math.cos(heading) - localX * Math.sin(heading)
    } };
  });
}
