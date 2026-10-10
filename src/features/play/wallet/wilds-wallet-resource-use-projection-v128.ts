import { applyWildsInput, type PlayState } from "../game-state";
import { PLAYER_BREATH_CAPACITY_MICRO, projectPlayerBreathState } from "../player-breath-energy";
import { canonicalPortableCardJson } from "../portable-card";
import { describeWildsFoodItem, type WildsFoodItem, type WildsNourishmentState } from "../wilds-nourishment";
import { wildsMaterialCustodian, type WildsWorldProjection } from "../wilds-world-state";
import { sameWildzPlayerCoordinate } from "../../../lib/receiz/wildz-player-coordinate";
import type { WildsWalletResourceMemberRefV128 } from "./wilds-wallet-resource-projection-v128";

const originalFood = (item: WildsFoodItem) => {
  const { consumedKaiUPulse: _kai, consumedFuelMicroBreaths: _fuel, ...original } = item;
  return canonicalPortableCardJson(original);
};

/** Projection only, after the caller admits the current SDK source. A consumed
 * source portion is never recreated; an existing exact local portion records
 * its complete accepted fuel once, or waits for capacity/digestion. */
export function recoverWildsWalletSourceFoodV128(state: PlayState, source: WildsNourishmentState, owner: string, kaiUPulse: number, memberIds: readonly string[]) {
  let next = state;
  const pendingItemIds: string[] = [], creditedItemIds: string[] = [];
  if (source.ownerReceizId !== owner || state.playerNourishment?.ownerReceizId !== owner || !Number.isSafeInteger(kaiUPulse) || kaiUPulse < 0) return { state, pendingItemIds, creditedItemIds };
  const ids = [...new Set(memberIds)].sort((a, b) => (source.items[a]?.consumedKaiUPulse ?? 0) - (source.items[b]?.consumedKaiUPulse ?? 0) || a.localeCompare(b));
  for (const id of ids) {
    const actual = source.items[id], local = next.playerNourishment!.items[id];
    if (!actual || !local || local.consumedKaiUPulse !== undefined || originalFood(actual) !== originalFood(local)) continue;
    const acceptedKai = actual.consumedKaiUPulse, fuel = actual.consumedFuelMicroBreaths, food = describeWildsFoodItem(actual, source);
    if (!Number.isSafeInteger(acceptedKai) || acceptedKai! < actual.gatheredKaiUPulse || acceptedKai! > kaiUPulse
      || !Number.isSafeInteger(fuel) || fuel! <= 0 || !food || fuel! > Math.round(food.fuelBreaths * 1_000_000)) continue;
    const sourceImport = source.importedItems?.[id], localImport = next.playerNourishment!.importedItems?.[id];
    if (canonicalPortableCardJson(sourceImport ?? null) !== canonicalPortableCardJson(localImport ?? null)) continue;
    const pulse = Math.max(kaiUPulse, next.playerNourishment!.lastKaiUPulse, next.playerBreaths?.lastKaiUPulse ?? 0);
    if (PLAYER_BREATH_CAPACITY_MICRO - projectPlayerBreathState(next, pulse).playerBreaths.reserveMicroBreaths < fuel!) { pendingItemIds.push(id); continue; }
    const eligible = { ...next, playerNourishment: { ...next.playerNourishment!, unavailableItemIds: next.playerNourishment!.unavailableItemIds?.filter(value => value !== id) } };
    const credited = applyWildsInput(eligible, { type: "eat-food", ownerReceizId: owner, itemId: id, kaiUPulse: pulse, fuelMicroBreathLimit: fuel });
    if (credited !== eligible && credited.playerNourishment!.items[id]!.consumedFuelMicroBreaths === fuel) { next = credited; creditedItemIds.push(id); }
    else pendingItemIds.push(id);
  }
  return { state: next, pendingItemIds, creditedItemIds };
}

/** Cheap display/selection. Source references may establish the displayed
 * current keeper, but do not bypass current world locks or SDK admission on use. */
export function selectWildsWalletSourceLotsV128(input: Readonly<{world: WildsWorldProjection | null | undefined; ownerReceizId: string; availableMembers: readonly WildsWalletResourceMemberRefV128[]; lockedMemberIds: ReadonlySet<string>}>) {
  const { world, ownerReceizId: owner, availableMembers, lockedMemberIds } = input;
  const sourceMaterialIds = new Set(availableMembers.filter(member => member.kind === "material").map(member => member.id));
  const sourceResourceIds = new Set(availableMembers.filter(member => member.kind === "resource").map(member => member.id));
  const materialLots = [...new Map([...Object.values(world?.materialLots ?? {}), ...availableMembers.flatMap(member => member.materialLot ? [member.materialLot] : [])].map(lot => [lot.lotId, lot])).values()]
    .filter(lot => (sourceMaterialIds.has(lot.lotId) || sameWildzPlayerCoordinate(world ? wildsMaterialCustodian(world, lot) : lot.ownerReceizId, owner))
      && !world?.consumedMaterialLots[lot.lotId] && !world?.storedMaterialLots[lot.lotId] && !world?.reservedMaterialLots?.[lot.lotId] && !lockedMemberIds.has(lot.lotId))
    .sort((a, b) => a.lotId.localeCompare(b.lotId));
  const resourceLots = [...new Map([...Object.values(world?.resourceLots ?? {}), ...availableMembers.flatMap(member => member.resourceLot ? [member.resourceLot] : [])].map(lot => [lot.lotId, lot])).values()]
    .filter(lot => (sourceResourceIds.has(lot.lotId) || sameWildzPlayerCoordinate(world?.resourceCustody?.[lot.lotId]?.ownerReceizId ?? lot.ownerReceizId, owner))
      && !world?.reservedResourceLots?.[lot.lotId] && !lockedMemberIds.has(lot.lotId));
  return { materialLots, resourceLots };
}
