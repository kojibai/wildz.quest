import type { AdventureCardCondition } from "./adventure/card-condition";
import { projectCardCreatureVisualIdentity, type CreatureVisualIdentity } from "./creature-visual-identity";
import { currentCreatureHistoryProjection, currentRevision } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";
import type { WildsTraversalCapability } from "./wilds-traversal-capabilities";

export type CreatureSpecialtyFamily = "flight" | "glide" | "swim" | "dive" | "current" | "climb" | "burrow" | "balance" | "light" | "camouflage" | "track" | "break" | "resist" | "anchor" | "rescue";

export type CreatureSpecialty = Readonly<{
  id: string;
  family: CreatureSpecialtyFamily;
  potential: number;
  control: number;
  endurance: number;
}>;

export type CreatureAbilityDescriptor = Readonly<{
  id: string;
  name: string;
  action: string;
  tags: readonly string[];
  traversalGrant?: WildsTraversalCapability;
  powerCurve: readonly number[];
  unlockLevel: number;
}>;

export type CreatureCapabilityIdentityV1 = Readonly<{
  schema: "receiz.wilds.creature_capability_identity.v1";
  assetId: string;
  digestInput: Readonly<{
    proofDigest: string;
    revisionDigest: string;
    visualFingerprint: string;
  }>;
  traversalPotential: readonly WildsTraversalCapability[];
  specialties: readonly CreatureSpecialty[];
  abilities: readonly CreatureAbilityDescriptor[];
  progression: Readonly<{ level: number; bond: number; mastery: number }>;
}>;

export type CreatureRuntimeAbility = Readonly<{
  descriptor: CreatureAbilityDescriptor;
  currentPower: number;
  available: boolean;
}>;

export type CreatureRuntimeCapabilities = Readonly<{
  assetId: string;
  capabilities: readonly WildsTraversalCapability[];
  abilities: readonly CreatureRuntimeAbility[];
  level: number;
  bond: number;
  mastery: number;
  suppressed: readonly string[];
}>;

const MAX_CACHE_SIZE = 128;
const identityObjectCache = new WeakMap<PortableCardAsset, CreatureCapabilityIdentityV1>();
const identityCanonicalCache = new Map<string, CreatureCapabilityIdentityV1>();
const runtimeObjectCache = new WeakMap<CreatureCapabilityIdentityV1, WeakMap<AdventureCardCondition, CreatureRuntimeCapabilities>>();
const runtimeCanonicalCache = new Map<string, CreatureRuntimeCapabilities>();
let identitySlowBuilds = 0;
let runtimeSlowBuilds = 0;

