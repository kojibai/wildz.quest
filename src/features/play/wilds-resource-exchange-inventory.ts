import type { ExchangeCard, ExchangeItem } from './WildsResourceExchange';
import { availableWildsFood, describeWildsFoodItem, type WildsNourishmentState } from './wilds-nourishment';
import type { WildsWorldProjection } from './wilds-world-state';
import { wildsMaterialCustodian } from './wilds-world-state';
import { sameWildzPlayerCoordinate } from '../../lib/receiz/wildz-player-coordinate';
import { wildsResourcePackageTitle } from './wilds-resource-package';

const owns = (a: string, b: string) => a === b || sameWildzPlayerCoordinate(a, b);
export function foodUnavailableForExchange(world: WildsWorldProjection | null, owner: string, id: string) {
  const custody = world?.foodCustody?.[id];
  return Boolean(world?.reservedFoodItems?.[id] || world?.consumedFoodItems?.[id] || custody && !owns(custody.ownerReceizId, owner));
}

/** Only a view: original source evidence and consumed meal history stay in the save. */
export function visibleExchangeNourishment(nourishment: WildsNourishmentState | undefined, world: WildsWorldProjection | null, owner: string) {
  if (!nourishment) return undefined;
  const blocked = new Set(availableWildsFood(nourishment).filter(item => foodUnavailableForExchange(world, owner, item.itemId)).map(item => item.itemId));
  if (!blocked.size) return nourishment;
  return { ...nourishment, items: Object.fromEntries(Object.entries(nourishment.items).filter(([id]) => !blocked.has(id))),
    ...(nourishment.importedItems ? { importedItems: Object.fromEntries(Object.entries(nourishment.importedItems).filter(([id]) => !blocked.has(id))) } : {}) };
}

export function projectResourceExchangeInventory(world: WildsWorldProjection | null, nourishment: WildsNourishmentState | undefined, owner: string): { items: ExchangeItem[]; cards: ExchangeCard[] } {
  const items: ExchangeItem[] = [];
  const visibleFood = visibleExchangeNourishment(nourishment, world, owner);
  if (visibleFood) for (const item of availableWildsFood(visibleFood)) {
    const description = describeWildsFoodItem(item, visibleFood);
    if (description) items.push({ id: item.itemId, group: item.foodKind, label: description.label, food: true });
  }
  if (world) for (const lot of Object.values(world.materialLots)) {
    if (world.consumedMaterialLots[lot.lotId] || world.reservedMaterialLots[lot.lotId] || world.storedMaterialLots[lot.lotId] || !owns(wildsMaterialCustodian(world, lot), owner)) continue;
    items.push({ id: lot.lotId, group: lot.kind, label: lot.kind === 'timber' ? 'Timber' : lot.kind === 'stone' ? 'Stone' : 'Hay' });
  }
  if (world) for (const lot of Object.values(world.resourceLots)) {
    if (world.reservedResourceLots?.[lot.lotId] || !owns(world.resourceCustody[lot.lotId]?.ownerReceizId ?? lot.ownerReceizId, owner)) continue;
    items.push({ id: lot.lotId, group: 'living-honey', label: 'Living Honey' });
  }
  const cards = Object.values(world?.resourcePackages ?? {}).filter(record => owns(record.ownerReceizId, owner) && record.status !== 'unpacked').map(record => {
    const groups = new Map<string, number>();
    for (const member of record.package.members) {
      const label = member.kind === 'food' ? wildsResourcePackageTitle({ ...record.package, members: [member] })
        : member.kind === 'material' ? member.materialLot.kind : 'Living Honey';
      groups.set(label, (groups.get(label) ?? 0) + (member.kind === 'resource' ? member.resourceLot.quantity : 1));
    }
    return { id: record.package.packageId, title: wildsResourcePackageTitle(record.package), summary: [...groups].map(([label, quantity]) => `${quantity} ${label}`).join(' · '), status: record.status,
      transferable: record.status === 'packed' || record.status === 'offered', unpackable: record.status === 'packed', cancellable: ['offered', 'issuing', 'cancelling', 'listed', 'reserved'].includes(record.status), recoverable: record.status === 'issuing' };
  });
  return { items, cards };
}
