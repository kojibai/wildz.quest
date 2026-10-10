import { KAI_N_DAY_MICRO } from './kai-klok-moment';
import { creatureForm } from './creature-catalog';
import { verifyAnyWildsCard, type PortableCardAsset } from './portable-card';
import { validateAdventureCondition, type AdventureCardCondition } from './adventure/card-condition';
import { verifyWildsStewardTool } from './wilds-steward-construction';
import { projectWildsConstructionProgress, verifyWildsConstructionComponent, verifyWildsMaterialContribution, verifyWildsWorkContribution } from './wilds-construction-component';
import type { WildsWorldProjection } from './wilds-world-state';
import { wildsWildAnimalById, wildsWildAnimalsForTile, projectWildsWildAnimalPosition, createWildsAnimalFoodReceipt } from './wilds-animal-ecology';
import { resolveWorldCreationLivestockShelter, type WildsCreationShelterWorld } from './creation/world-source';
import { validConstructionId } from './wilds-construction-project';

export type WildsHusbandryWorld = Pick<WildsWorldProjection, 'constructionComponents' | 'constructionMaterialContributions' | 'constructionWorkContributions' | 'consumedMaterialLots' | 'materialLots' | 'constructionConditions'> & WildsCreationShelterWorld;
export type WildsHuntingToolWorld = Pick<WildsWorldProjection, 'stewardTools' | 'equippedStewardTools'>;
export type WildsAnimalState = Readonly<{
  schema: 'wildz.animal-state.v1'; animalId: string; status: 'captured' | 'hunted'; ownerReceizId: string;
  settledKaiUPulse: number; capturedKaiUPulse: number | null; shelterId: string | null; shelterHead: string | null;
  lastProductDay: number | null;
}>;
export type WildsAnimalSources = Readonly<Record<string, WildsAnimalState>>;
export type WildsLivestockState = Readonly<{
  schema: 'wildz.player-livestock.v1'; ownerReceizId: string; lastKaiUPulse: number;
  /** A local checkpoint until an adapter admits the corresponding shared-world source. */
  animals: WildsAnimalSources;
  toolUses: Readonly<Record<string, number>>;
  abilityCooldowns: Readonly<Record<string, number>>;
}>;
export type WildsAnimalHunter = Readonly<
  { kind: 'tool'; world: WildsHuntingToolWorld } |
  { kind: 'creature'; asset: PortableCardAsset; condition?: AdventureCardCondition; abilityIndex: number }
>;
export const WILDS_ANIMAL_INTERACTION_REACH = 3;
export const WILDS_ANIMAL_ABILITY_COOLDOWN_UPULSES = 12_000_000;
const validKai = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const validOwner = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 512 && v === v.trim();
const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
export function createWildsLivestockState(ownerReceizId: string): WildsLivestockState {
  if (!validOwner(ownerReceizId)) throw Error('wilds_livestock_owner_invalid');
  return { schema: 'wildz.player-livestock.v1', ownerReceizId, lastKaiUPulse: 0, animals: {}, toolUses: {}, abilityCooldowns: {} };
}

