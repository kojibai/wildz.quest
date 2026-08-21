import type { AdventureCardCondition } from "./adventure/card-condition";
import { projectCreatureCapabilityIdentity, projectCreatureRuntimeCapabilities } from "./creature-capability-identity";
import type { PortableCardAsset } from "./portable-card";

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
  const identity = projectCreatureCapabilityIdentity(asset);
  const injuries = condition.injuries
    .map((injury) => `${injury.id}:${injury.kind}:${injury.severity}:${injury.sourceEventId}`)
    .sort()
    .join("|");
  const upgrades = [...condition.upgradeIds].sort().join("|");
  const xp = Object.entries(condition.xp).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${value}`).join("|");
  const mastery = Object.entries(condition.mastery).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${value}`).join("|");
  return `${asset.id}:${asset.proof.digest}:${identity.digestInput.revisionDigest}:${identity.digestInput.visualFingerprint}:${identity.progression.level}:${identity.progression.bond}:${identity.progression.mastery}:${condition.life}:${condition.fatigue}:${injuries}:${xp}:${mastery}:${upgrades}`;
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

  const identity = projectCreatureCapabilityIdentity(asset);
  const runtime = projectCreatureRuntimeCapabilities(identity, condition);
  const aquatic = runtime.capabilities.includes("swim") || identity.traversalPotential.includes("swim");
  const climbing = runtime.capabilities.includes("climb") || identity.traversalPotential.includes("climb");
  const winged = identity.traversalPotential.includes("glide") || identity.traversalPotential.includes("flight");

  projectionsBuilt += 1;
  const projection = cacheProjection(key, Object.freeze({
    assetId: asset.id,
    capabilities: runtime.capabilities,
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
