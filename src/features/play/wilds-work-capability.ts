import type { AdventureCardCondition } from "./adventure/card-condition";
import { creatureForm } from "./creature-catalog";
import type { PortableCardAsset } from "./portable-card";
import type { WildsResourceWorkFamily } from "./wilds-resource-authority";
import { projectWildsCreatureWorkFamilies } from "./wilds-steward-construction";

export type WildsWorkCapabilityMeter = Readonly<{
  family: WildsVisibleWorkFamily;
  label: string;
  guidance: string;
  value: number;
  state: "ready" | "rest" | "recovering";
}>;

type WildsVisibleWorkFamily = Extract<WildsResourceWorkFamily, "lumber" | "quarry">;

const DESCRIPTORS: Record<WildsVisibleWorkFamily, Readonly<{ label: string; guidance: string }>> = {
  lumber: { label: "Woodland assist", guidance: "Improves timber work when this companion joins you." },
  quarry: { label: "Quarry assist", guidance: "Improves stone work when this companion joins you." }
};

export function projectWildsWorkCapabilityMeters(asset: PortableCardAsset | null, condition?: AdventureCardCondition | null): readonly WildsWorkCapabilityMeter[] {
  if (!asset) return [];
  const element = creatureForm(asset.manifest.formId)?.element ?? "";
  const fatigue = condition?.fatigue ?? 0;
  const injuries = condition?.injuries.length ?? 0;
  const consentBlocked = fatigue >= 85 || injuries >= 4;
  const value = consentBlocked ? 0 : Math.max(0, Math.min(100, Math.round(100 - fatigue - injuries * 10)));
  const state = consentBlocked || value <= 15 ? "recovering" as const : value < 45 ? "rest" as const : "ready" as const;
  return projectWildsCreatureWorkFamilies(element).filter((family): family is WildsVisibleWorkFamily => family === "lumber" || family === "quarry").map((family) => ({
    family,
    ...DESCRIPTORS[family],
    value,
    state
  }));
}

export function selectWildsResourceWorkPartner(
  assets: readonly PortableCardAsset[],
  conditions: Readonly<Record<string, AdventureCardCondition | undefined>>,
  family: WildsResourceWorkFamily,
  activeAssetId?: string | null
): PortableCardAsset | null {
  const ready = assets.filter((asset) => {
    const condition = conditions[asset.id];
    if (condition && (condition.life === "dead" || condition.retiredAt || condition.fatigue >= 85 || condition.injuries.length >= 4)) return false;
    return projectWildsCreatureWorkFamilies(creatureForm(asset.manifest.formId)?.element ?? "").includes(family);
  });
  return ready.find((asset) => asset.id === activeAssetId) ?? ready[0] ?? null;
}

export function wildsWorkCapabilityDescription(family: WildsVisibleWorkFamily) {
  return DESCRIPTORS[family];
}
