import { projectWildsBiome } from './wilds-biome';
import { WILDS_TERRAIN_TILE_SIZE, sampleWildsTerrain, distanceToWildsMajorRoute } from './wilds-terrain-authority';
import { wildsTerrainObstaclesForTile } from './wilds-terrain-obstacles';
import { KAI_N_DAY_MICRO } from './kai-klok-moment';
import { projectWildsFaunaMotion } from './wilds-fauna-motion';

/** Landscape fauna are gameplay individuals; they never become companion cards. */
export type WildsAnimalSpecies = 'ground-bird' | 'meadow-goat' | 'hare';
export type WildsWildAnimal = Readonly<{
  animalId: string;
  species: WildsAnimalSpecies;
  label: string;
  anchor: Readonly<{ x: number; y: number; z: number }>;
  capturable: boolean;
  product: 'wild-eggs' | 'wild-milk' | null;
  productFuelBreaths: number;
  meatFuelBreaths: number;
}>;
const CACHE = new Map<string, readonly WildsWildAnimal[]>();
const quantize = (v: number) => Math.round(v * 1e6) / 1e6;
function unit(seed: number, salt: number) {
  let n = Math.imul(seed ^ salt, 0x85ebca6b); n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15;
  return (n >>> 0) / 0xffffffff;
}
export function wildsWildAnimalsForTile(tileX: number, tileZ: number): readonly WildsWildAnimal[] {
  if (!Number.isSafeInteger(tileX) || !Number.isSafeInteger(tileZ) || Math.abs(tileX) > 41_666_667 || Math.abs(tileZ) > 41_666_667) return [];
  const key = `${tileX}:${tileZ}`, cached = CACHE.get(key); if (cached) return cached;
  const biome = projectWildsBiome(tileX, tileZ, 0, 0), animals: WildsWildAnimal[] = [];
  for (let slot = 0; slot < 2; slot++) {
    const x = quantize(tileX * WILDS_TERRAIN_TILE_SIZE + 2 + unit(biome.seed, 0x731d24 + slot * 17) * 8);
    const z = quantize(tileZ * WILDS_TERRAIN_TILE_SIZE + 2 + unit(biome.seed, 0x413ddb + slot * 31) * 8);
    const terrain = sampleWildsTerrain(x, z);
    if (terrain.slope > .45 || !['soil', 'grass'].includes(terrain.surface) || distanceToWildsMajorRoute(x, z) < 1.2
      || wildsTerrainObstaclesForTile(tileX, tileZ).some(o => Math.hypot(x - o.position.x, z - o.position.z) < o.radius + 1.2)) continue;
    const species: WildsAnimalSpecies = (['ground-bird', 'meadow-goat', 'hare'] as const)[Math.min(2, Math.floor(unit(biome.seed, 0x951db + slot * 13) * 3))]!;
    animals.push(Object.freeze({ animalId: `wildz.animal.v1:${tileX}:${tileZ}:${species}:${slot}`, species,
      label: species === 'ground-bird' ? 'Ground bird' : species === 'meadow-goat' ? 'Meadow goat' : 'Wild hare',
      anchor: Object.freeze({ x, y: terrain.elevation, z }), capturable: species !== 'hare',
      product: species === 'ground-bird' ? 'wild-eggs' : species === 'meadow-goat' ? 'wild-milk' : null,
      productFuelBreaths: species === 'ground-bird' ? 874.55 : species === 'meadow-goat' ? 1224.37 : 0,
      meatFuelBreaths: species === 'meadow-goat' ? 2098.92 : 1749.1 }));
  }
  const result = Object.freeze(animals); CACHE.set(key, result);
  while (CACHE.size > 256) CACHE.delete(CACHE.keys().next().value!);
  return result;
}
export function wildsWildAnimalById(animalId: unknown): WildsWildAnimal | null {
  if (typeof animalId !== 'string' || animalId.length > 160) return null;
  const m = /^wildz\.animal\.v1:(-?(?:0|[1-9][0-9]{0,8})):(-?(?:0|[1-9][0-9]{0,8})):(ground-bird|meadow-goat|hare):([01])$/.exec(animalId);
  return m ? wildsWildAnimalsForTile(Number(m[1]), Number(m[2])).find(a => a.animalId === animalId) ?? null : null;
}
type Habitat = Readonly<{ radius: number; elevations: Float64Array }>;
const HABITATS = new Map<string, Habitat>();
const GRID = 9;
function animalHabitat(animal: WildsWildAnimal): Habitat {
  const key = `${animal.animalId}|${animal.anchor.x}|${animal.anchor.y}|${animal.anchor.z}`;
  const cached = HABITATS.get(key); if (cached) return cached;
  let habitat: Habitat = { radius: 0, elevations: new Float64Array(GRID * GRID).fill(animal.anchor.y) };
  const padding = animal.species === 'meadow-goat' ? .55 : .3;
  // Verify a whole local habitat, not just a loop's perimeter. Every generated
  // curve stays inside it. Static ground heights are reused at render frequency.
  for (const radius of [.9, .6, .3, 0]) {
    if (!radius) break;
    let blocked = false;
    for (let tz = Math.floor((animal.anchor.z - radius - padding) / WILDS_TERRAIN_TILE_SIZE); tz <= Math.floor((animal.anchor.z + radius + padding) / WILDS_TERRAIN_TILE_SIZE); tz++) {
      for (let tx = Math.floor((animal.anchor.x - radius - padding) / WILDS_TERRAIN_TILE_SIZE); tx <= Math.floor((animal.anchor.x + radius + padding) / WILDS_TERRAIN_TILE_SIZE); tx++) {
        if (wildsTerrainObstaclesForTile(tx, tz).some(o => Math.hypot(animal.anchor.x - o.position.x, animal.anchor.z - o.position.z) < o.radius + radius + padding)) blocked = true;
      }
    }
    if (blocked) continue;
    const elevations = new Float64Array(GRID * GRID);
    for (let z = 0; z < GRID && !blocked; z++) for (let x = 0; x < GRID; x++) {
      const ground = sampleWildsTerrain(animal.anchor.x + (x / (GRID - 1) * 2 - 1) * radius,
        animal.anchor.z + (z / (GRID - 1) * 2 - 1) * radius);
      if (ground.slope > .55 || !['soil', 'grass'].includes(ground.surface)) { blocked = true; break; }
      elevations[z * GRID + x] = ground.elevation;
    }
    if (!blocked) { habitat = { radius, elevations }; break; }
  }
  HABITATS.set(key, habitat);
  while (HABITATS.size > 256) HABITATS.delete(HABITATS.keys().next().value!);
  return habitat;
}
function habitatHeight(habitat: Habitat, x: number, z: number) {
  if (!habitat.radius) return habitat.elevations[0]!;
  const gridX = (x / habitat.radius + 1) / 2 * (GRID - 1), gridZ = (z / habitat.radius + 1) / 2 * (GRID - 1);
  const ix = Math.min(GRID - 2, Math.max(0, Math.floor(gridX))), iz = Math.min(GRID - 2, Math.max(0, Math.floor(gridZ)));
  const fx = gridX - ix, fz = gridZ - iz;
  const lower = habitat.elevations[iz * GRID + ix]! * (1 - fx) + habitat.elevations[iz * GRID + ix + 1]! * fx;
  const upper = habitat.elevations[(iz + 1) * GRID + ix]! * (1 - fx) + habitat.elevations[(iz + 1) * GRID + ix + 1]! * fx;
  return lower * (1 - fz) + upper * fz;
}
export function projectWildsWildAnimalPosition(animal: WildsWildAnimal, kaiUPulse: number) {
  const habitat = animalHabitat(animal), motion = projectWildsFaunaMotion(animal.animalId, animal.species, kaiUPulse, habitat.radius);
  return { ...motion, position: { x: quantize(animal.anchor.x + motion.offset.x),
    y: quantize(habitatHeight(habitat, motion.offset.x, motion.offset.z)), z: quantize(animal.anchor.z + motion.offset.z) } };
}
export type WildsAnimalFoodReceipt = Readonly<{
  sourceId: string; animalId: string; action: 'hunt' | 'produce'; cycle: number; kaiUPulse: number;
}>;
export function wildsAnimalFoodSource(receipt: WildsAnimalFoodReceipt) {
  const animal = wildsWildAnimalById(receipt.animalId);
  if (!animal || !['hunt', 'produce'].includes(receipt.action) || !Number.isSafeInteger(receipt.cycle) || receipt.cycle < 0
    || !Number.isSafeInteger(receipt.kaiUPulse) || receipt.kaiUPulse < 0 || (receipt.action === 'hunt' && receipt.cycle !== 0)
    || (receipt.action === 'produce' && (!animal.product || receipt.cycle !== Number(BigInt(receipt.kaiUPulse) / KAI_N_DAY_MICRO)))
    || receipt.sourceId !== `wildz.animal-food.v1|${animal.animalId}|${receipt.action}|${receipt.cycle}`) return null;
  return { animal, foodKind: receipt.action === 'hunt' ? 'wild-meat' as const : animal.product!,
    label: receipt.action === 'hunt' ? `${animal.label} meat` : animal.product === 'wild-eggs' ? 'Wild eggs' : 'Wild milk',
    fuelBreaths: receipt.action === 'hunt' ? animal.meatFuelBreaths : animal.productFuelBreaths };
}
export function createWildsAnimalFoodReceipt(animal: WildsWildAnimal, action: 'hunt' | 'produce', cycle: number, kaiUPulse: number): WildsAnimalFoodReceipt {
  return { sourceId: `wildz.animal-food.v1|${animal.animalId}|${action}|${cycle}`, animalId: animal.animalId, action, cycle, kaiUPulse };
}
