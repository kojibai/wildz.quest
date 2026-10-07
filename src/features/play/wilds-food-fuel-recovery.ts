import { applyWildsInput, type PlayState } from './game-state';
import type { WildsWorldProjection } from './wilds-world-state';
import { canonicalPortableCardJson } from './portable-card';
import { sameWildzPlayerCoordinate } from '../../lib/receiz/wildz-player-coordinate';

export function hasRecoverableWildsNativeFood(state: Pick<PlayState, 'playerNourishment'>, world: WildsWorldProjection, owner: string) {
  return Object.values(state.playerNourishment?.items ?? {}).some(item => item.consumedKaiUPulse === undefined
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
  const receipts = Object.values(state.playerNourishment.items).filter(item => item.consumedKaiUPulse === undefined)
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
