import { KAI_N_DAY_MICRO } from './kai-klok-moment';
import { projectWildsBiome } from './wilds-biome';
import { WILDS_FLAGSHIP_LANDMARKS } from './wilds-landmarks';
import { WILDS_LANDMARK_BLEND_APRON, WILDS_TERRAIN_TILE_SIZE, distanceToWildsMajorRoute, sampleWildsTerrain } from './wilds-terrain-authority';
import { wildsTerrainObstaclesForTile } from './wilds-terrain-obstacles';
import { PLAYER_BREATH_CAPACITY_MICRO } from './player-breath-energy';
import { wildsAnimalFoodSource, type WildsAnimalFoodReceipt } from './wilds-animal-ecology';
import type { WildsLivestockState } from './wilds-livestock';

/** These are finite gameplay resources, not Native proofs or authenticated ownership. */
export type WildsFoodKind = 'orchard-fruit' | 'wild-berries' | 'wild-vegetable' | 'wild-eggs' | 'wild-milk' | 'wild-meat';
export type WildsNourishmentPlant = Readonly<{
  sourceId: string;
  kind: 'fruit-tree' | 'berry-bush' | 'wild-vegetable';
  terrainTreeId?: string;
  canopyHeight?: number;
  label: string;
  foodKind: WildsFoodKind;
  position: Readonly<{ x: number; y: number; z: number }>;
  capacity: number;
  regrowthDays: number;
  fuelBreaths: number;
}>;
export type WildsNourishmentSourceState = Readonly<{
  schema: 'wildz.nourishment-crop.v1';
  sourceId: string;
  cropDay: number;
  harvested: number;
  lastKaiUPulse: number;
}>;
export type WildsNourishmentSources = Readonly<Record<string, WildsNourishmentSourceState>>;
export type WildsFoodItem = Readonly<{
  schema: 'wildz.food-item.v1';
  itemId: string;
  ownerReceizId: string;
  sourceId: string;
  foodKind: WildsFoodKind;
  cropDay: number;
  slot: number;
  gatheredKaiUPulse: number;
  consumedKaiUPulse?: number;
  consumedFuelMicroBreaths?: number;
}>;
export type WildsNourishmentState = Readonly<{
  schema: 'wildz.player-nourishment.v1';
  ownerReceizId: string;
  lastKaiUPulse: number;
  /** Owner's observed checkpoint; multiplayer must supply its admitted shared source map. */
  sources: WildsNourishmentSources;
  items: Readonly<Record<string, WildsFoodItem>>;
  animalFoodSources: Readonly<Record<string, WildsAnimalFoodReceipt>>;
}>;
export const WILDS_NOURISHMENT_GATHER_REACH = 2.6;
export const WILDS_NOURISHMENT_VERTICAL_REACH = 1.8;
export const WILDS_NOURISHMENT_PACK_CAPACITY = 128;
export const WILDS_NOURISHMENT_DIGESTION_UPULSES = 120_000_000;
export const WILDS_NOURISHMENT_DIGESTION_FUEL_MICRO = Math.round(PLAYER_BREATH_CAPACITY_MICRO * .28);
const MAX_TILE = Math.ceil(500_000_000 / WILDS_TERRAIN_TILE_SIZE);
const TILE_CACHE_CAPACITY = 256;
const tileCache = new Map<string, readonly WildsNourishmentPlant[]>();
const integer = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
const validOwner = (owner: unknown): owner is string => typeof owner === 'string' && owner.length > 0 && owner.length <= 512 && owner.trim() === owner;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const quantize = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
function unit(seed: number, salt: number) {
  let value = Math.imul(seed ^ salt, 0x85ebca6b);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}
function cropDayAt(plant: WildsNourishmentPlant, kaiUPulse: number) {
  return Math.floor(Number(BigInt(kaiUPulse) / KAI_N_DAY_MICRO) / plant.regrowthDays) * plant.regrowthDays;
}
function freezePlant(plant: WildsNourishmentPlant) {
  return Object.freeze({ ...plant, position: Object.freeze({ ...plant.position }) });
}

