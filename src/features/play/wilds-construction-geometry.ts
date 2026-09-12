import { createWildsExactProofCache } from "./wilds-exact-proof-cache";
import { verifyWildsConstructionComponent, projectWildsConstructionProgress, type WildsConstructionComponentV1, type WildsConstructionMaterialContributionV1, type WildsConstructionWorkContributionV1 } from "./wilds-construction-component";

// Only deeply frozen plain data can be reused by identity. Mutable imported proofs
// always go through the verifier; a proof head alone is never a cache key.
const immutableData = new WeakSet<object>();
function deeplyImmutable(value: unknown, active = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return typeof value !== "function" && typeof value !== "symbol";
  if (immutableData.has(value)) return true;
  if (active.size >= 64 || active.has(value) || !Object.isFrozen(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return false;
  active.add(value);
  const valid = Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return typeof key === "string" && "value" in descriptor && deeplyImmutable(descriptor.value, active);
  });
  active.delete(value);
  if (valid) immutableData.add(value);
  return valid;
}
type StageGeometry = { componentId: string; componentHead: string; stageGeometryDigest: string;
  stage: ReturnType<typeof projectWildsConstructionProgress>["stage"];
  solids: WildsConstructionComponentV1["placement"]["collisionSolids"]; anchors: WildsConstructionComponentV1["anchors"] };
const geometryKeys = createWildsExactProofCache({ maxEntries: 0 });
const serializedGeometry = new Map<string, string>();
let geometryBytes = 0;
const GEOMETRY_BYTE_LIMIT = 4 * 1024 * 1024;
const geometryCache = new WeakMap<WildsConstructionComponentV1, { materials: readonly WildsConstructionMaterialContributionV1[]; work: readonly WildsConstructionWorkContributionV1[]; result: StageGeometry }>();
const sameProofs = <T,>(left: readonly T[], right: readonly T[]) => left.length === right.length && left.every((proof, index) => proof === right[index]);

/** A framed stage selects authored catalog solids; openings never become gross boxes. */
export function projectWildsConstructionStageGeometry(component: WildsConstructionComponentV1, materials: readonly WildsConstructionMaterialContributionV1[], work: readonly WildsConstructionWorkContributionV1[]) {
  const reusable = deeplyImmutable(component) && materials.every(proof => deeplyImmutable(proof)) && work.every(proof => deeplyImmutable(proof));
  const cached = reusable ? geometryCache.get(component) : undefined;
  if (cached && sameProofs(cached.materials, materials) && sameProofs(cached.work, work)) return cached.result;
  const key = reusable ? null : geometryKeys.exactKey([component, materials, work]);
  if (key !== null) {
    const saved = serializedGeometry.get(key);
    if (saved !== undefined) {
      serializedGeometry.delete(key); serializedGeometry.set(key, saved);
      // No mutable caller can alter the stored result or another caller's geometry.
      return JSON.parse(saved) as StageGeometry;
    }
  }
  if (!verifyWildsConstructionComponent(component)) throw new Error("wilds_construction_geometry_lineage_invalid");
  const progress = projectWildsConstructionProgress(component, materials, work);
  const exact = component.kind === "stair" ? projectWildsConstructionStairs(component.placement) : component.placement.collisionSolids;
  const framed = component.kind === "room"
    ? exact.filter((solid) => solid.id.endsWith(":floor"))
    : exact.filter((solid) => !/:solid:(lintel|door-lintel|window-lintel|back|front-left|front-right)$/.test(solid.id));
  const result = {
    componentId: component.componentId,
    componentHead: component.head,
    stageGeometryDigest: component.stageGeometryDigest,
    stage: progress.stage,
    solids: progress.stage === "planned" ? [] : progress.stage === "framed" ? framed : exact,
    anchors: component.anchors
  };
  if (reusable) {
    Object.freeze(result.solids);
    Object.freeze(result);
    geometryCache.set(component, { materials: [...materials], work: [...work], result });
  }
  if (key !== null) {
    const saved = JSON.stringify(result);
    const bytes = (key.length + saved.length) * 2;
    if (bytes <= GEOMETRY_BYTE_LIMIT) {
      while (serializedGeometry.size >= 128 || geometryBytes + bytes > GEOMETRY_BYTE_LIMIT) {
        const oldest = serializedGeometry.keys().next().value;
        if (oldest === undefined) break;
        geometryBytes -= (oldest.length + serializedGeometry.get(oldest)!.length) * 2;
        serializedGeometry.delete(oldest);
      }
      serializedGeometry.set(key, saved); geometryBytes += bytes;
    }
  }
  return result;
}

/** Eight walkable treads share the catalog stair envelope and rotation. */
export function projectWildsConstructionStairs(placement: import("./wilds-world-construction").WildsBlueprintPlacement) {
  const center = placement.geometry.center;
  const turn = placement.transform.rotationQuarterTurns;
  return Array.from({ length: 8 }, (_, index) => {
    const localZ = -2 + (index + .5) * .5;
    const halfY = (index + 1) * .125;
    const dx = turn === 1 ? localZ : turn === 3 ? -localZ : 0;
    const dz = turn === 0 ? localZ : turn === 2 ? -localZ : 0;
    return { id: `${placement.placementId}:tread:${index}`, center: { x: center.x + dx, y: center.y - 1 + halfY, z: center.z + dz },
      halfExtents: { x: turn % 2 ? .25 : 1.2, y: halfY, z: turn % 2 ? 1.2 : .25 } };
  });
}

/** Group once per projection pass; the normal projector still verifies every relevant proof. */
export function createWildsConstructionGeometryProjector(
  materials: readonly WildsConstructionMaterialContributionV1[], work: readonly WildsConstructionWorkContributionV1[]
) {
  function group<T extends { componentId: string }>(proofs: readonly T[]) {
    const result = new Map<string, T[]>();
    for (const proof of proofs) {
      if (!proof || typeof proof.componentId !== "string") continue;
      const bucket = result.get(proof.componentId);
      if (bucket) bucket.push(proof);
      else result.set(proof.componentId, [proof]);
    }
    return result;
  }
  const materialGroups = group(materials), workGroups = group(work);
  return (component: WildsConstructionComponentV1) => projectWildsConstructionStageGeometry(
    component, materialGroups.get(component.componentId) ?? [], workGroups.get(component.componentId) ?? []
  );
}