/** The controls and the finite hunting transition use the same readiness rules. */
function huntingReadiness(input: { state: WildsLivestockState; ownerReceizId: string; kaiUPulse: number; hunter: WildsAnimalHunter; admittedKeeperReceizId?: string }): 'hunter-unready' | 'ability-cooldown' | null {
  const { state, hunter, ownerReceizId, kaiUPulse } = input;
  if (hunter.kind === 'tool') {
    const toolId = hunter.world.equippedStewardTools[ownerReceizId], tool = hunter.world.stewardTools[toolId];
    return !tool || !verifyWildsStewardTool(tool) || tool.kind !== 'steward-axe' || tool.ownerReceizId !== ownerReceizId
      || tool.kaiUPulse > kaiUPulse || tool.durability.remaining - (state.toolUses[toolId] ?? 0) <= 0 ? 'hunter-unready' : null;
  }
  const { asset, condition, abilityIndex } = hunter;
  try { if (condition) validateAdventureCondition(condition); } catch { return 'hunter-unready'; }
  if (!asset || !verifyAnyWildsCard(asset).ok || (asset.manifest.ownerReceizId !== ownerReceizId && input.admittedKeeperReceizId !== ownerReceizId) || !condition || condition.assetId !== asset.id
    || condition.life !== 'alive' || condition.retiredAt || condition.fatigue >= 85 || condition.injuries.length >= 4
    || !Number.isInteger(abilityIndex) || !creatureForm(asset.manifest.formId)?.abilities[abilityIndex]?.power) return 'hunter-unready';
  const prior = state.abilityCooldowns[`${asset.id}|${abilityIndex}`];
  return prior !== undefined && kaiUPulse - prior < WILDS_ANIMAL_ABILITY_COOLDOWN_UPULSES ? 'ability-cooldown' : null;
}
export function selectWildsHuntingSupport(input: {
  state?: WildsLivestockState; ownerReceizId: string; kaiUPulse: number;
  companion?: PortableCardAsset; condition?: AdventureCardCondition; toolWorld?: WildsHuntingToolWorld; admittedKeeperReceizId?: string;
}): { hunter: { kind: 'creature'; assetId: string; abilityIndex: number } | { kind: 'tool' } | null; blocker: string | null } {
  const unavailable = { hunter: null, blocker: 'Equip an axe or choose a ready companion to hunt.' } as const;
  if (!validOwner(input.ownerReceizId) || !validKai(input.kaiUPulse)) return unavailable;
  const state = input.state ?? createWildsLivestockState(input.ownerReceizId);
  if (state.ownerReceizId !== input.ownerReceizId || input.kaiUPulse < state.lastKaiUPulse) return unavailable;
  let companionFailure: ReturnType<typeof huntingReadiness> = null;
  const abilityIndex = input.companion ? creatureForm(input.companion.manifest.formId)?.abilities.findIndex(ability => ability.power > 0) ?? -1 : -1;
  if (input.companion && abilityIndex >= 0) {
    companionFailure = huntingReadiness({ ...input, state, hunter: { kind: 'creature', asset: input.companion, condition: input.condition, abilityIndex } });
    if (!companionFailure) return { hunter: { kind: 'creature', assetId: input.companion.id, abilityIndex }, blocker: null };
  }
  if (input.toolWorld && !huntingReadiness({ ...input, state, hunter: { kind: 'tool', world: input.toolWorld } })) return { hunter: { kind: 'tool' }, blocker: null };
  if (companionFailure === 'ability-cooldown') return { hunter: null, blocker: 'Let your companion’s hunting ability recover, or equip an axe.' };
  if (input.condition && (input.condition.fatigue >= 85 || input.condition.injuries.length >= 4)) return { hunter: null, blocker: 'Your companion needs rest. Equip an axe or choose a rested companion.' };
  return unavailable;
}
export function wildsAnimalHead(animalId: string, source?: WildsAnimalState) {
  return source ? `wildz.animal-head.v1|${animalId}|${source.status}|${source.ownerReceizId}|${source.settledKaiUPulse}|${source.lastProductDay ?? '-'}|${source.shelterHead ?? '-'}`
    : `wildz.animal-head.v1|${animalId}|wild`;
}
function validAnimalState(v: unknown, owner: string, floor: number): v is WildsAnimalState {
  if (!isRecord(v) || Object.keys(v).sort().join(',') !== ['schema', 'animalId', 'status', 'ownerReceizId', 'settledKaiUPulse', 'capturedKaiUPulse', 'shelterId', 'shelterHead', 'lastProductDay'].sort().join(',')) return false;
  const animal = wildsWildAnimalById(v.animalId);
  if (!animal || v.schema !== 'wildz.animal-state.v1' || v.ownerReceizId !== owner || !validKai(v.settledKaiUPulse) || v.settledKaiUPulse > floor) return false;
  if (v.status === 'hunted') return v.capturedKaiUPulse === null && v.shelterId === null && v.shelterHead === null && v.lastProductDay === null;
  return v.status === 'captured' && animal.capturable && validKai(v.capturedKaiUPulse) && v.capturedKaiUPulse <= v.settledKaiUPulse
    && typeof v.shelterId === 'string' && (/^wildz:construction-component:[a-f0-9]{64}$/.test(v.shelterId)
      || v.shelterId.startsWith('creation:instance:') && validConstructionId(v.shelterId))
    && typeof v.shelterHead === 'string' && /^sha256:[a-f0-9]{64}$/.test(v.shelterHead)
    && (v.lastProductDay === null || (validKai(v.lastProductDay) && v.lastProductDay > Number(BigInt(v.capturedKaiUPulse) / KAI_N_DAY_MICRO)
      && v.lastProductDay <= Number(BigInt(v.settledKaiUPulse) / KAI_N_DAY_MICRO)));
}
export function restoreWildsLivestockState(value: unknown, ownerReceizId: string | undefined): WildsLivestockState | undefined {
  if (!validOwner(ownerReceizId) || !isRecord(value) || value.schema !== 'wildz.player-livestock.v1' || value.ownerReceizId !== ownerReceizId
    || !validKai(value.lastKaiUPulse) || !isRecord(value.animals) || !isRecord(value.toolUses) || !isRecord(value.abilityCooldowns)
    || Object.keys(value).sort().join(',') !== ['schema', 'ownerReceizId', 'lastKaiUPulse', 'animals', 'toolUses', 'abilityCooldowns'].sort().join(',')) return undefined;
  const animals: Record<string, WildsAnimalState> = {}, toolUses: Record<string, number> = {}, abilityCooldowns: Record<string, number> = {};
  for (const [id, source] of Object.entries(value.animals)) if (validAnimalState(source, ownerReceizId, value.lastKaiUPulse) && id === source.animalId) animals[id] = { ...source };
  for (const [id, count] of Object.entries(value.toolUses)) if (/^wildz:tool:steward-axe:[a-f0-9]{64}$/.test(id) && validKai(count) && count <= 24) toolUses[id] = count;
  for (const [id, kai] of Object.entries(value.abilityCooldowns)) if (id.length <= 512 && /^.+\|[01]$/.test(id) && validKai(kai) && kai <= value.lastKaiUPulse) abilityCooldowns[id] = kai;
  return { schema: 'wildz.player-livestock.v1', ownerReceizId, lastKaiUPulse: value.lastKaiUPulse, animals, toolUses, abilityCooldowns };
}

