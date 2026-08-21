import type { WildsDiscoveryPhysicalNeighborhood, WildsDiscoverySiteProjection, WildsMountainField } from "./wilds-discovery-sites";

type SiteWater = WildsDiscoveryPhysicalNeighborhood["waterVolumes"][number];

export type WildsDiscoveryMountainSurface = Readonly<{
  id: string;
  shape: "terrain-ridge";
  columns: number;
  rows: number;
  positions: readonly number[];
  indices: readonly number[];
}>;

export type WildsDiscoveryWaterSurface = Readonly<{
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  thickness: 0.04;
}>;

const q = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

function mountainSurface(field: WildsMountainField): WildsDiscoveryMountainSurface {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const node of field.nodes) positions.push(node.x, node.topY, node.z);
  for (let row = 0; row < field.rows - 1; row += 1) {
    for (let column = 0; column < field.columns - 1; column += 1) {
      const northwest = row * field.columns + column;
      const northeast = northwest + 1;
      const southwest = northwest + field.columns;
      const southeast = southwest + 1;
      indices.push(northwest, southwest, northeast, northeast, southwest, southeast);
    }
  }
  return Object.freeze({
    id: field.id,
    shape: "terrain-ridge" as const,
    columns: field.columns,
    rows: field.rows,
    positions: Object.freeze(positions),
    indices: Object.freeze(indices)
  });
}

export function projectWildsDiscoverySiteVisuals(
  site: WildsDiscoverySiteProjection,
  mountainFields: readonly WildsMountainField[],
  waters: readonly SiteWater[]
) {
  const mountainSurfaces = site.mountain ? mountainFields.map(mountainSurface) : [];
  const waterSurfaces = waters
    .filter((water) => water.kind !== "waterfall")
    .map((water) => Object.freeze({
      id: water.id,
      x: water.center.x,
      y: q(water.center.y + water.halfExtents.y),
      z: water.center.z,
      width: q(water.halfExtents.x * 2),
      depth: q(water.halfExtents.z * 2),
      thickness: 0.04 as const
    }));
  return Object.freeze({ mountainSurfaces: Object.freeze(mountainSurfaces), waterSurfaces: Object.freeze(waterSurfaces) });
}
