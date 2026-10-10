import { applyWildsInput, type PlayState } from './game-state';
import type { WildsWorldProjection } from './wilds-world-state';
import { canonicalPortableCardJson, sha256PortableBasis } from './portable-card';
import { sameWildzPlayerCoordinate } from '../../lib/receiz/wildz-player-coordinate';
import type { WildzNativeFoodConsumptionReceipt, WildzNativeWorldReplay } from './wildz-native-world-law';
import { describeWildsFoodItem, type WildsFoodItem, type WildsNourishmentState } from './wilds-nourishment';
import { PLAYER_BREATH_CAPACITY_MICRO, projectPlayerBreathState } from './player-breath-energy';
import { mergeWildsNativeNourishmentDisplay, retainWildsNativeFoodClassification } from './wilds-native-inventory-display';

export type WildsNativeFoodFuelRecovery = Readonly<{ owner: string }>;
type NativeFoodFuelReceipt = Readonly<{ receipt: WildzNativeFoodConsumptionReceipt; originalItem: string }>;
const nativeFuelSources = new WeakMap<WildsNativeFoodFuelRecovery, Readonly<{ nourishment: WildsNourishmentState | undefined; receipts: ReadonlyMap<string, NativeFoodFuelReceipt> }>>();
const sameOwner = (a: string, b: string) => a === b || sameWildzPlayerCoordinate(a, b);
function originalFood(item: WildsFoodItem) {
  const { consumedKaiUPulse: _kai, consumedFuelMicroBreaths: _fuel, ...original } = item;
  return canonicalPortableCardJson(original);
}

/** Call only after native source admission. Digest work happens once here,
 * never in body/animation reconciliation; the resulting cache grants no title. */
export function prepareWildsNativeFoodFuelRecovery(replay: Pick<WildzNativeWorldReplay, 'nourishment' | 'foodConsumptionReceipts'>, owner: string): WildsNativeFoodFuelRecovery {
  const nourishment = replay.nourishment?.[owner], receipts = new Map<string, NativeFoodFuelReceipt>();
  if (nourishment?.ownerReceizId === owner) for (const [id, receipt] of Object.entries(replay.foodConsumptionReceipts ?? {})) {
    const item = nourishment.items[id], food = item && describeWildsFoodItem(item, nourishment);
    if (!item || !food || receipt.schema !== 'wildz.native-food-consumption.v1' || receipt.itemId !== id || !sameOwner(receipt.ownerReceizId, owner)
      || typeof receipt.commandId !== 'string' || !receipt.commandId.trim() || receipt.commandId.trim() !== receipt.commandId
      || !Number.isSafeInteger(receipt.kaiUPulse) || receipt.kaiUPulse < item.gatheredKaiUPulse
      || receipt.kaiUPulse !== item.consumedKaiUPulse || receipt.fuelMicroBreaths !== item.consumedFuelMicroBreaths
      || !Number.isSafeInteger(receipt.fuelMicroBreaths) || receipt.fuelMicroBreaths <= 0 || receipt.fuelMicroBreaths > Math.round(food.fuelBreaths * 1_000_000)) continue;
    const originalItem = originalFood(item);
    if (receipt.sourceItemDigest !== sha256PortableBasis(originalItem)) continue;
    receipts.set(id, Object.freeze({ receipt: Object.freeze({ ...receipt }), originalItem }));
  }
  const source = Object.freeze({ owner });
  nativeFuelSources.set(source, { nourishment, receipts: new Map([...receipts].sort(([, a], [, b]) => a.receipt.kaiUPulse - b.receipt.kaiUPulse || a.receipt.commandId.localeCompare(b.receipt.commandId))) });
  return source;
}

export function hasRecoverableWildsNativeAdmittedFood(state: Pick<PlayState, 'playerNourishment'>, source: WildsNativeFoodFuelRecovery, owner: string) {
  const cached = nativeFuelSources.get(source);
  return Boolean(cached && source.owner === owner && state.playerNourishment?.ownerReceizId === owner
    && Object.values(state.playerNourishment.items).some(item => item.consumedKaiUPulse === undefined && cached.receipts.has(item.itemId)));
}

/** Accepted source consumption and local body credit are separate. Only the
 * exact accepted amount can credit; a full body/digestion window defers it. */