/** Stable terrain identities and dry, traversable ground determine the actual plants. */
export function wildsNourishmentPlantsForTile(tileX: number, tileZ: number): readonly WildsNourishmentPlant[] {
  if (!Number.isSafeInteger(tileX) || !Number.isSafeInteger(tileZ) || Math.abs(tileX) > MAX_TILE || Math.abs(tileZ) > MAX_TILE) return [];
  const key = `${tileX}:${tileZ}`, cached = tileCache.get(key);
  if (cached) return cached;
  const biome = projectWildsBiome(tileX, tileZ, 0, 0), plants: WildsNourishmentPlant[] = [];
  for (const tree of wildsTerrainObstaclesForTile(tileX, tileZ)) {
    if (tree.kind !== 'tree') continue;
    const slot = Number(tree.id.split(':').at(-1));
    plants.push(freezePlant({ sourceId: `wildz.nourishment.v1:${tileX}:${tileZ}:fruit-tree:${slot}`, kind: 'fruit-tree', terrainTreeId: tree.id, canopyHeight: tree.shape.kind === 'cylinder' ? tree.shape.height * .76 : 2.4,
      label: 'Wild fruit', foodKind: 'orchard-fruit', position: tree.position, capacity: 3, regrowthDays: 2, fuelBreaths: 1049.46 }));
  }
  for (let slot = 0; slot < biome.ecology.bushCount; slot++) {
    const x = quantize(tileX * WILDS_TERRAIN_TILE_SIZE + 0.8 + unit(biome.seed, 0x17d4eb2d + slot * 31) * (WILDS_TERRAIN_TILE_SIZE - 1.6));
    const z = quantize(tileZ * WILDS_TERRAIN_TILE_SIZE + 0.8 + unit(biome.seed, 0x61c64e6d + slot * 43) * (WILDS_TERRAIN_TILE_SIZE - 1.6));
    const terrain = sampleWildsTerrain(x, z);
    if (terrain.slope > .55 || !['soil', 'grass'].includes(terrain.surface) || distanceToWildsMajorRoute(x, z) < .85
      || WILDS_FLAGSHIP_LANDMARKS.some(landmark => Math.hypot(x - landmark.position.x, z - landmark.position.z) < landmark.radius + WILDS_LANDMARK_BLEND_APRON)
      || wildsTerrainObstaclesForTile(tileX, tileZ).some(obstacle => Math.hypot(x - obstacle.position.x, z - obstacle.position.z) < obstacle.radius + .7)) continue;
    const vegetable = slot % 3 === 0;
    plants.push(freezePlant({ sourceId: `wildz.nourishment.v1:${tileX}:${tileZ}:${vegetable ? 'wild-vegetable' : 'berry-bush'}:${slot}`,
      kind: vegetable ? 'wild-vegetable' : 'berry-bush', label: vegetable ? 'Wild vegetables' : 'Wild berries',
      foodKind: vegetable ? 'wild-vegetable' : 'wild-berries', position: { x, y: terrain.elevation, z },
      capacity: vegetable ? 2 : 3, regrowthDays: 1, fuelBreaths: vegetable ? 1399.28 : 699.64 }));
  }
  const result = Object.freeze(plants.sort((a, b) => a.sourceId.localeCompare(b.sourceId)));
  tileCache.set(key, result);
  while (tileCache.size > TILE_CACHE_CAPACITY) tileCache.delete(tileCache.keys().next().value!);
  return result;
}
export function wildsNourishmentPlantById(sourceId: unknown): WildsNourishmentPlant | null {
  if (typeof sourceId !== 'string' || sourceId.length > 160) return null;
  const match = /^wildz\.nourishment\.v1:(-?(?:0|[1-9][0-9]{0,8})):(-?(?:0|[1-9][0-9]{0,8})):(fruit-tree|berry-bush|wild-vegetable):([0-9])$/.exec(sourceId);
  if (!match) return null;
  return wildsNourishmentPlantsForTile(Number(match[1]), Number(match[2])).find(plant => plant.sourceId === sourceId) ?? null;
}
function validSourceState(value: unknown, plant: WildsNourishmentPlant): value is WildsNourishmentSourceState {
  return record(value) && exactKeys(value, ['schema', 'sourceId', 'cropDay', 'harvested', 'lastKaiUPulse'])
    && value.schema === 'wildz.nourishment-crop.v1' && value.sourceId === plant.sourceId && integer(value.lastKaiUPulse)
    && integer(value.cropDay) && value.cropDay === cropDayAt(plant, value.lastKaiUPulse)
    && integer(value.harvested, plant.capacity);
}

