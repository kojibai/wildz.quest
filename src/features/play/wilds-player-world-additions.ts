import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import type { WildsOwnedWorldAdditions } from "./game-state";
import { verifyWildsConstructionSite } from "./wilds-construction-site";
import { verifyWildsStructure } from "./wilds-steward-construction";
import type { WildsWorldProjection } from "./wilds-world-state";

function sortedRecord<T>(entries: Array<[string, T]>): Record<string, T> {
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function sameOwner(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase() || sameWildzPlayerCoordinate(left, right);
}

export function projectWildsOwnedWorldAdditions(
  world: Pick<WildsWorldProjection, "constructionSites" | "structures">,
  ownerReceizId: string
): WildsOwnedWorldAdditions {
  return {
    constructionSites: sortedRecord(Object.entries(world.constructionSites).filter(([siteId, site]) =>
      siteId === site.siteId && verifyWildsConstructionSite(site)
      && sameOwner(site.placedByReceizId, ownerReceizId))),
    structures: sortedRecord(Object.entries(world.structures).filter(([structureId, structure]) =>
      structureId === structure.structureId && verifyWildsStructure(structure)
      && sameOwner(structure.ownerReceizId, ownerReceizId)))
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
  return { ...world, constructionSites, structures };
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
  return { constructionSites, structures };
}
