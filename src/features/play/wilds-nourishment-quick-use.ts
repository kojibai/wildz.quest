import { PLAYER_BREATH_CAPACITY_MICRO } from './player-breath-energy';
import { availableWildsFood, describeWildsFoodItem, wildsNourishmentDigestionAt, type WildsFoodItem, type WildsNourishmentState } from './wilds-nourishment';

/** Read-only presentation of the existing finite food and body rules. */
export function wildsFoodEatingBlocker(item: WildsFoodItem, state: WildsNourishmentState, kaiUPulse: number, fuelPercent: number, digestionRemaining?: number) {
  const description = describeWildsFoodItem(item, state);
  if (!description || item.consumedKaiUPulse !== undefined) return 'This food is no longer available.';
  const fuel = Number.isFinite(fuelPercent) ? Math.max(0, Math.min(100, fuelPercent)) : 100;
  const amount = Math.min(Math.round((100 - fuel) / 100 * PLAYER_BREATH_CAPACITY_MICRO), Math.round(description.fuelBreaths * 1_000_000));
  if (!amount) return 'Your fuel is full. Keep this food for later.';
  if (amount > (digestionRemaining ?? wildsNourishmentDigestionAt(state, kaiUPulse).remainingFuelMicroBreaths)) return 'Let your meal digest before eating more.';
  return null;
}

export type WildsNourishmentCategory = 'fruit' | 'vegetables';

/** Acquisition changes the shortcut; consuming a receipt or advancing time does not. */
export function recentlyGatheredWildsNourishmentCategory(previous: WildsNourishmentState | undefined, state: WildsNourishmentState | undefined): WildsNourishmentCategory | null {
  if (!state) return null;
  const known = previous?.ownerReceizId === state.ownerReceizId ? previous.items : {};
  let newest: WildsFoodItem | undefined;
  for (const item of Object.values(state.items)) {
    if (known[item.itemId] || !['orchard-fruit', 'wild-berries', 'wild-vegetable'].includes(item.foodKind)) continue;
    // Equal-pulse receipts retain acquisition insertion order in the immutable checkpoint.
    if (!newest || item.gatheredKaiUPulse >= newest.gatheredKaiUPulse) newest = item;
  }
  return newest ? newest.foodKind === 'wild-vegetable' ? 'vegetables' : 'fruit' : null;
}

export function projectWildsNourishmentQuickUse(state: WildsNourishmentState | undefined, kaiUPulse: number, fuelPercent: number, category?: WildsNourishmentCategory) {
  const food = availableWildsFood(state).filter(item => !category || (category === 'vegetables'
    ? item.foodKind === 'wild-vegetable' : item.foodKind === 'orchard-fruit' || item.foodKind === 'wild-berries'));
  const remaining = wildsNourishmentDigestionAt(state, kaiUPulse).remainingFuelMicroBreaths;
  const item = state ? food.find(candidate => !wildsFoodEatingBlocker(candidate, state, kaiUPulse, fuelPercent, remaining)) ?? food[0] : undefined;
  return {
    count: food.length,
    item: item ?? null,
    label: item && state ? describeWildsFoodItem(item, state)?.label ?? 'food' : 'food',
    blocker: item && state ? wildsFoodEatingBlocker(item, state, kaiUPulse, fuelPercent, remaining) : 'Gather food to eat.'
  };
}