/** Calendar Kai crops do not accumulate missed harvests while a player is absent. */
export function wildsNourishmentSourceAt(plant: WildsNourishmentPlant, checkpoint: WildsNourishmentSourceState | undefined, kaiUPulse: number) {
  if (!integer(kaiUPulse)) throw Error('wilds_nourishment_time_invalid');
  const cropDay = cropDayAt(plant, kaiUPulse);
  const valid = checkpoint === undefined || (validSourceState(checkpoint, plant) && checkpoint.lastKaiUPulse <= kaiUPulse);
  const harvested = valid && checkpoint?.cropDay === cropDay ? checkpoint.harvested : 0;
  const remaining = valid ? plant.capacity - harvested : 0;
  // A head is a compare-and-swap gameplay marker, never an authentication claim.
  const head = valid ? `wildz.crop.v1|${plant.sourceId}|${cropDay}|${harvested}` : '';
  return { valid, cropDay, harvested, remaining, head,
    nextRegrowthKaiUPulse: Number(BigInt(cropDay + plant.regrowthDays) * KAI_N_DAY_MICRO) };
}
export function projectWildsNourishmentPlants(input: {
  player: Readonly<{ x: number; z: number; y?: number }>;
  radius: number;
  kaiUPulse: number;
  sourceStates?: WildsNourishmentSources;
  spaceId?: string;
}) {
  if (!Number.isFinite(input.player.x) || !Number.isFinite(input.player.z) || !Number.isFinite(input.radius) || input.radius < 0 || !integer(input.kaiUPulse)) return [];
  if (input.spaceId && input.spaceId !== 'wildz.space.outer.v1') return [];
  const radius = Math.min(input.radius, 96), result: (WildsNourishmentPlant & ReturnType<typeof wildsNourishmentSourceAt> & { distance: number; canGather: boolean })[] = [];
  const minX = Math.floor((input.player.x - radius) / WILDS_TERRAIN_TILE_SIZE), maxX = Math.floor((input.player.x + radius) / WILDS_TERRAIN_TILE_SIZE);
  const minZ = Math.floor((input.player.z - radius) / WILDS_TERRAIN_TILE_SIZE), maxZ = Math.floor((input.player.z + radius) / WILDS_TERRAIN_TILE_SIZE);
  for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) for (const plant of wildsNourishmentPlantsForTile(x, z)) {
    const distance = Math.hypot(input.player.x - plant.position.x, input.player.z - plant.position.z);
    if (distance > radius) continue;
    const crop = wildsNourishmentSourceAt(plant, input.sourceStates?.[plant.sourceId], input.kaiUPulse);
    const verticalReach = input.player.y === undefined || (Number.isFinite(input.player.y) && Math.abs(input.player.y - plant.position.y) <= WILDS_NOURISHMENT_VERTICAL_REACH);
    result.push({ ...plant, ...crop, distance, canGather: crop.remaining > 0 && distance <= WILDS_NOURISHMENT_GATHER_REACH && verticalReach });
  }
  return result.sort((a, b) => a.distance - b.distance || a.sourceId.localeCompare(b.sourceId));
}
export function createWildsNourishmentState(ownerReceizId: string): WildsNourishmentState {
  if (!validOwner(ownerReceizId)) throw Error('wilds_nourishment_owner_invalid');
  return { schema: 'wildz.player-nourishment.v1', ownerReceizId, lastKaiUPulse: 0, sources: {}, items: {}, animalFoodSources: {} };
}
function foodItemId(owner: string, sourceId: string, cropDay: number, slot: number) {
  return `wildz.food.v1|${encodeURIComponent(owner)}|${sourceId}|${cropDay}|${slot}`;
}
function validItem(value: unknown, owner: string, sources: WildsNourishmentSources, lastKaiUPulse: number, animalSources: Readonly<Record<string, WildsAnimalFoodReceipt>> = {}): value is WildsFoodItem {
  if (!record(value) || !exactKeys(value, ['schema', 'itemId', 'ownerReceizId', 'sourceId', 'foodKind', 'cropDay', 'slot', 'gatheredKaiUPulse', ...(value.consumedKaiUPulse === undefined ? [] : ['consumedKaiUPulse']), ...(value.consumedFuelMicroBreaths === undefined ? [] : ['consumedFuelMicroBreaths'])])) return false;
  const plant = wildsNourishmentPlantById(value.sourceId);
  const animalReceipt = typeof value.sourceId === 'string' ? animalSources[value.sourceId] : undefined;
  const animalFood = animalReceipt ? wildsAnimalFoodSource(animalReceipt) : null;
  const food = plant ?? animalFood;
  if (!food || value.schema !== 'wildz.food-item.v1' || value.ownerReceizId !== owner || value.foodKind !== food.foodKind
    || !integer(value.gatheredKaiUPulse, lastKaiUPulse) || !integer(value.cropDay)
    || !integer(value.slot, plant?.capacity ?? 1) || value.slot < 1 || value.itemId !== foodItemId(owner, String(value.sourceId), value.cropDay, value.slot)
    || (value.consumedFuelMicroBreaths !== undefined && (value.consumedKaiUPulse === undefined || !integer(value.consumedFuelMicroBreaths, Math.round(food.fuelBreaths * 1_000_000))))
    || (value.consumedKaiUPulse !== undefined && (!integer(value.consumedKaiUPulse, lastKaiUPulse) || value.consumedKaiUPulse < value.gatheredKaiUPulse))) return false;
  if (animalFood && animalReceipt) return value.cropDay === animalReceipt.cycle && value.gatheredKaiUPulse === animalReceipt.kaiUPulse;
  if (!plant || value.cropDay !== cropDayAt(plant, value.gatheredKaiUPulse)) return false;
  const source = sources[plant.sourceId];
  return Boolean(source && source.lastKaiUPulse >= value.gatheredKaiUPulse && source.cropDay >= value.cropDay
    && (source.cropDay > value.cropDay || source.harvested >= value.slot));
}

