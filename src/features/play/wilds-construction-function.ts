import { deeplyImmutable } from "./wilds-construction-geometry";
import { projectWildsConstructionProgress, verifyWildsConstructionComponent, verifyWildsMaterialContribution, verifyWildsWorkContribution, type WildsConstructionComponentV1, type WildsConstructionMaterialContributionV1, type WildsConstructionWorkContributionV1 } from "./wilds-construction-component";
import { verifyWildsStructure, type WildsStewardWorkbenchV1, type WildsStructureV1 } from "./wilds-steward-construction";
import type { WildsWorldProjection } from "./wilds-world-state";

/** Evidence remains a component, never a fabricated legacy structure. */
export type WildsConstructionFunctionSource = Readonly<{
  schema: "wildz.construction-function-source.v1";
  component: WildsConstructionComponentV1;
  materials: readonly WildsConstructionMaterialContributionV1[];
  work: readonly WildsConstructionWorkContributionV1[];
  structureId: string;
  head: string;
  ownerReceizId: string;
  position: WildsConstructionComponentV1["transform"]["position"];
}>;
export type WildsCraftWorkstation = WildsStewardWorkbenchV1 | WildsConstructionFunctionSource;
export function verifyWildsConstructionFunctionSource(value: unknown, kind: "workshop" | "storage" | "bed"): value is WildsConstructionFunctionSource {
  try {
    const source = value as WildsConstructionFunctionSource;
    const c = source.component;
    if (source.schema !== "wildz.construction-function-source.v1" || !verifyWildsConstructionComponent(c) || c.kind !== kind
      || source.structureId !== c.componentId || source.head !== c.head || source.ownerReceizId !== c.ownerReceizId
      || source.position.x !== c.transform.position.x || source.position.y !== c.transform.position.y || source.position.z !== c.transform.position.z
      || !Array.isArray(source.materials) || !Array.isArray(source.work)) return false;
    const lineage = (proof: { componentId: string; componentHead: string; projectId: string }) => proof.componentId === c.componentId && proof.componentHead === c.head && proof.projectId === c.projectId;
    if (source.materials.some((proof) => !verifyWildsMaterialContribution(proof) || !lineage(proof))
      || source.work.some((proof) => !verifyWildsWorkContribution(proof) || !lineage(proof))) return false;
    const progress = projectWildsConstructionProgress(c, source.materials, source.work);
    return (progress.stage === "functional" || progress.stage === "finished") && !progress.allocationConflicts.length && !progress.invalidWorkContributionIds.length;
  } catch { return false; }
}
export function verifyWildsCraftWorkstation(value: unknown): value is WildsCraftWorkstation {
  return (verifyWildsStructure(value) && value.blueprint === "steward-workbench") || verifyWildsConstructionFunctionSource(value, "workshop");
}
function resolveWildsConstructionFunctionUncached(world: WildsWorldProjection, id: string, kind: "workshop" | "storage" | "bed"): WildsConstructionFunctionSource | null {
  const component = world.constructionComponents[id];
  if (!component || component.kind !== kind || (kind !== "storage" && (world.constructionConditions?.[id]?.integrity ?? 100) < 50)) return null;
  const source: WildsConstructionFunctionSource = { schema: "wildz.construction-function-source.v1", component,
    materials: Object.values(world.constructionMaterialContributions).filter((p) => p.componentId === id),
    work: Object.values(world.constructionWorkContributions).filter((p) => p.componentId === id),
    structureId: id, head: component.head, ownerReceizId: component.ownerReceizId, position: component.transform.position };
  if (!verifyWildsConstructionFunctionSource(source, kind)) return null;
  const progress = projectWildsConstructionProgress(component, source.materials, source.work);
  if (progress.embeddedLotIds.some((lotId) => world.consumedMaterialLots[lotId] !== id
    || !source.materials.some((proof) => proof.lotId === lotId && world.materialLots[lotId]?.head === proof.lotHead))) return null;
  return source;
}
// Cache exact immutable source collections, including negative results. Actor
// movement changes none of these; a new proof or custody map creates a new key.
type FunctionCacheLevel = WeakMap<object, FunctionCacheLevel | Map<string, WildsConstructionFunctionSource | null>>;
const functionCache: FunctionCacheLevel = new WeakMap();
const noConditions = Object.freeze({});
export function resolveWildsConstructionFunction(world: WildsWorldProjection, id: string, kind: "workshop" | "storage" | "bed"): WildsConstructionFunctionSource | null {
  const keys = [world.constructionComponents, world.constructionMaterialContributions, world.constructionWorkContributions, world.constructionConditions ?? noConditions, world.consumedMaterialLots, world.materialLots];
  if (!keys.every(key => key && deeplyImmutable(key))) return resolveWildsConstructionFunctionUncached(world, id, kind);
  // Fixed-depth trie avoids hashing full collections on every walking update.
  let level = functionCache;
  for (const key of keys.slice(0, -1)) {
    let next = level.get(key!) as FunctionCacheLevel | undefined;
    if (!next) { next = new WeakMap(); level.set(key!, next); }
    level = next;
  }
  const last = keys[keys.length - 1]!;
  let values = level.get(last) as Map<string, WildsConstructionFunctionSource | null> | undefined;
  if (!values) { values = new Map(); level.set(last, values); }
  const pin = `${kind}:${id}`;
  if (values.has(pin)) return values.get(pin)!;
  const result = resolveWildsConstructionFunctionUncached(world, id, kind);
  if (result) { Object.freeze(result.materials); Object.freeze(result.work); Object.freeze(result); }
  values.set(pin, result);
  return result;
}
export function resolveWildsCraftWorkstation(world: WildsWorldProjection, id: string): WildsCraftWorkstation | null {
  const legacy = world.structures[id];
  return legacy && verifyWildsCraftWorkstation(legacy) ? legacy : resolveWildsConstructionFunction(world, id, "workshop");
}
export function resolveWildsMaterialCache(world: WildsWorldProjection, id: string): WildsStructureV1 | WildsConstructionFunctionSource | null {
  const legacy = world.structures[id];
  return legacy && verifyWildsStructure(legacy) && legacy.blueprint === "trail-cache" ? legacy : resolveWildsConstructionFunction(world, id, "storage");
}
