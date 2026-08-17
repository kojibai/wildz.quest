import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";

const HANDOFF_PREFIX = "receiz:wildz:standalone-card:v1:";

type CardHandoffStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function browserSessionStorage(): CardHandoffStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function handoffKey(assetId: string) {
  return `${HANDOFF_PREFIX}${assetId}`;
}

export function rememberStandaloneWildzCard(
  asset: PortableCardAsset,
  storage: CardHandoffStorage | null = browserSessionStorage()
) {
  if (!storage) return false;
  try {
    if (!verifyAnyWildsCard(asset).ok) return false;
    storage.setItem(handoffKey(asset.id), JSON.stringify(asset));
    return true;
  } catch {
    return false;
  }
}

export function recallStandaloneWildzCard(
  assetId: string,
  storage: CardHandoffStorage | null = browserSessionStorage()
): PortableCardAsset | null {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(handoffKey(assetId));
    if (!serialized) return null;
    const asset = JSON.parse(serialized) as PortableCardAsset;
    if (asset.id !== assetId || !verifyAnyWildsCard(asset).ok) {
      storage.removeItem(handoffKey(assetId));
      return null;
    }
    return structuredClone(asset);
  } catch {
    try { storage.removeItem(handoffKey(assetId)); } catch { /* Storage cleanup is best effort. */ }
    return null;
  }
}