export function recoverWildsNativeAdmittedFoodFuel(state: PlayState, source: WildsNativeFoodFuelRecovery, owner: string, kaiUPulse: number): PlayState {
  const cached = nativeFuelSources.get(source);
  if (!cached || source.owner !== owner || state.playerNourishment?.ownerReceizId !== owner || !Number.isSafeInteger(kaiUPulse) || kaiUPulse < 0) return state;
  let next = state;
  for (const [id, {receipt, originalItem}] of cached.receipts) {
    const nourishment = next.playerNourishment!, item = nourishment.items[id];
    if (!item || item.consumedKaiUPulse !== undefined || receipt.kaiUPulse > kaiUPulse || originalFood(item) !== originalItem) continue;
    const pulse = Math.max(kaiUPulse, nourishment.lastKaiUPulse, next.playerBreaths?.lastKaiUPulse ?? 0);
    if (PLAYER_BREATH_CAPACITY_MICRO - projectPlayerBreathState(next, pulse).playerBreaths.reserveMicroBreaths < receipt.fuelMicroBreaths) continue;
    const eligible = { ...next, playerNourishment: { ...nourishment,
      unavailableItemIds: nourishment.unavailableItemIds?.filter(value => value !== id),
      nativePendingFuelItemIds: nourishment.nativePendingFuelItemIds?.filter(value => value !== id) } };
    const credited = applyWildsInput(eligible, { type: 'eat-food', ownerReceizId: owner, itemId: id, kaiUPulse: pulse, fuelMicroBreathLimit: receipt.fuelMicroBreaths });
    if (credited !== eligible && credited.playerNourishment?.items[id]?.consumedFuelMicroBreaths === receipt.fuelMicroBreaths) next = credited;
  }
  return next;
}

/** Reconcile fuel before copying authoritative consumed portions into display.
 * Uncredited native portions remain unavailable and recoverable after saves. */
export function mergeWildsNativeFoodFuelDisplay(state: PlayState, source: WildsNativeFoodFuelRecovery, owner: string, kaiUPulse: number, admittedIds: Iterable<string>): PlayState {
  const cached = nativeFuelSources.get(source);
  if (!cached || source.owner !== owner) return state;
  const credited = recoverWildsNativeAdmittedFoodFuel(state, source, owner, kaiUPulse);
  const nourishment = retainWildsNativeFoodClassification(mergeWildsNativeNourishmentDisplay(credited.playerNourishment, cached.nourishment), owner, admittedIds);
  return nourishment === credited.playerNourishment ? credited : { ...credited, playerNourishment: nourishment };
}

export function hasRecoverableWildsNativeFood(state: Pick<PlayState, 'playerNourishment'>, world: WildsWorldProjection, owner: string) {
  return Object.values(state.playerNourishment?.items ?? {}).some(item => item.consumedKaiUPulse === undefined
    && !state.playerNourishment?.nativeItemIds?.includes(item.itemId)
    && Boolean(world.foodConsumptionReceipts?.[item.itemId]?.ownerReceizId
      && (world.foodConsumptionReceipts[item.itemId]!.ownerReceizId === owner || sameWildzPlayerCoordinate(world.foodConsumptionReceipts[item.itemId]!.ownerReceizId, owner))));
}

/** Only an accepted native source snapshot may supply these consumption receipts.
 * Local meal history is the once-only fuel credit, including after a lost reply.
 * Body capacity/digestion can defer credit without spending a second portion. */
export function recoverWildsNativeFoodFuel(state: PlayState, world: WildsWorldProjection, owner: string, kaiUPulse: number): PlayState {
  const owns = (value: string) => value === owner || sameWildzPlayerCoordinate(value, owner);
  if (!state.playerNourishment || !owns(state.playerNourishment.ownerReceizId) || !Number.isSafeInteger(kaiUPulse) || kaiUPulse < 0) return state;
  let next = state;
  const receipts = Object.values(state.playerNourishment.items).filter(item => item.consumedKaiUPulse === undefined && !state.playerNourishment?.nativeItemIds?.includes(item.itemId))
    .flatMap(item => { const receipt = world.foodConsumptionReceipts?.[item.itemId]; return receipt ? [[item.itemId, receipt] as const] : []; })
    .sort(([, a], [, b]) => a.kaiUPulse - b.kaiUPulse || a.commandId.localeCompare(b.commandId));
  for (const [id, receipt] of receipts) {
    const nourishment = next.playerNourishment!, item = nourishment.items[id], custody = world.foodCustody?.[id], member = world.foodItems?.[id];
    if (!item || item.consumedKaiUPulse !== undefined || !custody || !member || member.kind !== 'food'
      || !owns(receipt.ownerReceizId) || !owns(custody.ownerReceizId) || !receipt.commandId
      || !Number.isSafeInteger(receipt.kaiUPulse) || receipt.kaiUPulse < 0 || receipt.kaiUPulse > kaiUPulse
      || world.consumedFoodItems?.[id] !== receipt.commandId || receipt.sourceReceiptId !== custody.receiptId
      || canonicalPortableCardJson(item) !== canonicalPortableCardJson(member.foodItem)) continue;
    const eligible = nourishment.unavailableItemIds?.includes(id)
      ? { ...next, playerNourishment: { ...nourishment, unavailableItemIds: nourishment.unavailableItemIds.filter(value => value !== id) } } : next;
    const pulse = Math.max(kaiUPulse, nourishment.lastKaiUPulse, next.playerBreaths?.lastKaiUPulse ?? 0);
    const credited = applyWildsInput(eligible, { type: 'eat-food', ownerReceizId: nourishment.ownerReceizId, itemId: id, kaiUPulse: pulse });
    if (credited !== eligible) next = credited;
  }
  return next;
}
