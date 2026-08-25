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

export function projectWildsStructureSupports(world?: Pick<WildsWorldProjection, "structures"> | null): readonly WildsStructureSupport[] {
  if (!world) return Object.freeze([]);
  return freeze(Object.values(world.structures)
    .filter((structure): structure is WildsTrailBridgeV1 => structure.blueprint === "trail-bridge" && structure.stage === "complete")
    .map((structure) => ({
      id: `wildz.support.v1:${structure.structureId}`,
      structureId: structure.structureId,
      deckY: structure.physical.deckY,
      center: { x: structure.position.x, z: structure.position.z },
      halfWidth: structure.physical.halfWidth,
      halfLength: structure.physical.halfLength,
      rotationQuarterTurns: structure.rotationQuarterTurns
    }))
    .sort((left, right) => left.id.localeCompare(right.id)));
}

export function wildsStructureSupportAt(
  point: Readonly<{ x: number; z: number }>,
  supports: readonly WildsStructureSupport[] | undefined,
  inset = 0
) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z) || !Number.isFinite(inset) || inset < 0) return null;
  for (const support of supports ?? []) {
    const deltaX = point.x - support.center.x;
    const deltaZ = point.z - support.center.z;
    const lengthCoordinate = support.rotationQuarterTurns % 2 === 0 ? deltaZ : deltaX;
    const widthCoordinate = support.rotationQuarterTurns % 2 === 0 ? deltaX : deltaZ;
    if (Math.abs(lengthCoordinate) <= support.halfLength - inset + .000001
      && Math.abs(widthCoordinate) <= support.halfWidth - inset + .000001) return support;
  }
  return null;
}
