import type { KaiKlokMoment } from "./kai-klok-moment";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { reverifyWildsCreatureMandate, type WildsCreatureMandateV1 } from "./wilds-creature-mandate";
import { compileWildsGroveOperation, type WildsGroveActionKind, type WildsGroveOperationEffectsV1 } from "./wilds-grove-operation";
import type { WildsLivingOperationPlanV1 } from "./wilds-living-operation";
import type { WildsRegionalWeather } from "./wilds-regional-weather";
import { previewWildsEmission, type WildsEmissionPreviewV1, type WildsWorldEmissionProofV1 } from "./wilds-world-emission";

export type { WildsGroveActionKind } from "./wilds-grove-operation";

export type WildsRegenerativeGroveV1 = Readonly<{
  schema: "wildz.regenerative-grove.v1";
  groveId: string;
  regionId: string;
  regionHead: string;
  position: Readonly<{ x: number; z: number }>;
  ecology: Readonly<{ soil: number; moisture: number; maturity: number; flowers: number; pollinators: number; nourishment: number }>;
  materials: Readonly<{ pollen: number; seeds: number; fallenFiber: number; nectar: number; honey: number }>;
  structures: Readonly<{ hive: number; nursery: number }>;
  observed: boolean;
  weather: WildsRegionalWeather;
  availableActions: readonly WildsGroveActionKind[];
  discoveries: readonly string[];
  restorationDebt: number;
  lastKaiUPulse: number;
  revision: number;
  parentHead: string | null;
  writes: 0;
  head: string;
}>;

export type WildsGroveActionPreviewV1 = Readonly<{
  schema: "wildz.grove-action-preview.v1";
  action: WildsGroveActionKind;
  sourceHead: string;
  valid: boolean;
  reasons: readonly string[];
  operation: WildsLivingOperationPlanV1;
  effects: WildsGroveOperationEffectsV1;
  emission: WildsEmissionPreviewV1;
  previewDigest: string;
  writes: 0;
}>;

const ACTIONS = Object.freeze<readonly WildsGroveActionKind[]>([
  "observe", "gather", "pollinate", "sow", "water", "compost", "cultivate",
  "transform-nectar", "harvest-honey", "build-hive", "build-nursery", "repair"
]);
const ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/;
const HEAD = /^(?:sha256:)?[a-f0-9]{64}$/;

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

function digest(value: unknown) { return sha256PortableBasis(canonicalPortableCardJson(value)); }
function unit(seed: string, offset: number) { return Number.parseInt(digest(`${seed}:${offset}`).slice(7, 15), 16) / 0xffffffff; }

function groveWithHead(basis: Omit<WildsRegenerativeGroveV1, "head">): WildsRegenerativeGroveV1 {
  return freeze({ ...basis, head: digest(basis) });
}

function assertGroveHead(grove: WildsRegenerativeGroveV1) {
  const { head, ...basis } = grove;
  if (head !== digest(basis)) throw new Error("wilds_grove_head_invalid");
}

export function projectWildsRegenerativeGrove(input: Readonly<{
  regionId: string;
  regionHead: string;
  position: Readonly<{ x: number; z: number }>;
  moment: KaiKlokMoment;
  weather: WildsRegionalWeather;
}>): WildsRegenerativeGroveV1 {
  if (!ID.test(input.regionId) || !HEAD.test(input.regionHead)
    || !Number.isFinite(input.position.x) || !Number.isFinite(input.position.z)
    || !Number.isSafeInteger(input.moment.uPulse) || input.moment.uPulse < 0) throw new Error("wilds_grove_projection_invalid");
  const seed = canonicalPortableCardJson({ regionId: input.regionId, regionHead: input.regionHead, position: input.position, uPulse: input.moment.uPulse });
  const groveId = `grove:${digest(seed).slice(7, 31)}`;
  return groveWithHead({
    schema: "wildz.regenerative-grove.v1",
    groveId,
    regionId: input.regionId,
    regionHead: input.regionHead,
    position: { ...input.position },
    ecology: {
      soil: 35 + Math.floor(unit(seed, 1) * 31),
      moisture: Math.max(1, Math.round(30 + input.weather.soilMoistureDelta * 20 + unit(seed, 2) * 25)),
      maturity: 12 + Math.floor(unit(seed, 3) * 24),
      flowers: 3 + Math.floor(unit(seed, 4) * 5),
      pollinators: 1 + Math.floor(unit(seed, 5) * 3),
      nourishment: 5 + Math.floor(unit(seed, 6) * 8)
    },
    materials: { pollen: 0, seeds: 0, fallenFiber: 0, nectar: 0, honey: 0 },
    structures: { hive: 0, nursery: 0 },
    observed: false,
    weather: input.weather,
    availableActions: ["observe"],
    discoveries: [],
    restorationDebt: 0,
    lastKaiUPulse: input.moment.uPulse,
    revision: 0,
    parentHead: null,
    writes: 0
  });
}

function previewBasis(preview: Omit<WildsGroveActionPreviewV1, "previewDigest">) {
  return canonicalPortableCardJson(preview);
}

