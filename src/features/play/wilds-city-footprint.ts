import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { projectCreationPhysical } from "./creation/projection";
import { compileWorldCreationSource, creationWorldEventMatches } from "./creation/world-source";
import { projectWildsConstructionProgress, verifyWildsConstructionComponent, type WildsConstructionContributionReference } from "./wilds-construction-component";
import { constructionProofDigest, verifyWildsConstructionProject } from "./wilds-construction-project";
import { WILDS_FLAGSHIP_LANDMARKS } from "./wilds-landmarks";
import { verifyWildsMaterialLot, verifyWildsStructure } from "./wilds-steward-construction";
import { distanceToWildsMajorRoute, WILDS_LANDMARK_BLEND_APRON, wildsTerrainElevation, wildsTerrainWaterSurface } from "./wilds-terrain-authority";
import type { WildsWorldProjection } from "./wilds-world-state";

export const WILDS_CITY_CELL_SIZE = 6;
export const WILDS_CITY_MAX_CELLS = 9;
const CELL_HALF_WIDTH = WILDS_CITY_CELL_SIZE / 2;
// The terrain sampler clamps outside this extent. Civic cells must remain
// inside it so remote coordinates cannot claim an alias of clamped terrain.
const TERRAIN_EXTENT = 500_000_000;
const ROUTE_APRON = 1.1;

export type WildsCityCell = Readonly<{ x: number; z: number }>;
type Point = Readonly<{ x: number; z: number }>;
export type WildsCityAnchorReference = Readonly<{ kind: "structure" | "component" | "creation"; id: string; head: string }>;
export type WildsCityFoundingAnchor = WildsCityAnchorReference & Readonly<{ position: Point; label: string }>;
export type WildsCityAnchor = WildsCityFoundingAnchor & Readonly<{
  ownerReceizId: string;
  sourceEventId?: string;
  materialLots: readonly { id: string; head: string }[];
  work: readonly WildsConstructionContributionReference[];
}>;

export type WildsCityFootprintError =
  | "wilds_city_cells_invalid"
  | "wilds_city_anchor_cell_required"
  | "wilds_city_cells_disconnected"
  | "wilds_city_cell_route_protected"
  | "wilds_city_cell_landmark_protected"
  | "wilds_city_cell_water"
  | "wilds_city_cell_overlap"
  | "wilds_city_anchor_already_used";

export function wildsCityCellAt(point: Point): WildsCityCell {
  return { x: Math.floor(point.x / WILDS_CITY_CELL_SIZE), z: Math.floor(point.z / WILDS_CITY_CELL_SIZE) };
}

export function wildsCityCellCenter(cell: WildsCityCell): Point {
  return { x: cell.x * WILDS_CITY_CELL_SIZE + CELL_HALF_WIDTH, z: cell.z * WILDS_CITY_CELL_SIZE + CELL_HALF_WIDTH };
}

const cellKey = (cell: WildsCityCell) => `${cell.x}:${cell.z}`;
const own = <T>(map: Record<string, T>, key: string) => Object.hasOwn(map, key) ? map[key] : undefined;

function validCell(cell: unknown): cell is WildsCityCell {
  if (!cell || typeof cell !== "object" || Object.keys(cell).length !== 2 || !Object.hasOwn(cell, "x") || !Object.hasOwn(cell, "z")) return false;
  const { x, z } = cell as WildsCityCell;
  return [x, z].every(value => Number.isSafeInteger(value)
    && value * WILDS_CITY_CELL_SIZE >= -TERRAIN_EXTENT
    && (value + 1) * WILDS_CITY_CELL_SIZE <= TERRAIN_EXTENT);
}

function footprintCellBlocker(cell: WildsCityCell): WildsCityFootprintError | null {
  const center = wildsCityCellCenter(cell);
  for (const landmark of WILDS_FLAGSHIP_LANDMARKS) {
    const dx = Math.max(0, Math.abs(center.x - landmark.position.x) - CELL_HALF_WIDTH);
    const dz = Math.max(0, Math.abs(center.z - landmark.position.z) - CELL_HALF_WIDTH);
    if (Math.hypot(dx, dz) <= landmark.radius + WILDS_LANDMARK_BLEND_APRON) return "wilds_city_cell_landmark_protected";
  }
  // A cell is disjoint only when the distance from its center exceeds both
  // the authored route apron and the entire cell's half diagonal.
  if (distanceToWildsMajorRoute(center.x, center.z) <= ROUTE_APRON + Math.SQRT2 * CELL_HALF_WIDTH) return "wilds_city_cell_route_protected";
  for (const dx of [-CELL_HALF_WIDTH, 0, CELL_HALF_WIDTH]) {
    for (const dz of [-CELL_HALF_WIDTH, 0, CELL_HALF_WIDTH]) {
      if (wildsTerrainWaterSurface(wildsTerrainElevation(center.x + dx, center.z + dz))) return "wilds_city_cell_water";
    }
  }
  return null;
}

