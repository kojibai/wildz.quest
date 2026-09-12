import { createWildsOrderedSpatialIndex } from "./wilds-ordered-spatial-index";
import { createWildsConstructionGeometryProjector, deeplyImmutable } from "./wilds-construction-geometry";
import type { WildsWorldProjection } from "./wilds-world-state";

type Components = WildsWorldProjection["constructionComponents"];
export function indexWildsConstruction(components: Components) {
  return createWildsOrderedSpatialIndex(Object.values(components), component => {
    const { x, z } = component.transform.position;
    return { minX: x, maxX: x, minZ: z, maxZ: z };
  });
}
const indexes = new WeakMap<Components, ReturnType<typeof indexWildsConstruction>>();
export function nearbyWildsConstruction(components: Components, point: { x: number; z: number }, radius: number) {
  let query = indexes.get(components);
  if (!query) {
    if (!deeplyImmutable(components)) return Object.values(components);
    query = indexWildsConstruction(components);
    // Imported mutable proofs must never leave a stale authoritative index.
    indexes.set(components, query);
  }
  return query({ minX: point.x - radius, maxX: point.x + radius, minZ: point.z - radius, maxZ: point.z + radius });
}
type Materials = WildsWorldProjection["constructionMaterialContributions"];
type Work = WildsWorldProjection["constructionWorkContributions"];
const projectors = new WeakMap<Materials, WeakMap<Work, ReturnType<typeof createWildsConstructionGeometryProjector>>>();
export function constructionGeometryForCollections(materials: Materials, work: Work) {
  const cached = projectors.get(materials)?.get(work);
  if (cached) return cached;
  const project = createWildsConstructionGeometryProjector(Object.values(materials), Object.values(work));
  if (deeplyImmutable(materials) && deeplyImmutable(work)) {
    let byWork = projectors.get(materials);
    if (!byWork) { byWork = new WeakMap(); projectors.set(materials, byWork); }
    byWork.set(work, project);
  }
  return project;
}
