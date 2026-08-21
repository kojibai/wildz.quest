import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";

declare const admittedInventoryBrand: unique symbol;

export type AdmittedWildsInventory = Readonly<{ [admittedInventoryBrand]: true }>;

type AdmittedInventoryRecord = Readonly<{
  actorId: string;
  inventory: PortableCardAsset[];
}>;

const admittedCards = new WeakSet<PortableCardAsset>();
const admittedInventories = new WeakSet<readonly PortableCardAsset[]>();
const admittedHandles = new WeakMap<object, AdmittedInventoryRecord>();
let verifierCalls = 0;
let checkpointRestores = 0;

/** The one explicit proof boundary for externally supplied cards. */
export function verifyAndAdmitWildsCard(asset: PortableCardAsset) {
  verifierCalls += 1;
  const verified = verifyAnyWildsCard(asset).ok;
  if (verified) admittedCards.add(asset);
  return verified;
}

/** Carries admission across a new array only when every exact card object is already admitted. */
export function retainAdmittedWildsInventory(inventory: PortableCardAsset[]) {
  if (inventory.every((asset) => admittedCards.has(asset))) admittedInventories.add(inventory);
  return inventory;
}

/** Records cards created by Wildz's own deterministic proof sealer or verified migration. */
export function admitLocallySealedWildsInventory(inventory: PortableCardAsset[]) {
  for (const asset of inventory) admittedCards.add(asset);
  admittedInventories.add(inventory);
  return inventory;
}

export function isAdmittedWildsCard(asset: PortableCardAsset) {
  return admittedCards.has(asset);
}

export function createAdmittedWildsInventory(
  inventory: PortableCardAsset[],
  actorId: string
): AdmittedWildsInventory | null {
  if (!actorId.trim() || !admittedInventories.has(inventory) || !inventory.every((asset) => admittedCards.has(asset))) return null;
  const handle = Object.freeze({}) as AdmittedWildsInventory;
  admittedHandles.set(handle, Object.freeze({ actorId, inventory }));
  return handle;
}

export function restoreAdmittedWildsInventory(handle: AdmittedWildsInventory | undefined, actorId: string) {
  if (!handle) return null;
  const admitted = admittedHandles.get(handle);
  if (!admitted || admitted.actorId !== actorId) return null;
  checkpointRestores += 1;
  return admitted.inventory;
}

export function admittedInventoryDiagnostics() {
  return Object.freeze({ verifierCalls, checkpointRestores });
}