export function previewWildsGroveAction(input: Readonly<{
  grove: WildsRegenerativeGroveV1;
  action: WildsGroveActionKind;
  actor: Readonly<{ id: string; head: string }>;
  mandate?: WildsCreatureMandateV1;
  weather: WildsRegionalWeather;
  moment: KaiKlokMoment;
  emission: WildsWorldEmissionProofV1;
}>): WildsGroveActionPreviewV1 {
  assertGroveHead(input.grove);
  const reasons: string[] = [];
  if (!ACTIONS.includes(input.action)) throw new Error("wilds_grove_action_invalid");
  if (input.action !== "observe" && !input.grove.observed) reasons.push("grove-unobserved");
  const needsMandate = !["observe", "water", "compost", "cultivate", "repair"].includes(input.action);
  if (needsMandate) {
    if (!input.mandate) reasons.push("creature-mandate-required");
    else {
      const verified = reverifyWildsCreatureMandate(input.mandate, {
        creatureHead: input.mandate.creatureHead,
        kaiUPulse: input.moment.uPulse,
        revokedMandateIds: []
      });
      if (!verified.ok || !input.mandate.professions.includes(input.action)
        || !input.mandate.allowedResourceIds.includes(input.grove.groveId)) reasons.push("creature-mandate-invalid");
    }
  }
  if (input.action === "pollinate" && input.grove.materials.pollen < 1) reasons.push("pollen-required");
  if (input.action === "sow" && input.grove.materials.seeds < 1) reasons.push("seed-required");
  if (input.action === "transform-nectar" && input.grove.materials.nectar < 2) reasons.push("nectar-required");
  if ((input.action === "build-hive" || input.action === "build-nursery") && input.grove.materials.fallenFiber < 2) reasons.push("fallen-fiber-required");
  if (input.action === "harvest-honey" && (input.grove.structures.hive < 1 || input.grove.materials.honey < 1)) reasons.push("living-honey-unavailable");
  const compiled = compileWildsGroveOperation({
    grove: input.grove,
    action: input.action,
    actor: input.actor,
    ...(input.mandate ? { mandate: input.mandate } : {}),
    weather: input.weather,
    kaiUPulse: input.moment.uPulse
  });
  const emission = previewWildsEmission({
    emission: input.emission,
    operation: compiled.operation,
    contributionClass: input.action === "build-hive" || input.action === "build-nursery" || input.action === "repair"
      ? "construction"
      : "ecology"
  });
  const basis: Omit<WildsGroveActionPreviewV1, "previewDigest"> = {
    schema: "wildz.grove-action-preview.v1",
    action: input.action,
    sourceHead: input.grove.head,
    valid: reasons.length === 0,
    reasons,
    operation: compiled.operation,
    effects: compiled.effects,
    emission,
    writes: 0
  };
  return freeze({ ...basis, previewDigest: digest(previewBasis(basis)) });
}

function addBounded(value: number, delta: number) {
  const next = value + delta;
  if (!Number.isSafeInteger(next) || next < 0 || next > 1_000_000) throw new Error("wilds_grove_conservation_invalid");
  return next;
}

export function admitWildsGroveAction(input: Readonly<{
  grove: WildsRegenerativeGroveV1;
  preview: WildsGroveActionPreviewV1;
}>): WildsRegenerativeGroveV1 {
  assertGroveHead(input.grove);
  if (!input.preview.valid || input.preview.sourceHead !== input.grove.head) throw new Error("wilds_grove_preview_invalid");
  const { previewDigest, ...basis } = input.preview;
  if (previewDigest !== digest(previewBasis(basis))) throw new Error("wilds_grove_preview_digest_invalid");
  const effects = input.preview.effects;
  const materials = Object.fromEntries(Object.entries(input.grove.materials).map(([key, value]) => [
    key, addBounded(value, effects.materials[key as keyof typeof effects.materials])
  ])) as unknown as WildsRegenerativeGroveV1["materials"];
  const ecology = Object.fromEntries(Object.entries(input.grove.ecology).map(([key, value]) => [
    key, addBounded(value, effects.ecology[key as keyof typeof effects.ecology])
  ])) as unknown as WildsRegenerativeGroveV1["ecology"];
  const structures = {
    hive: addBounded(input.grove.structures.hive, effects.structures.hive),
    nursery: addBounded(input.grove.structures.nursery, effects.structures.nursery)
  };
  const discoveries = effects.discovery
    ? [...new Set([...input.grove.discoveries, effects.discovery])].sort()
    : [...input.grove.discoveries];
  const { head: _currentHead, ...currentBasis } = input.grove;
  return groveWithHead({
    ...currentBasis,
    materials,
    ecology,
    structures,
    observed: input.grove.observed || effects.observe,
    weather: input.grove.weather,
    availableActions: input.grove.observed || effects.observe ? ACTIONS : ["observe"],
    discoveries,
    restorationDebt: addBounded(input.grove.restorationDebt, input.preview.operation.consequences.restorationDebt),
    lastKaiUPulse: input.preview.operation.kaiUPulse,
    revision: input.grove.revision + 1,
    parentHead: input.grove.head,
    writes: 0
  });
}