/** Restores local evidence structurally; it provides no Native admission or cross-player authenticity. */
export function restoreWildsNourishmentState(value: unknown, ownerReceizId: string | undefined): WildsNourishmentState | undefined {
  if (!validOwner(ownerReceizId) || !record(value) || !exactKeys(value, ['schema', 'ownerReceizId', 'lastKaiUPulse', 'sources', 'items', ...(value.animalFoodSources === undefined ? [] : ['animalFoodSources'])])
    || value.schema !== 'wildz.player-nourishment.v1' || value.ownerReceizId !== ownerReceizId || !integer(value.lastKaiUPulse) || !record(value.sources) || !record(value.items)) return undefined;
  const sources: Record<string, WildsNourishmentSourceState> = {}, items: Record<string, WildsFoodItem> = {};
  const animalFoodSources: Record<string, WildsAnimalFoodReceipt> = {};
  if (record(value.animalFoodSources)) for (const [key, receipt] of Object.entries(value.animalFoodSources)) {
    if (record(receipt) && exactKeys(receipt, ['sourceId', 'animalId', 'action', 'cycle', 'kaiUPulse']) && key === receipt.sourceId
      && integer(receipt.kaiUPulse, value.lastKaiUPulse) && wildsAnimalFoodSource(receipt as WildsAnimalFoodReceipt)) animalFoodSources[key] = { ...receipt } as WildsAnimalFoodReceipt;
  }
  for (const [key, source] of Object.entries(value.sources)) {
    const plant = wildsNourishmentPlantById(key);
    if (plant && validSourceState(source, plant) && source.lastKaiUPulse <= value.lastKaiUPulse) sources[key] = { ...source };
  }
  for (const [key, item] of Object.entries(value.items)) {
    if (validItem(item, ownerReceizId, sources, value.lastKaiUPulse, animalFoodSources) && key === item.itemId) items[key] = { ...item };
  }
  return { schema: 'wildz.player-nourishment.v1', ownerReceizId, lastKaiUPulse: value.lastKaiUPulse, sources, items, animalFoodSources };
}
export type WildsNourishmentRejection = 'owner-mismatch' | 'stale-time' | 'unknown-source' | 'invalid-source' | 'out-of-reach' | 'wrong-space' | 'stale-source' | 'depleted' | 'pack-full' | 'already-gathered' | 'missing-item' | 'already-consumed' | 'fuel-full' | 'digesting';
function reject(state: WildsNourishmentState, reason: WildsNourishmentRejection) {
  return { ok: false as const, state, reason };
}

/**
 * An adapter may supply an admitted shared-world source map. It must atomically
 * admit sourceState against previousSourceHead before crediting returned food.
 * Without that adapter this is explicitly an owner-local gameplay checkpoint.
 */