/** Funded, functional garden/habitat/shelter geometry and its consumed material lineage provide a real farm source. */
export type WildsLivestockShelter = Readonly<{ shelterId: string; head: string; ownerReceizId: string; position: Readonly<{ x: number; y: number; z: number }>; spaceId: string; capacity: number }>;
export function resolveWildsLivestockShelter(world: WildsHusbandryWorld, shelterId: string, ownerReceizId: string): WildsLivestockShelter | null {
  try {
    if (shelterId.startsWith('creation:instance:')) return resolveWorldCreationLivestockShelter(world, shelterId, ownerReceizId);
    const component = world.constructionComponents[shelterId];
    if (!component || !verifyWildsConstructionComponent(component) || component.ownerReceizId !== ownerReceizId
      || !['garden', 'habitat', 'room'].includes(component.kind) || (world.constructionConditions?.[shelterId]?.integrity ?? 100) < 50) return null;
    const materials = Object.values(world.constructionMaterialContributions).filter(p => p.componentId === shelterId);
    const work = Object.values(world.constructionWorkContributions).filter(p => p.componentId === shelterId);
    const lineage = (p: { componentHead: string; projectId: string }) => p.componentHead === component.head && p.projectId === component.projectId;
    if (materials.some(p => !verifyWildsMaterialContribution(p) || !lineage(p)) || work.some(p => !verifyWildsWorkContribution(p) || !lineage(p))) return null;
    const progress = projectWildsConstructionProgress(component, materials, work);
    if (!['functional', 'finished'].includes(progress.stage) || progress.allocationConflicts.length || progress.invalidWorkContributionIds.length
      || progress.embeddedLotIds.some(id => world.consumedMaterialLots[id] !== shelterId || !materials.some(p => p.lotId === id && world.materialLots[id]?.head === p.lotHead))) return null;
    return { shelterId, head: component.head, ownerReceizId, position: component.transform.position,
      spaceId: component.evidence.spaceId ?? 'wildz.space.outer.v1', capacity: 4 };
  } catch { return null; }
}
export function selectWildsLivestockShelter(world: WildsHusbandryWorld, player: { x: number; z: number }, ownerReceizId: string, spaceId = 'wildz.space.outer.v1') {
  return nearestLivestockShelter(world, player, spaceId, id => resolveWildsLivestockShelter(world, id, ownerReceizId));
}
function nearestLivestockShelter(world: WildsHusbandryWorld, player: { x: number; z: number }, spaceId: string, resolve: (id: string) => WildsLivestockShelter | null) {
  const ids = [...Object.values(world.constructionComponents).filter(c => ['garden', 'habitat', 'room'].includes(c.kind)
    && Math.hypot(c.transform.position.x - player.x, c.transform.position.z - player.z) <= 8).map(c => c.componentId), ...Object.keys(world.creations ?? {})];
  return ids.map(resolve).filter((source): source is WildsLivestockShelter => Boolean(source && source.spaceId === spaceId
    && Math.hypot(source.position.x - player.x, source.position.z - player.z) <= 8))
    .sort((a, b) => Math.hypot(a.position.x - player.x, a.position.z - player.z) - Math.hypot(b.position.x - player.x, b.position.z - player.z) || a.shelterId.localeCompare(b.shelterId))[0] ?? null;
}