function boundedCache<T>(cache: Map<string, T>, key: string, value: T) {
  cache.set(key, value);
  while (cache.size > MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return value;
}

function integerHash(value: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function freezeArray<T>(values: T[]) {
  return Object.freeze(values) as readonly T[];
}

export function capabilityPotentialForVisualIdentity(visual: CreatureVisualIdentity): readonly WildsTraversalCapability[] {
  const capabilities: WildsTraversalCapability[] = [];
  const wings = visual.appendages.wings;
  const fins = visual.appendages.fins;
  if (fins.presence === "functional" && fins.kind === "fin" && fins.function === "aquatic-propulsion") capabilities.push("swim");
  if (visual.anatomy.body === "armored" || visual.anatomy.body === "serpentine" || (visual.appendages.tail.presence === "functional" && visual.appendages.tail.function === "grip")) capabilities.push("climb");
  if (wings.presence === "functional" && wings.kind === "wing" && wings.function === "glide") capabilities.push("glide");
  if (wings.presence === "functional" && wings.kind === "wing" && wings.function === "powered-lift") capabilities.push("glide", "flight");
  return freezeArray([...new Set(capabilities)]);
}

function specialtyFamilies(visual: CreatureVisualIdentity, traversal: readonly WildsTraversalCapability[]) {
  const families = new Set<CreatureSpecialtyFamily>();
  for (const capability of traversal) families.add(capability);
  if (visual.appendages.fins.presence === "functional") families.add("dive");
  if (visual.appendages.tail.presence === "functional") families.add("balance");
  if (visual.anatomy.body === "armored" || visual.appendages.wings.presence === "functional") families.add("resist");
  if (visual.anatomy.surface === "shell") families.add("anchor");
  if (visual.anatomy.detail === "horns") families.add("break");
  if (visual.anatomy.body === "serpentine") families.add("burrow");
  families.add("track");
  families.add("rescue");
  families.add("light");
  families.add("camouflage");
  return [...families];
}

function specialty(seed: string, family: CreatureSpecialtyFamily, slot: number): CreatureSpecialty {
  const potential = 45 + integerHash(seed, 101 + slot) % 56;
  const control = 35 + integerHash(seed, 211 + slot) % 66;
  const endurance = 40 + integerHash(seed, 307 + slot) % 61;
  return Object.freeze({ id: `${family}:${integerHash(seed, 401 + slot).toString(36)}`, family, potential, control, endurance });
}

const ACTIONS: Readonly<Record<CreatureSpecialtyFamily, string>> = Object.freeze({
  flight: "Gain powered lift and control altitude.",
  glide: "Convert height and momentum into controlled glide.",
  swim: "Propel through deep water without touching the floor.",
  dive: "Descend through water and explore the living floor.",
  current: "Read and redirect water currents.",
  climb: "Grip steep physical terrain and ascend it.",
  burrow: "Open routes through compatible earth.",
  balance: "Stabilize difficult crossings and narrow routes.",
  light: "Reveal hidden signals in darkness.",
  camouflage: "Blend with compatible terrain and avoid detection.",
  track: "Follow proof-sealed traces left in the world.",
  break: "Dislodge compatible cracked obstacles.",
  resist: "Protect the expedition from matching hazards.",
  anchor: "Hold position against force and current.",
  rescue: "Intervene when a traversal attempt becomes dangerous."
});

function descriptor(name: string, specialtyValue: CreatureSpecialty, slot: number): CreatureAbilityDescriptor {
  const traversalGrant = (["flight", "glide", "swim", "climb"] as const).find((value) => value === specialtyValue.family);
  const base = Math.round((specialtyValue.potential + specialtyValue.control + specialtyValue.endurance) / 6);
  return Object.freeze({
    id: `ability:${specialtyValue.id}`,
    name,
    action: ACTIONS[specialtyValue.family],
    tags: freezeArray([specialtyValue.family, slot === 0 ? "family" : "signature"]),
    ...(traversalGrant ? { traversalGrant } : {}),
    powerCurve: freezeArray([base, base + 8, base + 18, base + 30]),
    unlockLevel: slot === 0 ? 1 : 2
  });
}

function identityProgression(asset: PortableCardAsset) {
  if (!isLivingCardAsset(asset)) return { level: 1, bond: asset.manifest.stats.bond, mastery: 0 };
  const history = currentCreatureHistoryProjection(asset);
  return {
    level: history.level,
    bond: history.bond,
    mastery: Object.values(history.mastery).reduce((total, value) => total + value, 0)
  };
}

export function projectCreatureCapabilityIdentity(asset: PortableCardAsset): CreatureCapabilityIdentityV1 {
  const objectCached = identityObjectCache.get(asset);
  if (objectCached) return objectCached;
  const revisionDigest = isLivingCardAsset(asset) ? currentRevision(asset).digest : asset.proof.digest;
  const canonicalKey = `${asset.id}:${asset.proof.digest}:${revisionDigest}`;
  const canonicalCached = identityCanonicalCache.get(canonicalKey);
  if (canonicalCached) {
    identityObjectCache.set(asset, canonicalCached);
    return canonicalCached;
  }

  identitySlowBuilds += 1;
  const visual = projectCardCreatureVisualIdentity(asset);
  const traversalPotential = capabilityPotentialForVisualIdentity(visual);
  const families = specialtyFamilies(visual, traversalPotential);
  const seed = `${asset.proof.digest}:${revisionDigest}:${visual.fingerprint}`;
  const familyIndex = integerHash(seed, 17) % families.length;
  const family = families[familyIndex]!;
  const signaturePool = families.filter((candidate) => candidate !== family);
  const signature = signaturePool[integerHash(seed, 29) % signaturePool.length] ?? family;
  const specialties = freezeArray([specialty(seed, family, 0), specialty(seed, signature, 1)]);
  const abilityNames = isLivingCardAsset(asset) ? currentRevision(asset).abilityNames : asset.manifest.abilityNames;
  const progression = Object.freeze(identityProgression(asset));
  const identity = Object.freeze({
    schema: "receiz.wilds.creature_capability_identity.v1" as const,
    assetId: asset.id,
    digestInput: Object.freeze({ proofDigest: asset.proof.digest, revisionDigest, visualFingerprint: visual.fingerprint }),
    traversalPotential,
    specialties,
    abilities: freezeArray([descriptor(abilityNames[0], specialties[0]!, 0), descriptor(abilityNames[1], specialties[1]!, 1)]),
    progression
  });
  identityObjectCache.set(asset, identity);
  return boundedCache(identityCanonicalCache, canonicalKey, identity);
}

function runtimeKey(identity: CreatureCapabilityIdentityV1, condition: AdventureCardCondition) {
  runtimeSlowBuilds += 1;
  const injuries = condition.injuries.map((injury) => `${injury.id}:${injury.kind}:${injury.severity}:${injury.sourceEventId}`).sort().join("|");
  const xp = Object.entries(condition.xp).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${value}`).join("|");
  const mastery = Object.entries(condition.mastery).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${value}`).join("|");
  return `${identity.assetId}:${identity.digestInput.proofDigest}:${condition.life}:${condition.fatigue}:${injuries}:${xp}:${mastery}`;
}

export function projectCreatureRuntimeCapabilities(identity: CreatureCapabilityIdentityV1, condition: AdventureCardCondition): CreatureRuntimeCapabilities {
  if (condition.assetId !== identity.assetId) throw new Error("wilds_capability_condition_asset_mismatch");
  const objectCached = runtimeObjectCache.get(identity)?.get(condition);
  if (objectCached) return objectCached;
  const key = runtimeKey(identity, condition);
  const canonicalCached = runtimeCanonicalCache.get(key);
  if (canonicalCached) {
    const identityCache = runtimeObjectCache.get(identity) ?? new WeakMap<AdventureCardCondition, CreatureRuntimeCapabilities>();
    identityCache.set(condition, canonicalCached);
    runtimeObjectCache.set(identity, identityCache);
    return canonicalCached;
  }

  const totalXp = Object.values(condition.xp).reduce((total, value) => total + value, 0);
  const conditionMastery = Object.values(condition.mastery).reduce((total, value) => total + value, 0);
  const level = Math.max(identity.progression.level, 1 + Math.floor(totalXp / 100));
  const bond = identity.progression.bond;
  const mastery = Math.max(identity.progression.mastery, conditionMastery);
  const severeWingInjury = condition.injuries.some((injury) => injury.kind === "wing" && injury.severity >= 2);
  const severeLimbInjury = condition.injuries.some((injury) => injury.kind === "limb" && injury.severity >= 2);
  const suppressed: string[] = [];
  const capabilities = condition.life === "alive" ? identity.traversalPotential.filter((capability) => {
    const unavailable = (capability === "flight" && condition.fatigue >= 85)
      || (capability !== "flight" && condition.fatigue >= (capability === "climb" ? 95 : 100))
      || ((capability === "flight" || capability === "glide") && severeWingInjury)
      || (capability === "climb" && severeLimbInjury);
    if (unavailable) suppressed.push(capability);
    return !unavailable;
  }) : [];
  if (condition.life !== "alive") suppressed.push(...identity.traversalPotential);
  const progressionGain = Math.min(45, Math.floor(level * 2 + bond / 10 + mastery / 20));
  const fatiguePenalty = Math.floor(condition.fatigue / 8);
  const abilities = identity.abilities.map((ability) => Object.freeze({
    descriptor: ability,
    currentPower: Math.max(1, ability.powerCurve[Math.min(ability.powerCurve.length - 1, Math.floor((level - 1) / 4))]! + progressionGain - fatiguePenalty),
    available: condition.life === "alive" && level >= ability.unlockLevel
  }));
  const runtime = Object.freeze({
    assetId: identity.assetId,
    capabilities: freezeArray(capabilities),
    abilities: freezeArray(abilities),
    level,
    bond,
    mastery,
    suppressed: freezeArray([...new Set(suppressed)])
  });
  const identityCache = runtimeObjectCache.get(identity) ?? new WeakMap<AdventureCardCondition, CreatureRuntimeCapabilities>();
  identityCache.set(condition, runtime);
  runtimeObjectCache.set(identity, identityCache);
  return boundedCache(runtimeCanonicalCache, key, runtime);
}

export function projectCreatureCapabilityIdentityDiagnostics() {
  return Object.freeze({ identitySlowBuilds, runtimeSlowBuilds });
}