export function gatherWildsNourishment(input: {
  state: WildsNourishmentState;
  ownerReceizId: string;
  sourceId: string;
  expectedSourceHead: string;
  kaiUPulse: number;
  player: Readonly<{ x: number; y: number; z: number }>;
  spaceId: string;
  sourceStates?: WildsNourishmentSources;
}) {
  const { state } = input;
  if (!validOwner(input.ownerReceizId) || state.ownerReceizId !== input.ownerReceizId) return reject(state, 'owner-mismatch');
  if (!integer(input.kaiUPulse) || input.kaiUPulse < state.lastKaiUPulse) return reject(state, 'stale-time');
  const plant = wildsNourishmentPlantById(input.sourceId);
  if (!plant) return reject(state, 'unknown-source');
  if (input.spaceId !== 'wildz.space.outer.v1') return reject(state, 'wrong-space');
  if (![input.player.x, input.player.y, input.player.z].every(Number.isFinite)
    || Math.hypot(input.player.x - plant.position.x, input.player.z - plant.position.z) > WILDS_NOURISHMENT_GATHER_REACH
    || Math.abs(input.player.y - plant.position.y) > WILDS_NOURISHMENT_VERTICAL_REACH) return reject(state, 'out-of-reach');
  const crop = wildsNourishmentSourceAt(plant, (input.sourceStates ?? state.sources)[plant.sourceId], input.kaiUPulse);
  if (!crop.valid) return reject(state, 'invalid-source');
  if (input.expectedSourceHead !== crop.head) return reject(state, 'stale-source');
  if (!crop.remaining) return reject(state, 'depleted');
  if (Object.values(state.items).filter(item => item.consumedKaiUPulse === undefined).length >= WILDS_NOURISHMENT_PACK_CAPACITY) return reject(state, 'pack-full');
  const slot = crop.harvested + 1, itemId = foodItemId(input.ownerReceizId, plant.sourceId, crop.cropDay, slot);
  if (state.items[itemId]) return reject(state, 'already-gathered');
  const sourceState: WildsNourishmentSourceState = { schema: 'wildz.nourishment-crop.v1', sourceId: plant.sourceId,
    cropDay: crop.cropDay, harvested: slot, lastKaiUPulse: input.kaiUPulse };
  const item: WildsFoodItem = { schema: 'wildz.food-item.v1', itemId, ownerReceizId: input.ownerReceizId,
    sourceId: plant.sourceId, foodKind: plant.foodKind, cropDay: crop.cropDay, slot, gatheredKaiUPulse: input.kaiUPulse };
  return { ok: true as const, reason: undefined, plant, item, sourceState, previousSourceHead: crop.head,
    state: { ...state, lastKaiUPulse: input.kaiUPulse, sources: { ...state.sources, [plant.sourceId]: sourceState }, items: { ...state.items, [itemId]: item } } };
}
export function consumeWildsNourishment(input: { state: WildsNourishmentState; ownerReceizId: string; itemId: string; kaiUPulse: number; reserveMicroBreaths: number }) {
  const { state } = input;
  if (!validOwner(input.ownerReceizId) || state.ownerReceizId !== input.ownerReceizId) return reject(state, 'owner-mismatch');
  if (!integer(input.kaiUPulse) || input.kaiUPulse < state.lastKaiUPulse) return reject(state, 'stale-time');
  const item = state.items[input.itemId];
  if (!item || !validItem(item, input.ownerReceizId, state.sources, state.lastKaiUPulse, state.animalFoodSources)) return reject(state, 'missing-item');
  if (item.consumedKaiUPulse !== undefined) return reject(state, 'already-consumed');
  const plant = describeWildsFoodItem(item, state)!;
  if (!integer(input.reserveMicroBreaths, PLAYER_BREATH_CAPACITY_MICRO)) return reject(state, 'invalid-source');
  const amount = Math.min(PLAYER_BREATH_CAPACITY_MICRO - input.reserveMicroBreaths, Math.round(plant.fuelBreaths * 1_000_000));
  if (!amount) return reject(state, 'fuel-full');
  if (wildsNourishmentDigestionAt(state, input.kaiUPulse).consumedFuelMicroBreaths + amount > WILDS_NOURISHMENT_DIGESTION_FUEL_MICRO) return reject(state, 'digesting');
  return { ok: true as const, reason: undefined, item, plant, fuelBreaths: amount / 1_000_000,
    state: { ...state, lastKaiUPulse: input.kaiUPulse, items: { ...state.items, [item.itemId]: { ...item, consumedKaiUPulse: input.kaiUPulse, consumedFuelMicroBreaths: amount } } } };
}

