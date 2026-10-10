import type { WildsWorldCommand } from "./wilds-world-service";
import type { WildsWorldProjection } from "./wilds-world-state";

type Collection = "groves" | "stewardTools" | "structures" | "materialLots" | "resourceLots" | "resourcePackages" | "foodItems" | "creations" | "constructionProjects" | "constructionComponents" | "constructionSites" | "harvestedSources";
type Reference = readonly [Collection, string];
const has = (world: WildsWorldProjection | null, [collection, id]: Reference) => Boolean(world && Object.prototype.hasOwnProperty.call(world[collection] ?? {}, id));
const materials = (ids: readonly string[]): Reference[] => ids.map(id => ["materialLots", id]);

/** Choose a source before attempting a write. An accepted native asset remains
 * native even when reserved/consumed/stale; an error never changes its source. */
export function wildsWorldCommandSource(command: WildsWorldCommand, native: WildsWorldProjection | null, legacy: WildsWorldProjection | null): "native" | "legacy" {
  if (!native) return "native";
  let refs: Reference[];
  switch (command.type) {
    case "grove.observe": case "grove.act": refs = [["groves", command.grove.groveId]]; break;
    case "tool.steward.equip": refs = [["stewardTools", command.toolId]]; break;
    case "storage.material.move": refs = [["materialLots", command.lotId], ["structures", command.cacheId]]; break;
    case "resource.material.harvest": {
      const source: Reference = ["harvestedSources", command.source.sourceId];
      refs = [...(command.toolId ? [["stewardTools", command.toolId] as const] : []), ...(has(native, source) || has(legacy, source) ? [source] : [])]; break;
    }
    case "construction.component.place": refs = [["constructionProjects", command.projectId]]; break;
    case "construction.component.adjust": case "construction.component.work": refs = [["constructionComponents", command.componentId]]; break;
    case "construction.component.deposit": refs = [["constructionComponents", command.componentId], ...materials(command.lotIds)]; break;
    case "construction.component.maintain": refs = [["constructionComponents", command.componentId], ...materials(command.lotId ? [command.lotId] : [])]; break;
    case "construction.site.contribute": refs = [["constructionSites", command.siteId], ...materials(command.lotIds)]; break;
    case "construction.site.work": refs = [["constructionSites", command.siteId]]; break;
    case "creation.evolve": refs = [["creations", command.instanceId], ...materials(command.resources.map(resource => resource.id))]; break;
    case "creation.action": refs = [["creations", command.actionRequest.instanceId], ...(command.actionRequest.action === "damage" && command.actionRequest.equipmentId ? [["creations", command.actionRequest.equipmentId] as const] : [])]; break;
    case "resource.food.consume": refs = [["foodItems", command.itemId]]; break;
    case "resource.transfer.admit": refs = [["resourceLots", command.lotId]]; break;
    case "resource.material.transfer.admit": refs = [["materialLots", command.lotId]]; break;
    case "resource.package.native-adopt": return "native";
    default:
      if (command.type.startsWith("resource.package.") && "packageId" in command) refs = [["resourcePackages", command.packageId]];
      else return "native"; // Creation/genesis/new package commands use native admission.
  }
  // A mixed or unknown selection must never route a native asset through legacy
  // gameplay. Only wholly existing historical sources qualify for this path.
  return refs.length > 0 && refs.every(ref => has(legacy, ref) && !has(native, ref)) ? "legacy" : "native";
}

/** Display/history only: preserve lifecycle metadata with each historical lot.
 * Native preparation always reads the independently retained admitted replay. */
export function mergeWildsNativeWorldHistory(current: WildsWorldProjection, admitted: WildsWorldProjection): WildsWorldProjection {
  const lifecycle = <T>(before: Record<string, T> | undefined, after: Record<string, T> | undefined, sources: Record<string, unknown> | undefined) => ({
    ...Object.fromEntries(Object.entries(before ?? {}).filter(([id]) => !Object.hasOwn(sources ?? {}, id))), ...after
  });
  return { ...admitted,
    structures: { ...current.structures, ...admitted.structures },
    creations: { ...current.creations, ...admitted.creations },
    creationEvents: { ...current.creationEvents, ...admitted.creationEvents },
    constructionProjects: { ...current.constructionProjects, ...admitted.constructionProjects },
    constructionChunks: { ...current.constructionChunks, ...admitted.constructionChunks },
    constructionComponents: { ...current.constructionComponents, ...admitted.constructionComponents },
    constructionMaterialContributions: { ...current.constructionMaterialContributions, ...admitted.constructionMaterialContributions },
    constructionWorkContributions: { ...current.constructionWorkContributions, ...admitted.constructionWorkContributions },
    constructionCommandReceipts: { ...current.constructionCommandReceipts, ...admitted.constructionCommandReceipts },
    constructionConditions: { ...current.constructionConditions, ...admitted.constructionConditions },
    constructionSites: { ...current.constructionSites, ...admitted.constructionSites },
    harvestedSources: { ...current.harvestedSources, ...admitted.harvestedSources },
    groves: { ...current.groves, ...admitted.groves },
    stewardTools: { ...current.stewardTools, ...admitted.stewardTools },
    equippedStewardTools: { ...current.equippedStewardTools, ...admitted.equippedStewardTools },
    materialLots: { ...current.materialLots, ...admitted.materialLots },
    materialCustody: lifecycle(current.materialCustody, admitted.materialCustody, admitted.materialLots),
    consumedMaterialLots: lifecycle(current.consumedMaterialLots, admitted.consumedMaterialLots, admitted.materialLots),
    reservedMaterialLots: lifecycle(current.reservedMaterialLots, admitted.reservedMaterialLots, admitted.materialLots),
    storedMaterialLots: lifecycle(current.storedMaterialLots, admitted.storedMaterialLots, admitted.materialLots),
    resourceLots: { ...current.resourceLots, ...admitted.resourceLots },
    resourceCustody: lifecycle(current.resourceCustody, admitted.resourceCustody, admitted.resourceLots),
    reservedResourceLots: lifecycle(current.reservedResourceLots, admitted.reservedResourceLots, admitted.resourceLots),
    resourcePackages: { ...current.resourcePackages, ...admitted.resourcePackages },
    foodItems: { ...current.foodItems, ...admitted.foodItems },
    foodCustody: lifecycle(current.foodCustody, admitted.foodCustody, admitted.foodItems),
    reservedFoodItems: lifecycle(current.reservedFoodItems, admitted.reservedFoodItems, admitted.foodItems),
    consumedFoodItems: lifecycle(current.consumedFoodItems, admitted.consumedFoodItems, admitted.foodItems),
    foodConsumptionReceipts: lifecycle(current.foodConsumptionReceipts, admitted.foodConsumptionReceipts, admitted.foodItems)
  };
}

/** A Grove's emission ancestry belongs to the same source as that Grove. */
export function wildsWorldGroveSource(groveId: string, native: WildsWorldProjection | null, legacy: WildsWorldProjection | null): WildsWorldProjection | null {
  return has(native, ["groves", groveId]) ? native : has(legacy, ["groves", groveId]) ? legacy : native ?? legacy;
}
