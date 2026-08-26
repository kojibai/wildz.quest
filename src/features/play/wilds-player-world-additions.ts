import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import type { WildsOwnedWorldAdditions } from "./game-state";
import { verifyWildsConstructionSite } from "./wilds-construction-site";
import { verifyWildsHarvestedSourceState, verifyWildsMaterialLot, verifyWildsStructure } from "./wilds-steward-construction";
import { wildsMaterialCustodian, type WildsWorldProjection } from "./wilds-world-state";

function sortedRecord<T>(entries: Array<[string, T]>): Record<string, T> {
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function sameOwner(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase() || sameWildzPlayerCoordinate(left, right);
}

function mergeMaterialLifecycle(
  left: Pick<WildsOwnedWorldAdditions, "consumedMaterialLots" | "reservedMaterialLots" | "storedMaterialLots">,
  right: Pick<WildsOwnedWorldAdditions, "consumedMaterialLots" | "reservedMaterialLots" | "storedMaterialLots">
) {
  const consumedMaterialLots = { ...left.consumedMaterialLots, ...right.consumedMaterialLots };
  const storedMaterialLots = { ...left.storedMaterialLots, ...right.storedMaterialLots };
  const reservedMaterialLots = { ...left.reservedMaterialLots, ...right.reservedMaterialLots };
  for (const lotId of Object.keys(storedMaterialLots)) delete reservedMaterialLots[lotId];
  for (const lotId of Object.keys(consumedMaterialLots)) {
    delete storedMaterialLots[lotId];
    delete reservedMaterialLots[lotId];
  }
  return { consumedMaterialLots, reservedMaterialLots, storedMaterialLots };
}

export function projectWildsOwnedWorldAdditions(
  world: Pick<WildsWorldProjection, "constructionSites" | "structures" | "harvestedSources" | "materialLots" | "materialCustody" | "consumedMaterialLots" | "reservedMaterialLots" | "storedMaterialLots">,
  ownerReceizId: string
): WildsOwnedWorldAdditions {
  const materialLots = sortedRecord(Object.entries(world.materialLots).filter(([lotId, lot]) =>
    lotId === lot.lotId && verifyWildsMaterialLot(lot) && sameOwner(wildsMaterialCustodian(world, lot), ownerReceizId)));
  const ownedLotIds = new Set(Object.keys(materialLots));
  const ownedSourceIds = new Set(Object.values(materialLots).map((lot) => lot.source.sourceId));
  const materialState = (state: Record<string, string>) => sortedRecord(Object.entries(state)
    .filter(([lotId, targetId]) => ownedLotIds.has(lotId) && typeof targetId === "string" && targetId.length > 0));
  return {
    constructionSites: sortedRecord(Object.entries(world.constructionSites).filter(([siteId, site]) =>
      siteId === site.siteId && verifyWildsConstructionSite(site)
      && sameOwner(site.placedByReceizId, ownerReceizId))),
    structures: sortedRecord(Object.entries(world.structures).filter(([structureId, structure]) =>
      structureId === structure.structureId && verifyWildsStructure(structure)
      && sameOwner(structure.ownerReceizId, ownerReceizId))),
    harvestedSources: sortedRecord(Object.entries(world.harvestedSources).filter(([sourceId, source]) =>
      sourceId === source.sourceId && ownedSourceIds.has(sourceId) && verifyWildsHarvestedSourceState(source))),
    materialLots,
    materialCustody: sortedRecord(Object.entries(world.materialCustody ?? {}).filter(([lotId]) => ownedLotIds.has(lotId))),
    consumedMaterialLots: materialState(world.consumedMaterialLots),
    reservedMaterialLots: materialState(world.reservedMaterialLots),
    storedMaterialLots: materialState(world.storedMaterialLots)
  };
}

export function mergeWildsOwnedWorldAdditions(
  world: WildsWorldProjection,
  owned: WildsOwnedWorldAdditions
): WildsWorldProjection {
  const constructionSites = { ...world.constructionSites };
  for (const [siteId, saved] of Object.entries(owned.constructionSites)) {
    if (!verifyWildsConstructionSite(saved) || saved.siteId !== siteId) continue;
    const current = constructionSites[siteId];
    if (!current || current.revision < saved.revision) constructionSites[siteId] = saved;
  }
  const structures = { ...world.structures };
  for (const [structureId, saved] of Object.entries(owned.structures)) {
    if (!verifyWildsStructure(saved) || saved.structureId !== structureId) continue;
    if (!structures[structureId]) structures[structureId] = saved;
  }
  const materialLots = { ...world.materialLots };
  for (const [lotId, saved] of Object.entries(owned.materialLots)) {
    if (verifyWildsMaterialLot(saved) && saved.lotId === lotId && !materialLots[lotId]) materialLots[lotId] = saved;
  }
  const harvestedSources = { ...world.harvestedSources };
  for (const [sourceId, saved] of Object.entries(owned.harvestedSources)) {
    if (!verifyWildsHarvestedSourceState(saved) || saved.sourceId !== sourceId) continue;
    const current = harvestedSources[sourceId];
    if (!current || current.revision < saved.revision) harvestedSources[sourceId] = saved;
  }
  const materialLifecycle = mergeMaterialLifecycle(world, owned);
  return {
    ...world,
    constructionSites,
    structures,
    harvestedSources,
    materialLots,
    materialCustody: { ...world.materialCustody, ...(owned.materialCustody ?? {}) },
    ...materialLifecycle
  };
}

export function mergeWildsOwnedAdditionSets(
  left: WildsOwnedWorldAdditions,
  right: WildsOwnedWorldAdditions
): WildsOwnedWorldAdditions {
  const constructionSites = { ...left.constructionSites };
  for (const [siteId, candidate] of Object.entries(right.constructionSites)) {
    const current = constructionSites[siteId];
    if (verifyWildsConstructionSite(candidate) && (!current || current.revision < candidate.revision)) {
      constructionSites[siteId] = candidate;
    }
  }
  const structures = { ...left.structures };
  for (const [structureId, candidate] of Object.entries(right.structures)) {
    if (verifyWildsStructure(candidate) && !structures[structureId]) structures[structureId] = candidate;
  }
  const materialLots = { ...left.materialLots };
  for (const [lotId, candidate] of Object.entries(right.materialLots)) {
    if (verifyWildsMaterialLot(candidate) && !materialLots[lotId]) materialLots[lotId] = candidate;
  }
  const harvestedSources = { ...left.harvestedSources };
  for (const [sourceId, candidate] of Object.entries(right.harvestedSources)) {
    const current = harvestedSources[sourceId];
    if (verifyWildsHarvestedSourceState(candidate) && (!current || current.revision < candidate.revision)) harvestedSources[sourceId] = candidate;
  }
  const materialLifecycle = mergeMaterialLifecycle(left, right);
  return {
    constructionSites,
    structures,
    harvestedSources,
    materialLots,
    materialCustody: { ...(left.materialCustody ?? {}), ...(right.materialCustody ?? {}) },
    ...materialLifecycle
  };
}
