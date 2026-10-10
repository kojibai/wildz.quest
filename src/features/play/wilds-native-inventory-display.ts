import { canonicalPortableCardJson } from "./portable-card";
import type { WildsNourishmentState } from "./wilds-nourishment";
import type { WildsLivestockState } from "./wilds-livestock";
import type { WildsWorldProjection } from "./wilds-world-state";

/** Retain a denial of local consumption, never a native authority grant. Only
 * call with IDs from an admitted native replay for this saved owner. */
export function retainWildsNativeFoodClassification(state: WildsNourishmentState | undefined, owner: string, admittedIds: Iterable<string>) {
  if (!state || state.ownerReceizId !== owner) return state;
  const nativeItemIds = [...new Set([...(state.nativeItemIds ?? []), ...admittedIds])].filter(id => Boolean(state.items[id])).sort();
  if (canonicalPortableCardJson(nativeItemIds) === canonicalPortableCardJson(state.nativeItemIds ?? [])) return state;
  return { ...state, nativeItemIds };
}

/** Saved native classification can only forbid local consumption. The native
 * path independently reads, verifies and admits the actual current source. */
export function wildsFoodConsumptionRoute(input: {
  owner: string; itemId: string; nourishment: WildsNourishmentState | undefined;
  nativeSource: Readonly<{ owner: string; foodIds: ReadonlySet<string> }> | null;
  world: WildsWorldProjection | null | undefined; hasNativeIdentity: boolean;
}): 'native' | 'wait' | 'world' | 'local' {
  if (input.nourishment?.ownerReceizId === input.owner && input.nourishment.nativePendingFuelItemIds?.includes(input.itemId)) return 'wait';
  const native = input.nourishment?.ownerReceizId === input.owner && input.nourishment.nativeItemIds?.includes(input.itemId)
    || input.nativeSource?.owner === input.owner && input.nativeSource.foodIds.has(input.itemId);
  if (native) return input.hasNativeIdentity ? 'native' : 'wait';
  if (input.world?.foodItems?.[input.itemId]) return input.hasNativeIdentity ? 'native' : 'world';
  return 'local';
}

/** A display/save merge only. Native resource preparation reads the accepted
 * world replay directly; saved inventory never supplies native issuance. */
export function mergeWildsNativeNourishmentDisplay(current: WildsNourishmentState | undefined, admitted: WildsNourishmentState | undefined) {
  if (!admitted) return current;
  if (!current || current.ownerReceizId !== admitted.ownerReceizId) return retainWildsNativeFoodClassification(admitted, admitted.ownerReceizId, Object.keys(admitted.items));
  const items = { ...current.items, ...admitted.items }, sources = { ...current.sources };
  const pendingFuel = new Set(current.nativePendingFuelItemIds);
  for (const [id, source] of Object.entries(admitted.sources)) {
    const prior = sources[id];
    if (!prior || prior.cropDay < source.cropDay || prior.cropDay === source.cropDay && prior.harvested <= source.harvested) sources[id] = source;
  }
  for (const [id, item] of Object.entries(admitted.items)) {
    const prior = current.items[id];
    if (!prior) continue;
    if (prior.consumedKaiUPulse === undefined && item.consumedKaiUPulse !== undefined) {
      const { consumedKaiUPulse: _acceptedKai, consumedFuelMicroBreaths: _acceptedFuel, ...original } = item;
      if (canonicalPortableCardJson(prior) === canonicalPortableCardJson(original)) { items[id] = prior; pendingFuel.add(id); }
      continue;
    }
    if (prior.consumedKaiUPulse === undefined) continue;
    const { consumedKaiUPulse: _kai, consumedFuelMicroBreaths: _fuel, ...original } = prior;
    const { consumedKaiUPulse: _acceptedKai, consumedFuelMicroBreaths: _acceptedFuel, ...admittedOriginal } = item;
    if (canonicalPortableCardJson(original) === canonicalPortableCardJson(admittedOriginal)) { items[id] = prior; pendingFuel.delete(id); }
  }
  return retainWildsNativeFoodClassification({ ...current, lastKaiUPulse: Math.max(current.lastKaiUPulse, admitted.lastKaiUPulse), items, sources,
    animalFoodSources: { ...current.animalFoodSources, ...admitted.animalFoodSources },
    ...(pendingFuel.size || current.nativePendingFuelItemIds !== undefined ? {nativePendingFuelItemIds: [...pendingFuel].filter(id=>Boolean(items[id]) && items[id].consumedKaiUPulse===undefined).sort()} : {}) }, admitted.ownerReceizId, Object.keys(admitted.items));
}

export function mergeWildsNativeLivestockDisplay(current: WildsLivestockState | undefined, admitted: WildsLivestockState | undefined) {
  if (!admitted) return current;
  if (!current || current.ownerReceizId !== admitted.ownerReceizId) return admitted;
  return { ...admitted, lastKaiUPulse: Math.max(current.lastKaiUPulse, admitted.lastKaiUPulse),
    animals: { ...current.animals, ...admitted.animals }, toolUses: { ...current.toolUses, ...admitted.toolUses },
    abilityCooldowns: { ...current.abilityCooldowns, ...admitted.abilityCooldowns } };
}

/** Absence is meaningful only after a root-admitted replay has arrived. */
export function wildsNativeFoodIds(replay: Readonly<Record<string, unknown>>) {
  const nourishment = replay.nourishment as Record<string, WildsNourishmentState>;
  const record = replay.record as { checkpoint: { projection: { foodItems?: Record<string, unknown> } } };
  return new Set([...Object.values(nourishment).flatMap(state => Object.keys(state.items)),
    ...Object.keys(record.checkpoint.projection.foodItems ?? {})]);
}