export function describeWildsFoodItem(item: WildsFoodItem, state: WildsNourishmentState) {
  return wildsNourishmentPlantById(item.sourceId) ?? (state.animalFoodSources[item.sourceId] ? wildsAnimalFoodSource(state.animalFoodSources[item.sourceId]) : null);
}
export function wildsNourishmentDigestionAt(state: WildsNourishmentState | undefined, kaiUPulse: number) {
  const recent = state && integer(kaiUPulse) ? Object.values(state.items).filter(item => item.consumedKaiUPulse !== undefined
    && item.consumedKaiUPulse <= kaiUPulse && item.consumedKaiUPulse > kaiUPulse - WILDS_NOURISHMENT_DIGESTION_UPULSES) : [];
  const consumedFuelMicroBreaths = recent.reduce((sum, item) => sum + (item.consumedFuelMicroBreaths
    ?? Math.round((describeWildsFoodItem(item, state!)?.fuelBreaths ?? 0) * 1_000_000)), 0);
  return { consumedFuelMicroBreaths, fullnessPercent: Math.min(100, consumedFuelMicroBreaths / WILDS_NOURISHMENT_DIGESTION_FUEL_MICRO * 100),
    remainingFuelMicroBreaths: Math.max(0, WILDS_NOURISHMENT_DIGESTION_FUEL_MICRO - consumedFuelMicroBreaths),
    nextDigestionKaiUPulse: recent.length ? Math.min(...recent.map(item => item.consumedKaiUPulse!)) + WILDS_NOURISHMENT_DIGESTION_UPULSES : null };
}

/** Only call after the finite animal reducer succeeds; this handoff is gameplay evidence. */
export function creditWildsAnimalFood(state: WildsNourishmentState, receipt: WildsAnimalFoodReceipt) {
  const food = wildsAnimalFoodSource(receipt);
  if (!food || receipt.kaiUPulse < state.lastKaiUPulse) return reject(state, 'invalid-source');
  const itemId = foodItemId(state.ownerReceizId, receipt.sourceId, receipt.cycle, 1);
  if (state.items[itemId] || state.animalFoodSources[receipt.sourceId]) return reject(state, 'already-gathered');
  if (availableWildsFood(state).length >= WILDS_NOURISHMENT_PACK_CAPACITY) return reject(state, 'pack-full');
  const item: WildsFoodItem = { schema: 'wildz.food-item.v1', itemId, ownerReceizId: state.ownerReceizId, sourceId: receipt.sourceId,
    foodKind: food.foodKind, cropDay: receipt.cycle, slot: 1, gatheredKaiUPulse: receipt.kaiUPulse };
  return { ok: true as const, reason: undefined, item,
    state: { ...state, lastKaiUPulse: receipt.kaiUPulse, animalFoodSources: { ...state.animalFoodSources, [receipt.sourceId]: receipt }, items: { ...state.items, [itemId]: item } } };
}
/** A food save must retain the corresponding finite hunt or husbandry source checkpoint. */
export function retainWildsAnimalFoodSources(state: WildsNourishmentState | undefined, livestock: WildsLivestockState | undefined) {
  if (!state) return undefined;
  const animalFoodSources = Object.fromEntries(Object.entries(state.animalFoodSources).filter(([, receipt]) => {
    const source = livestock?.ownerReceizId === state.ownerReceizId ? livestock.animals[receipt.animalId] : undefined;
    if (!source) return false;
    if (receipt.action === 'hunt') return source.status === 'hunted' && source.settledKaiUPulse === receipt.kaiUPulse;
    return source.status === 'captured' && source.capturedKaiUPulse! + Number(KAI_N_DAY_MICRO) <= receipt.kaiUPulse
      && source.lastProductDay !== null && receipt.cycle <= source.lastProductDay && receipt.cycle === Number(BigInt(receipt.kaiUPulse) / KAI_N_DAY_MICRO);
  }));
  const items = Object.fromEntries(Object.entries(state.items).filter(([, item]) => !item.sourceId.startsWith('wildz.animal-food.v1|') || animalFoodSources[item.sourceId]));
  return { ...state, animalFoodSources, items };
}
export function availableWildsFood(state: WildsNourishmentState | undefined) {
  return state ? Object.values(state.items).filter(item => item.consumedKaiUPulse === undefined)
    .sort((a, b) => a.gatheredKaiUPulse - b.gatheredKaiUPulse || a.itemId.localeCompare(b.itemId)) : [];
}
