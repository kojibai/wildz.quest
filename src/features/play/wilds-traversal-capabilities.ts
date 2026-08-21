import type { AdventureCardCondition } from "./adventure/card-condition";
import { creatureForm } from "./creature-catalog";
import { currentLivingGenome, currentRevision } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";
import { isWildsAquaticProfile } from "./wilds-creature-habitat";

export type WildsTraversalCapability = "swim" | "climb" | "glide" | "flight";

export type WildsTraversalCapabilityProjection = Readonly<{
  assetId: string;
  capabilities: readonly WildsTraversalCapability[];
  source: Readonly<{
    aquatic: boolean;
    climbing: boolean;
    winged: boolean;
  }>;
}>;

const MAX_CACHE_SIZE = 128;
const projectionCache = new Map<string, WildsTraversalCapabilityProjection>();
const identityProjectionCache = new WeakMap<PortableCardAsset, WeakMap<AdventureCardCondition, WildsTraversalCapabilityProjection>>();
let slowKeyBuilds = 0;
let projectionsBuilt = 0;

function projectionKey(asset: PortableCardAsset, condition: AdventureCardCondition) {
  slowKeyBuilds += 1;
  const injuries = condition.injuries
    .map((injury) => `${injury.id}:${injury.kind}:${injury.severity}:${injury.sourceEventId}`)
    .sort()
    .join("|");
  const upgrades = [...condition.upgradeIds].sort().join("|");
  return `${asset.id}:${asset.proof.digest}:${condition.life}:${condition.fatigue}:${injuries}:${upgrades}`;
}

function cacheProjection(key: string, projection: WildsTraversalCapabilityProjection) {
  projectionCache.set(key, projection);
  while (projectionCache.size > MAX_CACHE_SIZE) {
    const oldest = projectionCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    projectionCache.delete(oldest);
  }
  return projection;
}

export function projectWildsTraversalCapabilities(
  asset: PortableCardAsset,
  condition: AdventureCardCondition
): WildsTraversalCapabilityProjection {
  if (condition.assetId !== asset.id) throw new Error("wilds_traversal_condition_asset_mismatch");
  const identityCached = identityProjectionCache.get(asset)?.get(condition);
  if (identityCached) return identityCached;
  const key = projectionKey(asset, condition);
  const cached = projectionCache.get(key);
  if (cached) {
    const assetCache = identityProjectionCache.get(asset) ?? new WeakMap<AdventureCardCondition, WildsTraversalCapabilityProjection>();
    assetCache.set(condition, cached);
    identityProjectionCache.set(asset, assetCache);
    return cached;
  }

  const formId = isLivingCardAsset(asset) ? currentRevision(asset).formId : asset.manifest.formId;
  const form = creatureForm(formId);
  if (!form) throw new Error("wilds_traversal_form_unknown");
  const anatomy = isLivingCardAsset(asset) ? currentLivingGenome(asset).anatomy : form.anatomy;
  const abilityNames = isLivingCardAsset(asset) ? currentRevision(asset).abilityNames : asset.manifest.abilityNames;
  const abilityLanguage = `${abilityNames.join(" ")} ${condition.upgradeIds.join(" ")}`.toLowerCase();
  const wingInjury = condition.injuries.some((injury) => injury.kind === "wing" && injury.severity >= 2);
  const limbInjury = condition.injuries.some((injury) => injury.kind === "limb" && injury.severity >= 2);
  const living = condition.life === "alive";
  const aquatic = isWildsAquaticProfile({
    element: form.element,
    anatomy,
    abilityNames: [...abilityNames, ...condition.upgradeIds]
  });
  const climbing = anatomy.body === "armored"
    || anatomy.body === "serpentine"
    || anatomy.detail === "horns"
    || /climb|grip|scale|crag/.test(abilityLanguage);
  const winged = anatomy.body === "winged" || anatomy.detail === "wings" || /wing|glide|flight/.test(abilityLanguage);
  const capabilities: WildsTraversalCapability[] = [];

  if (living && aquatic && condition.fatigue < 100) capabilities.push("swim");
  if (living && climbing && !limbInjury && condition.fatigue < 95) capabilities.push("climb");
  if (living && winged && !wingInjury && condition.fatigue < 100) capabilities.push("glide");
  if (living && winged && !wingInjury && condition.fatigue < 85) capabilities.push("flight");

  projectionsBuilt += 1;
  const projection = cacheProjection(key, Object.freeze({
    assetId: asset.id,
    capabilities: Object.freeze(capabilities),
    source: Object.freeze({ aquatic, climbing, winged })
  }));
  const assetCache = identityProjectionCache.get(asset) ?? new WeakMap<AdventureCardCondition, WildsTraversalCapabilityProjection>();
  assetCache.set(condition, projection);
  identityProjectionCache.set(asset, assetCache);
  return projection;
}

export function wildsTraversalCapabilityCacheSize() {
  return projectionCache.size;
}

export function wildsTraversalProjectionDiagnostics() {
  return Object.freeze({ slowKeyBuilds, projectionsBuilt });
}
