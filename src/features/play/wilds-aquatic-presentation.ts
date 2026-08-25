import { sampleWildsTerrain, type WildsTerrainSample } from "./wilds-terrain-authority";
import { WILDS_WATERLINE_ELEVATION } from "./wilds-terrain-rendering";

export { WILDS_WATERLINE_ELEVATION } from "./wilds-terrain-rendering";

export type WildsAquaticPresentation = Readonly<{
  mode: "land" | "wade" | "blocked" | "swim";
  terrainElevation: number;
  waterSurfaceY: number;
  waterDepth: number;
  actorLocalY: number;
  actorWorldY: number;
  cameraSubmersionAllowed: boolean;
  scubaVisible: boolean;
}>;

export type WildsAquaticPresentationInput = Readonly<{
  terrain: WildsTerrainSample;
  canSwim: boolean;
  airborne: boolean;
}>;

export type WildsAquaticPositionInput = Readonly<{
  x: number;
  z: number;
  canSwim: boolean;
  airborne: boolean;
  supportElevation?: number | null;
}>;

let terrainProjections = 0;

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function projectWildsAquaticPresentation(input: WildsAquaticPresentationInput): WildsAquaticPresentation {
  const aquatic = input.terrain.surface === "shallow-water" || input.terrain.surface === "deep-water";
  const waterDepth = aquatic ? quantize(Math.max(0, WILDS_WATERLINE_ELEVATION - input.terrain.elevation)) : 0;
  const mode = input.airborne
    ? "land" as const
    : input.terrain.surface === "deep-water"
      ? input.canSwim ? "swim" as const : "blocked" as const
      : input.terrain.surface === "shallow-water"
        ? "wade" as const
        : "land" as const;
  const actorWorldY = mode === "swim"
    ? quantize(WILDS_WATERLINE_ELEVATION - Math.min(2.1, Math.max(1.35, waterDepth * 0.42)))
    : input.terrain.elevation;

  return Object.freeze({
    mode,
    terrainElevation: input.terrain.elevation,
    waterSurfaceY: WILDS_WATERLINE_ELEVATION,
    waterDepth,
    actorLocalY: mode === "swim" ? quantize(actorWorldY - input.terrain.elevation) : 0,
    actorWorldY,
    cameraSubmersionAllowed: mode === "swim",
    scubaVisible: mode === "swim"
  });
}

export function projectWildsAquaticPresentationAtPosition(input: WildsAquaticPositionInput) {
  terrainProjections += 1;
  const projected = projectWildsAquaticPresentation({
    terrain: sampleWildsTerrain(input.x, input.z),
    canSwim: input.canSwim,
    airborne: input.airborne
  });
  if (input.supportElevation === null || input.supportElevation === undefined || !Number.isFinite(input.supportElevation)) return projected;
  const elevation = quantize(input.supportElevation);
  return Object.freeze({
    mode: "land" as const,
    terrainElevation: elevation,
    waterSurfaceY: projected.waterSurfaceY,
    waterDepth: 0,
    actorLocalY: 0,
    actorWorldY: elevation,
    cameraSubmersionAllowed: false,
    scubaVisible: false
  });
}

export function wildsAquaticPresentationDiagnostics() {
  return Object.freeze({ terrainProjections });
}
