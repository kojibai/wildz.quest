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
  lumber: { label: "Woodland", guidance: "Tend and harvest living timber in right relation." },
  quarry: { label: "Quarry", guidance: "Read and shape harvestable stone without waste." }
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

export function wildsWorkCapabilityDescription(family: WildsVisibleWorkFamily) {
  return DESCRIPTORS[family];
}
