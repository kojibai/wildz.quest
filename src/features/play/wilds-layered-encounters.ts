import type { WildsTraversalCapability } from "./wilds-traversal-capabilities";
import { WILDS_WATERLINE_ELEVATION } from "./wilds-terrain-rendering";
import { sampleWildsTerrain, type WildsTerrainSurface } from "./wilds-terrain-authority";

export type WildsEncounterLayer = "ground" | "surface" | "water-column" | "seabed" | "air";
export type WildsEncounterInteractionLayer = "ground" | "water" | "air";

export type WildsLayeredEncounterProjection = Readonly<{
  version: "wildz.encounter-placement.v1";
  identity: string;
  x: number;
  z: number;
  layer: WildsEncounterLayer;
  worldY: number;
  interactionBand: Readonly<{ minY: number; maxY: number }>;
  requiredCapability: WildsTraversalCapability | null;
}>;

export type WildsEncounterSearchContext = Readonly<{
  layer: WildsEncounterInteractionLayer;
  worldY: number;
  interactionBand?: Readonly<{ minY: number; maxY: number }>;
  capabilities: readonly WildsTraversalCapability[];
}>;

type ProjectionInput = Readonly<{
  regionX: number;
  regionZ: number;
  slot: number;
  position: Readonly<{ x: number; z: number }>;
  surface: WildsTerrainSurface;
  shoreReachable: boolean;
  bootstrapAerial?: boolean;
}>;

const MAX_CACHE_SIZE = 128;
const cache = new Map<string, WildsLayeredEncounterProjection>();
let projectionsBuilt = 0;
let terrainSamples = 0;

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function assertedInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`wilds_layered_encounter_${name}_invalid`);
  return BigInt(value);
}

function hash64(regionX: number, regionZ: number, slot: number, salt: number) {
  let value = BigInt.asUintN(64,
    assertedInteger(regionX, "region_x") * 0x9e3779b185ebca87n
    ^ assertedInteger(regionZ, "region_z") * 0xc2b2ae3d27d4eb4fn
    ^ assertedInteger(slot, "slot") * 0x165667b19e3779f9n
    ^ BigInt(salt) * 0x85ebca77c2b2ae63n
  );
  value ^= value >> 30n;
  value = BigInt.asUintN(64, value * 0xbf58476d1ce4e5b9n);
  value ^= value >> 27n;
  value = BigInt.asUintN(64, value * 0x94d049bb133111ebn);
  value ^= value >> 31n;
  return BigInt.asUintN(64, value);
}

function hashUnit(regionX: number, regionZ: number, slot: number, salt: number) {
  const high53 = Number(hash64(regionX, regionZ, slot, salt) >> 11n);
  return high53 / 9_007_199_254_740_992;
}

function projectionKey(input: ProjectionInput) {
  if (!Number.isFinite(input.position.x) || !Number.isFinite(input.position.z)) throw new Error("wilds_layered_encounter_position_invalid");
  return `${input.regionX}:${input.regionZ}:${input.slot}:${quantize(input.position.x)}:${quantize(input.position.z)}:${input.surface}:${input.shoreReachable ? 1 : 0}:${input.bootstrapAerial ? 1 : 0}`;
}