/** Verify each shelter once per immutable world snapshot; movement only checks reach. */
export function createWildsLivestockShelterSelector() {
  let retainedWorld: WildsHusbandryWorld | undefined, retainedOwner: string | undefined;
  const sources = new Map<string, WildsLivestockShelter | null>();
  return (world: WildsHusbandryWorld, player: { x: number; z: number }, owner: string, spaceId = 'wildz.space.outer.v1') => {
    if (world !== retainedWorld || owner !== retainedOwner) { sources.clear(); retainedWorld = world; retainedOwner = owner; }
    return nearestLivestockShelter(world, player, spaceId, id => {
      if (!sources.has(id)) sources.set(id, resolveWildsLivestockShelter(world, id, owner));
      return sources.get(id)!;
    });
  };
}
export function projectWildsWildAnimals(input: { player: { x: number; z: number; y?: number }; radius: number; kaiUPulse: number; sourceStates?: WildsAnimalSources; spaceId?: string }) {
  if (![input.player.x, input.player.z, input.radius].every(Number.isFinite) || input.radius < 0 || !validKai(input.kaiUPulse)
    || (input.spaceId && input.spaceId !== 'wildz.space.outer.v1')) return [];
  const radius = Math.min(96, input.radius), result = [];
  for (let z = Math.floor((input.player.z - radius) / 12); z <= Math.floor((input.player.z + radius) / 12); z++)
    for (let x = Math.floor((input.player.x - radius) / 12); x <= Math.floor((input.player.x + radius) / 12); x++)
      for (const animal of wildsWildAnimalsForTile(x, z)) {
        const motion = projectWildsWildAnimalPosition(animal, input.kaiUPulse), source = input.sourceStates?.[animal.animalId];
        const distance = Math.hypot(input.player.x - motion.position.x, input.player.z - motion.position.z);
        if (distance > radius) continue;
        const vertical = input.player.y === undefined || Math.abs(input.player.y - motion.position.y) <= 1.8;
        result.push({ ...animal, ...motion, head: wildsAnimalHead(animal.animalId, source), status: source?.status ?? 'wild' as const,
          distance, canInteract: !source && distance <= WILDS_ANIMAL_INTERACTION_REACH && vertical });
      }
  return result.sort((a, b) => a.distance - b.distance || a.animalId.localeCompare(b.animalId));
}
export function projectWildsOwnedLivestock(state: WildsLivestockState | undefined, world: WildsHusbandryWorld, kaiUPulse: number) {
  if (!state || !validKai(kaiUPulse)) return [];
  return Object.values(state.animals).filter(source => source.status === 'captured').flatMap(source => {
    const animal = wildsWildAnimalById(source.animalId), shelter = resolveWildsLivestockShelter(world, source.shelterId!, state.ownerReceizId);
    if (!animal || !shelter || shelter.head !== source.shelterHead) return [];
    const day = Number(BigInt(kaiUPulse) / KAI_N_DAY_MICRO);
    return [{ ...animal, position: shelter.position, shelterId: shelter.shelterId, spaceId: shelter.spaceId, head: wildsAnimalHead(source.animalId, source),
      canProduce: Boolean(animal.product && kaiUPulse - source.capturedKaiUPulse! >= Number(KAI_N_DAY_MICRO) && source.lastProductDay !== day) }];
  });
}
export type WildsAnimalRejection = 'owner-mismatch' | 'stale-time' | 'unknown-animal' | 'wrong-space' | 'out-of-reach' | 'stale-animal' | 'already-settled' | 'hunter-unready' | 'ability-cooldown' | 'shelter-unready' | 'shelter-full' | 'not-livestock' | 'not-ready';
const reject = (state: WildsLivestockState, reason: WildsAnimalRejection) => ({ ok: false as const, reason, state });
type AnimalRequest = { state: WildsLivestockState; ownerReceizId: string; animalId: string; expectedAnimalHead: string; kaiUPulse: number;
  player: { x: number; y: number; z: number }; spaceId: string; sourceStates?: WildsAnimalSources };
