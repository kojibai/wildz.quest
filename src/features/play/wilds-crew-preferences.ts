import { canOperateWildzCrewCard, type WildzCrewCustody } from "../../lib/receiz/wildz-artifact-codec";
import type { PortableCardAsset } from "./portable-card";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";

export type WildsCrewMode = "follow" | "roam";
/** Local movement preferences only. This is never a work mandate or proof authority. */
export type WildsCrewPreferences = Readonly<{ ownerReceizId: string; byAssetId: Readonly<Record<string, WildsCrewMode>> }>;

export function sanitizeWildsCrewPreferences(value: unknown, inventory: readonly PortableCardAsset[], ownerReceizId?: string, custody?: WildzCrewCustody | null): WildsCrewPreferences | undefined {
  if (!ownerReceizId || !value || typeof value !== "object") return undefined;
  const candidate = value as Partial<WildsCrewPreferences>;
  if (typeof candidate.ownerReceizId !== "string" || !sameWildzPlayerCoordinate(candidate.ownerReceizId, ownerReceizId)
    || !candidate.byAssetId || typeof candidate.byAssetId !== "object" || Array.isArray(candidate.byAssetId)) return undefined;
  const entries = inventory.filter(asset => canOperateWildzCrewCard(asset, ownerReceizId, custody))
    .flatMap(asset => {
      const mode = Object.hasOwn(candidate.byAssetId!, asset.id) ? candidate.byAssetId![asset.id] : undefined;
      return mode === "follow" || mode === "roam" ? [[asset.id, mode] as const] : [];
    });
  return { ownerReceizId, byAssetId: Object.fromEntries(entries) };
}

export function setWildsCrewPreference(value: WildsCrewPreferences | undefined, inventory: readonly PortableCardAsset[], ownerReceizId: string, assetId: string, mode: WildsCrewMode, custody?: WildzCrewCustody | null): WildsCrewPreferences | undefined {
  if ((mode !== "follow" && mode !== "roam") || !inventory.some(asset => asset.id === assetId && canOperateWildzCrewCard(asset, ownerReceizId, custody))) return value;
  const current = sanitizeWildsCrewPreferences(value, inventory, ownerReceizId, custody);
  return { ownerReceizId, byAssetId: { ...current?.byAssetId, [assetId]: mode } };
}