function buildProjection(input: ProjectionInput): WildsLayeredEncounterProjection {
  const terrain = sampleWildsTerrain(input.position.x, input.position.z);
  terrainSamples += 1;
  const aquatic = input.surface === "shallow-water" || input.surface === "deep-water";
  const lane = hashUnit(input.regionX, input.regionZ, input.slot, 17);
  let layer: WildsEncounterLayer;
  let worldY: number;
  let requiredCapability: WildsTraversalCapability | null;

  if (aquatic) {
    const depth = Math.max(0, WILDS_WATERLINE_ELEVATION - terrain.elevation);
    if (input.shoreReachable || input.surface === "shallow-water") {
      layer = "surface";
      worldY = WILDS_WATERLINE_ELEVATION;
      requiredCapability = null;
    } else if (lane < .48) {
      layer = "water-column";
      const fraction = .34 + hashUnit(input.regionX, input.regionZ, input.slot, 23) * .34;
      worldY = Math.min(WILDS_WATERLINE_ELEVATION - .38, terrain.elevation + Math.max(.42, depth * fraction));
      requiredCapability = "swim";
    } else if (lane < .8) {
      layer = "seabed";
      worldY = terrain.elevation + .42;
      requiredCapability = "swim";
    } else {
      layer = "surface";
      worldY = WILDS_WATERLINE_ELEVATION;
      requiredCapability = "swim";
    }
  } else if (input.bootstrapAerial || lane < .24) {
    layer = "air";
    const altitudeLane = input.bootstrapAerial ? 0 : hashUnit(input.regionX, input.regionZ, input.slot, 31);
    if (altitudeLane < .46) {
      worldY = terrain.elevation + 1.35;
      requiredCapability = null;
    } else if (altitudeLane < .68) {
      worldY = terrain.elevation + 2.65;
      requiredCapability = "glide";
    } else {
      worldY = terrain.elevation + 4.5 + hashUnit(input.regionX, input.regionZ, input.slot, 37) * 4.5;
      requiredCapability = "flight";
    }
  } else {
    layer = "ground";
    worldY = terrain.elevation;
    requiredCapability = null;
  }

  projectionsBuilt += 1;
  const admittedY = quantize(worldY);
  return Object.freeze({
    version: "wildz.encounter-placement.v1",
    identity: `wildz.layer.v1:${input.regionX}:${input.regionZ}:${input.slot}:${hash64(input.regionX, input.regionZ, input.slot, 43).toString(16).padStart(16, "0")}`,
    x: quantize(input.position.x),
    z: quantize(input.position.z),
    layer,
    worldY: admittedY,
    interactionBand: Object.freeze({ minY: quantize(admittedY - .85), maxY: quantize(admittedY + .85) }),
    requiredCapability
  });
}

export function wildsEncounterActorLocomotion(layer: WildsEncounterLayer): "ground" | "swim" {
  return layer === "surface" || layer === "water-column" || layer === "seabed" ? "swim" : "ground";
}

export function projectWildsLayeredEncounter(input: ProjectionInput) {
  const key = projectionKey(input);
  const existing = cache.get(key);
  if (existing) return existing;
  const projection = buildProjection(input);
  cache.set(key, projection);
  while (cache.size > MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return projection;
}

export function wildsLayeredEncounterCacheSize() {
  return cache.size;
}

export function wildsLayeredEncounterDiagnostics() {
  return Object.freeze({ projectionsBuilt, terrainSamples });
}

export function wildsEncounterIsInteractable(
  encounter: Pick<WildsLayeredEncounterProjection, "layer" | "worldY" | "interactionBand" | "requiredCapability">,
  context: WildsEncounterSearchContext
) {
  if (!Number.isFinite(context.worldY)) return false;
  if (encounter.requiredCapability && !context.capabilities.includes(encounter.requiredCapability)) return false;
  if (encounter.layer === "water-column" || encounter.layer === "seabed") {
    if (context.layer !== "water" || !context.capabilities.includes("swim")) return false;
  } else if (encounter.layer === "air" && encounter.requiredCapability !== null && context.layer !== "air") {
    return false;
  } else if (encounter.layer === "surface" && encounter.requiredCapability === "swim" && context.layer !== "water") {
    return false;
  }
  const playerBand = context.interactionBand ?? { minY: context.worldY, maxY: context.worldY };
  if (!Number.isFinite(playerBand.minY) || !Number.isFinite(playerBand.maxY) || playerBand.minY > playerBand.maxY) return false;
  return playerBand.maxY >= encounter.interactionBand.minY && playerBand.minY <= encounter.interactionBand.maxY;
}