function checkAnimal(input: AnimalRequest) {
  if (!validOwner(input.ownerReceizId) || input.state.ownerReceizId !== input.ownerReceizId) return 'owner-mismatch' as const;
  if (!validKai(input.kaiUPulse) || input.kaiUPulse < input.state.lastKaiUPulse) return 'stale-time' as const;
  const animal = wildsWildAnimalById(input.animalId); if (!animal) return 'unknown-animal' as const;
  if (input.spaceId !== 'wildz.space.outer.v1') return 'wrong-space' as const;
  const motion = projectWildsWildAnimalPosition(animal, input.kaiUPulse);
  if (![input.player.x, input.player.y, input.player.z].every(Number.isFinite) || Math.hypot(input.player.x - motion.position.x, input.player.z - motion.position.z) > WILDS_ANIMAL_INTERACTION_REACH
    || Math.abs(input.player.y - motion.position.y) > 1.8) return 'out-of-reach' as const;
  const source = (input.sourceStates ?? input.state.animals)[input.animalId];
  if (input.expectedAnimalHead !== wildsAnimalHead(input.animalId, source)) return 'stale-animal' as const;
  if (source || input.state.animals[input.animalId]) return 'already-settled' as const;
  return null;
}
export function huntWildsAnimal(input: AnimalRequest & { hunter: WildsAnimalHunter; admittedKeeperReceizId?: string }) {
  const failure = checkAnimal(input); if (failure) return reject(input.state, failure);
  const { state, hunter } = input;
  const hunterFailure = huntingReadiness(input); if (hunterFailure) return reject(state, hunterFailure);
  let toolUses = state.toolUses, abilityCooldowns = state.abilityCooldowns;
  if (hunter.kind === 'tool') {
    const toolId = hunter.world.equippedStewardTools[input.ownerReceizId];
    // Local hunting wear cannot mint a Native tool successor. Its debit remains explicit.
    toolUses = { ...toolUses, [toolId]: (toolUses[toolId] ?? 0) + 1 };
  } else {
    const cooldownId = `${hunter.asset.id}|${hunter.abilityIndex}`;
    abilityCooldowns = { ...abilityCooldowns, [cooldownId]: input.kaiUPulse };
  }
  const animal = wildsWildAnimalById(input.animalId)!;
  const source: WildsAnimalState = { schema: 'wildz.animal-state.v1', animalId: animal.animalId, status: 'hunted', ownerReceizId: input.ownerReceizId,
    settledKaiUPulse: input.kaiUPulse, capturedKaiUPulse: null, shelterId: null, shelterHead: null, lastProductDay: null };
  return { ok: true as const, reason: undefined, animal, source, previousAnimalHead: input.expectedAnimalHead,
    foodReceipt: createWildsAnimalFoodReceipt(animal, 'hunt', 0, input.kaiUPulse),
    state: { ...state, lastKaiUPulse: input.kaiUPulse, toolUses, abilityCooldowns, animals: { ...state.animals, [animal.animalId]: source } } };
}
export function captureWildsLivestock(input: AnimalRequest & { shelterId: string; world: WildsHusbandryWorld }) {
  const failure = checkAnimal(input); if (failure) return reject(input.state, failure);
  const animal = wildsWildAnimalById(input.animalId)!;
  if (!animal.capturable) return reject(input.state, 'not-livestock');
  const shelter = resolveWildsLivestockShelter(input.world, input.shelterId, input.ownerReceizId);
  if (!shelter || shelter.spaceId !== input.spaceId || Math.hypot(shelter.position.x - input.player.x, shelter.position.z - input.player.z) > 8) return reject(input.state, 'shelter-unready');
  const occupants = Object.values(input.sourceStates ?? input.state.animals).filter(s => s.status === 'captured' && s.shelterId === input.shelterId).length;
  if (occupants >= shelter.capacity) return reject(input.state, 'shelter-full');
  const source: WildsAnimalState = { schema: 'wildz.animal-state.v1', animalId: animal.animalId, status: 'captured', ownerReceizId: input.ownerReceizId,
    settledKaiUPulse: input.kaiUPulse, capturedKaiUPulse: input.kaiUPulse, shelterId: shelter.shelterId, shelterHead: shelter.head, lastProductDay: null };
  return { ok: true as const, reason: undefined, animal, source, previousAnimalHead: input.expectedAnimalHead,
    foodReceipt: undefined,
    state: { ...input.state, lastKaiUPulse: input.kaiUPulse, animals: { ...input.state.animals, [animal.animalId]: source } } };
}
export function collectWildsLivestock(input: { state: WildsLivestockState; ownerReceizId: string; animalId: string; kaiUPulse: number; player: { x: number; y: number; z: number }; spaceId: string; world: WildsHusbandryWorld }) {
  const { state } = input;
  if (state.ownerReceizId !== input.ownerReceizId) return reject(state, 'owner-mismatch');
  if (!validKai(input.kaiUPulse) || input.kaiUPulse < state.lastKaiUPulse) return reject(state, 'stale-time');
  const animal = wildsWildAnimalById(input.animalId), source = state.animals[input.animalId];
  if (!animal?.product || !source || source.status !== 'captured' || source.ownerReceizId !== input.ownerReceizId) return reject(state, 'not-livestock');
  const shelter = resolveWildsLivestockShelter(input.world, source.shelterId!, input.ownerReceizId);
  if (!shelter || shelter.head !== source.shelterHead || shelter.spaceId !== input.spaceId) return reject(state, 'shelter-unready');
  if (![input.player.x, input.player.y, input.player.z].every(Number.isFinite) || Math.hypot(input.player.x - shelter.position.x, input.player.z - shelter.position.z) > 4
    || Math.abs(input.player.y - shelter.position.y) > 1.8) return reject(state, 'out-of-reach');
  const day = Number(BigInt(input.kaiUPulse) / KAI_N_DAY_MICRO);
  if (input.kaiUPulse - source.capturedKaiUPulse! < Number(KAI_N_DAY_MICRO) || source.lastProductDay === day) return reject(state, 'not-ready');
  const next: WildsAnimalState = { ...source, settledKaiUPulse: input.kaiUPulse, lastProductDay: day };
  return { ok: true as const, reason: undefined, animal, source: next, previousAnimalHead: wildsAnimalHead(animal.animalId, source),
    foodReceipt: createWildsAnimalFoodReceipt(animal, 'produce', day, input.kaiUPulse),
    state: { ...state, lastKaiUPulse: input.kaiUPulse, animals: { ...state.animals, [animal.animalId]: next } } };
}
