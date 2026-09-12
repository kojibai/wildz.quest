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
export function resolveWildsConstructionFunction(world: WildsWorldProjection, id: string, kind: "workshop" | "storage" | "bed"): WildsConstructionFunctionSource | null {
  const component = world.constructionComponents[id];
  if (!component) return null;
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
export function resolveWildsCraftWorkstation(world: WildsWorldProjection, id: string): WildsCraftWorkstation | null {
  const legacy = world.structures[id];
  return legacy && verifyWildsCraftWorkstation(legacy) ? legacy : resolveWildsConstructionFunction(world, id, "workshop");
}
export function resolveWildsMaterialCache(world: WildsWorldProjection, id: string): WildsStructureV1 | WildsConstructionFunctionSource | null {
  const legacy = world.structures[id];
  return legacy && verifyWildsStructure(legacy) && legacy.blueprint === "trail-cache" ? legacy : resolveWildsConstructionFunction(world, id, "storage");
}
