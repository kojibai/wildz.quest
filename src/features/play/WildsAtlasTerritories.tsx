import { Html, Line } from "@react-three/drei";
import { atlasLocalCoordinate, wildsAtlasContainsWorld } from "./wilds-atlas-render-tiles";
import { WILDS_CITY_CELL_SIZE, wildsCityCellCenter, wildsCityPopulation, type WildsCity, type WildsCityCell } from "./wilds-city";
import type { WildsAtlasProjection } from "./wilds-world-atlas";

const cellKey = ({ x, z }: WildsCityCell) => `${x}:${z}`;
const edges = [
  { neighbor: [-1, 0], start: [0, 0], end: [0, 1] },
  { neighbor: [1, 0], start: [1, 0], end: [1, 1] },
  { neighbor: [0, -1], start: [0, 0], end: [1, 0] },
  { neighbor: [0, 1], start: [0, 1], end: [1, 1] }
] as const;

function boundaryLines(cells: readonly WildsCityCell[], projection: WildsAtlasProjection,
  height: (x: number, z: number, regionUnit: number) => number, color: string) {
  const occupied = new Set(cells.map(cellKey));
  const point = (x: number, z: number): [number, number, number] => [
    atlasLocalCoordinate(x, projection.centerRegion.x, projection.regionUnit),
    height(x, z, projection.regionUnit) + .06,
    atlasLocalCoordinate(z, projection.centerRegion.z, projection.regionUnit)
  ];
  return cells.flatMap(cell => {
    if (!wildsAtlasContainsWorld(projection.territory ?? projection.nodes, wildsCityCellCenter(cell))) return [];
    return edges.flatMap(({ neighbor, start, end }, index) => occupied.has(`${cell.x + neighbor[0]}:${cell.z + neighbor[1]}`) ? [] : [
      <Line key={`${cellKey(cell)}:${index}`} color={color} lineWidth={2.4} points={[
        point((cell.x + start[0]) * WILDS_CITY_CELL_SIZE, (cell.z + start[1]) * WILDS_CITY_CELL_SIZE),
        point((cell.x + end[0]) * WILDS_CITY_CELL_SIZE, (cell.z + end[1]) * WILDS_CITY_CELL_SIZE)
      ]} />
    ]);
  });
}

export function WildsAtlasTerritories({ projection, cities, draft, selectedId, height, onCity }: {
  projection: WildsAtlasProjection;
  cities: readonly WildsCity[];
  draft: readonly WildsCityCell[];
  selectedId?: string;
  height: (x: number, z: number, regionUnit: number) => number;
  onCity: (id: string) => void;
}) {
  return <group name="atlas-city-stewardship">
    {cities.map(city => {
      const { x, z } = city.anchor.position;
      const residents = wildsCityPopulation(city);
      return <group key={city.id}>
        {boundaryLines(city.cells, projection, height, city.id === selectedId ? "#91f4c2" : "#f7d875")}
        {wildsAtlasContainsWorld(projection.territory ?? projection.nodes, city.anchor.position) ?
          <Html center zIndexRange={[2, 1]} wrapperClass="wilds-atlas-interactive-label" position={[
            atlasLocalCoordinate(x, projection.centerRegion.x, projection.regionUnit),
            height(x, z, projection.regionUnit) + .64,
            atlasLocalCoordinate(z, projection.centerRegion.z, projection.regionUnit)
          ]}>
            <button type="button" className={`wilds-atlas-map-label wilds-atlas-city-label${city.id === selectedId ? " is-active" : ""}`}
              aria-label={`Inspect city ${city.name}. ${residents} ${residents === 1 ? "resident" : "residents"}${city.activeProposalId ? ". Vote open." : "."}`}
              onClick={event => { event.stopPropagation(); onCity(city.id); }}>
              {city.activeProposalId ? <span className="wilds-atlas-open-vote" aria-hidden="true" /> : null}
              {city.name}<small>{residents}</small>
            </button>
          </Html> : null}
      </group>;
    })}
    {boundaryLines(draft, projection, height, "#9bf2d0")}
  </group>;
}
