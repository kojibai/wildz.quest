import { createWildsConstructionGeometryProjector } from "./wilds-construction-geometry";
import type { WildsTrailBridgeV1 } from "./wilds-steward-construction";
import type { WildsWorldProjection } from "./wilds-world-state";

export const WILDS_TRAIL_BRIDGE_HALF_WIDTH = 1.5 as const;
export const WILDS_TRAIL_BRIDGE_HALF_LENGTH = 4 as const;
export const WILDS_TRAIL_BRIDGE_DECK_HALF_HEIGHT = .12 as const;
export const WILDS_TRAIL_BRIDGE_RAIL_HEIGHT = 1.05 as const;
export const WILDS_TRAIL_BRIDGE_RAIL_HALF_THICKNESS = .08 as const;

export type WildsStructureSupport = Readonly<{
  id: string;
  structureId: string;
  deckY: number;
  center: Readonly<{ x: number; z: number }>;
  halfWidth: number;
  halfLength: number;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
}>;

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

export function projectWildsStructureSupports(world?: Pick<WildsWorldProjection, "structures"> & Partial<Pick<WildsWorldProjection, "constructionComponents" | "constructionMaterialContributions" | "constructionWorkContributions">> | null, spaceId="wildz.space.outer.v1"): readonly WildsStructureSupport[] {
  if (!world) return Object.freeze([]);
  const projectGeometry = createWildsConstructionGeometryProjector(Object.values(world.constructionMaterialContributions ?? {}), Object.values(world.constructionWorkContributions ?? {}));
  const components: WildsStructureSupport[] = Object.values(world.constructionComponents ?? {}).filter(c=>(c.evidence.spaceId??"wildz.space.outer.v1")===spaceId).flatMap(component => {
    const geometry = projectGeometry(component);
    if (geometry.stage === "planned") return [];
    if (!["foundation", "floor", "room", "roof", "stair", "bridge", "platform", "path"].includes(component.kind)) return [];
    return geometry.solids.filter(solid => component.kind !== "room" || solid.id.endsWith(":floor")).map(solid => ({
      id: `wildz.support.component:${solid.id}`, structureId: component.componentId, deckY: solid.center.y + solid.halfExtents.y,
      center: { x: solid.center.x, z: solid.center.z }, halfWidth: solid.halfExtents.x, halfLength: solid.halfExtents.z, rotationQuarterTurns: 0 as const
    }));
  });
  return freeze(Object.values(world.structures)
    .filter((structure): structure is WildsTrailBridgeV1 => spaceId==="wildz.space.outer.v1" && structure.blueprint === "trail-bridge" && structure.stage === "complete")
    .map((structure): WildsStructureSupport => ({
      id: `wildz.support.v1:${structure.structureId}`,
      structureId: structure.structureId,
      deckY: structure.physical.deckY,
      center: { x: structure.position.x, z: structure.position.z },
      halfWidth: structure.physical.halfWidth,
      halfLength: structure.physical.halfLength,
      rotationQuarterTurns: structure.rotationQuarterTurns
    }))
    .concat(components)
    .sort((left, right) => left.id.localeCompare(right.id)));
}

const supportIndexes = new WeakMap<readonly WildsStructureSupport[], Map<string, WildsStructureSupport[]>>();

function nearbySupports(supports: readonly WildsStructureSupport[], point: Readonly<{ x: number; z: number }>) {
  if (supports.length < 64) return supports;
  let cells = supportIndexes.get(supports);
  if (!cells) {
    cells = new Map();
    for (const support of supports) {
      const turned = support.rotationQuarterTurns % 2 !== 0;
      const x = (turned ? support.halfLength : support.halfWidth) + .000001;
      const z = (turned ? support.halfWidth : support.halfLength) + .000001;
      // Unusually large imported geometry keeps the exhaustive path.
      if (!Number.isFinite(x + z) || x > 128 || z > 128) return supports;
      for (let cz = Math.floor((support.center.z - z) / 16); cz <= Math.floor((support.center.z + z) / 16); cz++) {
        for (let cx = Math.floor((support.center.x - x) / 16); cx <= Math.floor((support.center.x + x) / 16); cx++) {
          const key = `${cx}:${cz}`;
          const entries = cells.get(key) ?? [];
          entries.push(support);
          cells.set(key, entries);
        }
      }
    }
    supportIndexes.set(supports, cells);
  }
  return cells.get(`${Math.floor(point.x / 16)}:${Math.floor(point.z / 16)}`) ?? [];
}

export function wildsStructureSupportAt(
  point: Readonly<{ x: number; z: number }>,
  supports: readonly WildsStructureSupport[] | undefined,
  inset = 0,
  footY?: number
) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z) || !Number.isFinite(inset) || inset < 0) return null;
  let best: WildsStructureSupport | null = null;
  for (const support of nearbySupports(supports ?? [], point)) {
    if (support.id.startsWith("wildz.support.component:") && Number.isFinite(footY) && support.deckY > footY! + .65) continue;
    const deltaX = point.x - support.center.x;
    const deltaZ = point.z - support.center.z;
    const lengthCoordinate = support.rotationQuarterTurns % 2 === 0 ? deltaZ : deltaX;
    const widthCoordinate = support.rotationQuarterTurns % 2 === 0 ? deltaX : deltaZ;
    if (Math.abs(lengthCoordinate) <= support.halfLength - (support.id.startsWith("wildz.support.component:") ? Math.min(inset, support.halfLength * .1) : inset) + .000001
      && Math.abs(widthCoordinate) <= support.halfWidth - (support.id.startsWith("wildz.support.component:") ? Math.min(inset, support.halfWidth * .1) : inset) + .000001) { if (!best || support.deckY > best.deckY) best = support; }
  }
  return best;
}