/** Reviews the recorded area around an improvement. It changes no terrain,
 * title, building permissions, public access, or resource custody. */
export function reviewWildsCityFootprint(
  world: Pick<WildsWorldProjection, "cities">,
  anchor: WildsCityFoundingAnchor,
  selection: readonly WildsCityCell[]
): { ok: true; cells: WildsCityCell[] } | { ok: false; reason: WildsCityFootprintError } {
  const reject = (reason: WildsCityFootprintError) => ({ ok: false as const, reason });
  if (!Array.isArray(selection) || selection.length < 1 || selection.length > WILDS_CITY_MAX_CELLS || !selection.every(validCell)) {
    return reject("wilds_city_cells_invalid");
  }
  const origin = wildsCityCellAt(anchor.position);
  if (!validCell(origin) || selection.some(cell => Math.abs(cell.x - origin.x) > 1 || Math.abs(cell.z - origin.z) > 1)) {
    return reject("wilds_city_cells_invalid");
  }
  const selected = new Set(selection.map(cellKey));
  if (selected.size !== selection.length) return reject("wilds_city_cells_invalid");
  if (!selected.has(cellKey(origin))) return reject("wilds_city_anchor_cell_required");
  const frontier = [origin];
  selected.delete(cellKey(origin));
  for (const cell of frontier) {
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const neighbor = { x: cell.x + dx, z: cell.z + dz };
      if (selected.delete(cellKey(neighbor))) frontier.push(neighbor);
    }
  }
  if (selected.size) return reject("wilds_city_cells_disconnected");
  const cities = Object.values(world.cities ?? {});
  if (cities.some(city => city.anchor.kind === anchor.kind && city.anchor.id === anchor.id)) return reject("wilds_city_anchor_already_used");
  const occupiedCells = new Set(cities.flatMap(city => city.cells.map(cellKey)));
  const cells = selection.map(({ x, z }) => ({ x: x === 0 ? 0 : x, z: z === 0 ? 0 : z })).sort((a, b) => a.x - b.x || a.z - b.z);
  for (const cell of cells) {
    const blocker = footprintCellBlocker(cell);
    if (blocker) return reject(blocker);
    if (occupiedCells.has(cellKey(cell))) return reject("wilds_city_cell_overlap");
  }
  return { ok: true, cells };
}

const labelFor = (kind: string) => kind.replace(/(^|-)([a-z])/g, (_match, separator: string, initial: string) => `${separator ? " " : ""}${initial.toUpperCase()}`);

function conservedLot(world: WildsWorldProjection, id: string, head: string, improvementId: string) {
  const lot = own(world.materialLots, id);
  return verifyWildsMaterialLot(lot) && lot.lotId === id && lot.head === head && own(world.consumedMaterialLots, id) === improvementId;
}

function resolveCreationAnchor(world: WildsWorldProjection, actorId: string, reference: WildsCityAnchorReference): WildsCityAnchor | null {
  const source = own(world.creations ?? {}, reference.id);
  const instance = source?.instance;
  if (!source || !instance || instance.instanceId !== reference.id || instance.head !== reference.head
    || !sameWildzPlayerCoordinate(actorId, instance.ownerId) || instance.spaceId !== "wildz.space.outer.v1"
    || !["functional", "finished"].includes(instance.stage) || !instance.embeddedResources.length
    || Object.values(instance.nodeStates).some(node => node.kind === "equipment")) return null;
  const event = own(world.creationEvents ?? {}, reference.id);
  if (!event) return null;
  try {
    if (!creationWorldEventMatches(source, event)) return null;
    const receipt = own(world.constructionCommandReceipts, event.causeId);
    const binding = event.payload as { commandDigest?: unknown };
    if (!receipt || receipt.actorId !== event.actorId || receipt.kind !== event.kind || receipt.commandDigest !== binding.commandDigest
      || receipt.eventPayloadDigest !== constructionProofDigest(event.payload)) return null;
    // The admitted build verified custody before consuming each lot. Keep the
    // exact spent source lineage across reopen, including imported materials.
    if (!instance.embeddedResources.every(({ id, head, kind, quantity }) => conservedLot(world, id, head, reference.id)
      && world.materialLots[id].kind === kind && world.materialLots[id].quantity === quantity)) return null;
    const physical = projectCreationPhysical(instance, source.command.definition, compileWorldCreationSource(source));
    if (!physical.solids.length) return null;
    const { x, z } = instance.pose.position;
    return { kind: "creation", id: instance.instanceId, head: instance.head, ownerReceizId: instance.ownerId,
      sourceEventId: event.eventId, position: { x, z }, label: "Built creation",
      materialLots: instance.embeddedResources.map(({ id, head }) => ({ id, head })), work: [] };
  } catch {
    return null;
  }
}

