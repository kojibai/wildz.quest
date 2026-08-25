import { applyAdventureConditionDelta, type AdventureCardCondition } from "./adventure/card-condition";
import { creatureForm } from "./creature-catalog";
import type { PortableCardAsset } from "./portable-card";
import type { WildsResourceSource, WildsResourceWorkFamily } from "./wilds-resource-authority";
import { projectWildsCreatureWorkFamilies } from "./wilds-steward-construction";

export type WildsWorkCapabilityMeter = Readonly<{
  family: WildsVisibleWorkFamily;
  label: string;
  guidance: string;
  value: number;
  state: "ready" | "rest" | "recovering";
}>;

export type WildsVisibleWorkFamily = Extract<WildsResourceWorkFamily, "lumber" | "quarry">;

export type WildsWorkSourceCandidate = Readonly<{
  source: WildsResourceSource;
  availableCapacity: number;
}>;

const DESCRIPTORS: Record<WildsVisibleWorkFamily, Readonly<{ label: string; guidance: string }>> = {
  lumber: { label: "Gather timber", guidance: "Tap to send this companion to the nearest ready tree within reach." },
  quarry: { label: "Gather stone", guidance: "Tap to send this companion to the nearest ready stone within reach." }
};

export const WILDS_COMPANION_WORK_FATIGUE = 3;

export function applyWildsCompanionWork(condition: AdventureCardCondition): AdventureCardCondition {
  return applyAdventureConditionDelta(condition, {
    assetId: condition.assetId,
    lifeBefore: condition.life,
    lifeAfter: condition.life,
    fatigueDelta: WILDS_COMPANION_WORK_FATIGUE,
    injuriesAdded: [],
    xp: { stewardship: 1 },
    mastery: {},
    upgradeIdsAdded: [],
    receiptDigestsAdded: []
  });
}

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

export function selectNearestWildsWorkSource(
  candidates: readonly WildsWorkSourceCandidate[],
  family: WildsVisibleWorkFamily,
  actorPosition: Readonly<{ x: number; z: number }>,
  maxDistance = 5.5
) {
  if (!Number.isFinite(actorPosition.x) || !Number.isFinite(actorPosition.z) || !Number.isFinite(maxDistance) || maxDistance < 0) {
    throw new Error("wilds_work_source_selection_invalid");
  }
  return candidates
    .filter(({ source, availableCapacity }) => source.requirements.creature === family
      && availableCapacity > 0
      && Math.hypot(source.position.x - actorPosition.x, source.position.z - actorPosition.z) <= maxDistance)
    .sort((left, right) => Math.hypot(left.source.position.x - actorPosition.x, left.source.position.z - actorPosition.z)
      - Math.hypot(right.source.position.x - actorPosition.x, right.source.position.z - actorPosition.z)
      || left.source.sourceId.localeCompare(right.source.sourceId))[0]?.source ?? null;
}

export function wildsWorkCapabilityDescription(family: WildsVisibleWorkFamily) {
  return DESCRIPTORS[family];
}
