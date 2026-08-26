import type { AdventureCardCondition } from "./adventure/card-condition";
import { creatureForm } from "./creature-catalog";
import { projectCreatureCapabilityIdentity, projectCreatureRuntimeCapabilities } from "./creature-capability-identity";
import { canonicalPortableCardJson, type PortableCardAsset } from "./portable-card";
import { projectWildsCreatureWorkFamilies } from "./wilds-steward-construction";
import {
  WILDS_WORLD_CAPABILITY_REGISTRY,
  type WildsCapabilityIconKey,
  type WildsWorldCapabilityFamily
} from "./wilds-world-capability-registry";

export type WildsProjectedCapabilityControl = Readonly<{
  assetId: string;
  family: WildsWorldCapabilityFamily;
  label: string;
  action: string;
  icon: WildsCapabilityIconKey;
  unlockLevel: 1;
  capacity: number;
  currentPower: number;
  runtimeAvailable: boolean;
}>;

const MAX_CACHE_SIZE = 128;
const canonicalCache = new Map<string, readonly WildsProjectedCapabilityControl[]>();

function boundedCache(key: string, value: readonly WildsProjectedCapabilityControl[]) {
  canonicalCache.set(key, value);
  while (canonicalCache.size > MAX_CACHE_SIZE) {
    const oldest = canonicalCache.keys().next().value as string | undefined;
    if (!oldest) break;
    canonicalCache.delete(oldest);
  }
  return value;
}

function conditionCapacity(condition: AdventureCardCondition) {
  if (condition.life === "dead" || condition.retiredAt) return 0;
  return Math.max(0, Math.min(100, Math.round(100 - condition.fatigue - condition.injuries.length * 10)));
}

export function projectWildsCapabilityControls(
  asset: PortableCardAsset,
  condition: AdventureCardCondition
): readonly WildsProjectedCapabilityControl[] {
  const identity = projectCreatureCapabilityIdentity(asset);
  const runtime = projectCreatureRuntimeCapabilities(identity, condition);
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_capability_form_unknown");
  const families = new Set<WildsWorldCapabilityFamily>();
  for (const specialty of identity.specialties) families.add(specialty.family);
  for (const traversal of identity.traversalPotential) families.add(traversal);
  for (const work of projectWildsCreatureWorkFamilies(form.element)) {
    if (work === "lumber" || work === "quarry") families.add(work);
  }
  const key = canonicalPortableCardJson({
    assetId: identity.assetId,
    digestInput: identity.digestInput,
    families: [...families],
    condition: {
      life: condition.life,
      fatigue: condition.fatigue,
      injuries: condition.injuries,
      retiredAt: condition.retiredAt,
      xp: condition.xp,
      mastery: condition.mastery,
      upgradeIds: condition.upgradeIds
    }
  });
  const cached = canonicalCache.get(key);
  if (cached) return cached;

  const baseCapacity = conditionCapacity(condition);
  const controls = [...families].map((family): WildsProjectedCapabilityControl => {
    const definition = WILDS_WORLD_CAPABILITY_REGISTRY[family];
    const specialtyIndex = identity.specialties.findIndex((candidate) => candidate.family === family);
    const ability = specialtyIndex >= 0 ? identity.abilities[specialtyIndex] : undefined;
    const runtimeAbility = ability ? runtime.abilities.find((candidate) => candidate.descriptor.id === ability.id) : undefined;
    const traversalSuppressed = (family === "flight" || family === "glide" || family === "swim" || family === "climb")
      && !runtime.capabilities.includes(family);
    const runtimeAvailable = runtimeAbility ? runtimeAbility.available : !traversalSuppressed && baseCapacity > 0;
    return Object.freeze({
      assetId: asset.id,
      family,
      label: ability?.name ?? definition.label,
      action: ability?.action ?? definition.ready,
      icon: definition.icon,
      unlockLevel: 1 as const,
      capacity: runtimeAvailable ? baseCapacity : 0,
      currentPower: runtimeAbility?.currentPower ?? Math.round(baseCapacity * .6),
      runtimeAvailable
    });
  });
  return boundedCache(key, Object.freeze(controls));
}

export function projectWildsQuickCapabilityControls(
  controls: readonly WildsProjectedCapabilityControl[],
  traversalCapabilities: readonly string[]
): readonly WildsProjectedCapabilityControl[] {
  return traversalCapabilities.includes("flight")
    ? Object.freeze(controls.filter((control) => control.family !== "flight"))
    : controls;
}