/** Re-derive the anchor from admitted construction and lot history. The
 * selected reference carries no ownership, terrain, or contribution claims. */
export function resolveWildsCityFoundingAnchor(
  world: WildsWorldProjection, actorId: string, reference: WildsCityAnchorReference
): WildsCityAnchor | null {
  if (reference.kind === "creation") return resolveCreationAnchor(world, actorId, reference);
  if (reference.kind === "structure") {
    const structure = own(world.structures, reference.id);
    if (!structure || structure.head !== reference.head || !sameWildzPlayerCoordinate(actorId, structure.ownerReceizId)
      || !verifyWildsStructure(structure) || structure.structureId !== reference.id || structure.blueprint === "trail-bridge") return null;
    const materialLots = structure.consumedLotIds.map((id, i) => ({ id, head: structure.consumedLotHeads[i]! }));
    if (!materialLots.every(lot => conservedLot(world, lot.id, lot.head, reference.id))) return null;
    const { x, z } = structure.position;
    return { kind: "structure", id: structure.structureId, head: structure.head, ownerReceizId: structure.ownerReceizId,
      position: { x, z }, label: labelFor(structure.blueprint), materialLots, work: [] };
  }
  const component = own(world.constructionComponents, reference.id);
  if (!component || component.head !== reference.head || !sameWildzPlayerCoordinate(actorId, component.ownerReceizId)
    || !verifyWildsConstructionComponent(component) || component.componentId !== reference.id
    || (component.evidence.spaceId ?? "wildz.space.outer.v1") !== "wildz.space.outer.v1") return null;
  const project = own(world.constructionProjects, component.projectId);
  if (!verifyWildsConstructionProject(project) || !sameWildzPlayerCoordinate(project.ownerReceizId, actorId)) return null;
  const materials = Object.values(world.constructionMaterialContributions).filter(value => value.componentId === component.componentId);
  const work = Object.values(world.constructionWorkContributions).filter(value => value.componentId === component.componentId);
  const progress = projectWildsConstructionProgress(component, materials, work);
  if ((progress.stage !== "functional" && progress.stage !== "finished") || progress.allocationConflicts.length || progress.invalidWorkContributionIds.length) return null;
  const embedded = progress.stages.filter(stage => stage.complete).flatMap(stage => stage.allocatedLots);
  if (!embedded.length || !embedded.every(lot => conservedLot(world, lot.lotId, lot.lotHead, reference.id))) return null;
  const applied = new Set(progress.appliedWorkContributionIds);
  if (!embedded.some(lot => sameWildzPlayerCoordinate(lot.contributorReceizId, actorId))
    && !work.some(proof => applied.has(proof.contributionId) && sameWildzPlayerCoordinate(proof.worker.receizId, actorId))) return null;
  const { x, z } = component.transform.position;
  return { kind: "component", id: component.componentId, head: component.head, ownerReceizId: component.ownerReceizId,
    position: { x, z }, label: `${project.name} · ${labelFor(component.kind)}`,
    materialLots: embedded.map(lot => ({ id: lot.lotId, head: lot.lotHead })), work: progress.appliedWork };
}

export function wildsCityFoundingAnchors(world: WildsWorldProjection, actorId: string): WildsCityFoundingAnchor[] {
  const refs: WildsCityAnchorReference[] = [
    ...Object.values(world.structures).map(({ structureId: id, head }) => ({ kind: "structure" as const, id, head })),
    ...Object.values(world.constructionComponents).map(({ componentId: id, head }) => ({ kind: "component" as const, id, head })),
    ...Object.values(world.creations ?? {}).map(({ instance }) => ({ kind: "creation" as const, id: instance.instanceId, head: instance.head }))
  ];
  return refs.flatMap(reference => {
    const anchor = resolveWildsCityFoundingAnchor(world, actorId, reference);
    if (!anchor || !reviewWildsCityFootprint(world, anchor, [wildsCityCellAt(anchor.position)]).ok) return [];
    const { kind, id, head, position, label } = anchor;
    return [{ kind, id, head, position, label }];
  }).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}
